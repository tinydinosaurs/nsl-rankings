// === server/db/csvParser.js ===
const Papa = require('papaparse');

const { EVENTS } = require('../constants/events');
const { generatePlaceholderEmail } = require('../utils/competitorUtils');

// Aliases: maps various human-entered column names to canonical event names
// NOTE: if you add or change aliases here, also update the "CSV format" section
// in client/src/pages/HelpPage/HelpPage.jsx so the admin help docs stay in sync.
const COLUMN_ALIASES = {
	knockdowns: [
		'knockdowns',
		'knockdown',
		'knock',
		'kd',
		'knock downs',
		'knock-downs',
	],
	distance: ['distance', 'dist', 'dst', 'distanc'],
	speed: ['speed', 'spd', 'sp', 'velocity'],
	woods: [
		'woods',
		'wood',
		'woods course',
		'woods_course',
		'woodscourse',
		'forest',
		'wc',
	],
	name: [
		'name',
		'competitor',
		'athlete',
		'player',
		'participant',
		'full name',
		'fullname',
		'full_name',
	],
	email: ['email', 'e-mail', 'email address', 'emailaddress', 'e_mail'],
	is_member: [
		'member',
		'members',
		'is_member',
		'ismember',
		'membership',
		'nsl member',
		'nsl_member',
		'nslmember',
	],
};

// Known non-score designations — treated as null (not scored/not penalized), not 0
const NON_SCORE_VALUES = new Set([
	'dns',
	'dq',
	'dnf',
	'scratch',
	'n/a',
	'-',
	'wd',
	'disqualified',
]);

// Boolean parsing for the membership column. Returns true, false, or null (unknown).
const MEMBER_TRUTHY = new Set(['true', 't', 'yes', 'y', '1', 'member']);
const MEMBER_FALSY = new Set([
	'false',
	'f',
	'no',
	'n',
	'0',
	'non-member',
	'nonmember',
]);

function parseMemberValue(raw) {
	if (raw === undefined || raw === null) return null;
	const v = String(raw).trim().toLowerCase();
	if (v === '') return null;
	if (MEMBER_TRUTHY.has(v)) return true;
	if (MEMBER_FALSY.has(v)) return false;
	return null;
}

function normalizeHeader(h) {
	return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function detectColumn(header, field) {
	const normalized = normalizeHeader(header);
	return COLUMN_ALIASES[field].some(
		(alias) => normalizeHeader(alias) === normalized,
	);
}

/**
 * Given raw CSV text and tournament settings (which events are active, total points per event),
 * parse and return:
 *   { competitors: [...], warnings: [...], errors: [...] }
 *
 * Each competitor: { name, knockdowns_earned, distance_earned, speed_earned, woods_earned }
 * null = event not present in this tournament
 * 0 = event present but blank/zero in spreadsheet
 */
function parseCSV(csvText, tournamentSettings) {
	const { activeEvents, totalPoints } = tournamentSettings;
	const warnings = [];
	const errors = [];

	// Parse with PapaParse — try to detect headers automatically
	const result = Papa.parse(csvText.trim(), {
		skipEmptyLines: true,
		dynamicTyping: false, // keep all values as strings — we parse numbers explicitly below
	});

	if (result.errors.length > 0) {
		const fatalErrors = result.errors.filter((e) => e.type === 'Delimiter');
		if (fatalErrors.length > 0) {
			errors.push(
				'Could not parse CSV — check that the file uses comma or tab separators.',
			);
			return { competitors: [], warnings, errors };
		}
	}

	const rows = result.data;
	if (rows.length < 2) {
		errors.push('CSV appears to be empty or has no data rows.');
		return { competitors: [], warnings, errors };
	}

	// Find the header row — scan first 5 rows for the one that contains a "name"-like column
	let headerRowIndex = -1;
	let headerRow = null;
	for (let i = 0; i < Math.min(5, rows.length); i++) {
		const hasName = rows[i].some((cell) => detectColumn(String(cell), 'name'));
		if (hasName) {
			headerRowIndex = i;
			headerRow = rows[i].map(String);
			break;
		}
	}

	if (headerRowIndex === -1) {
		errors.push(
			'Could not find a header row. Make sure one of your columns is labeled "name", "competitor", "athlete", or similar.',
		);
		return { competitors: [], warnings, errors };
	}

	if (headerRowIndex > 0) {
		warnings.push(
			`Header row found at row ${headerRowIndex + 1} (skipped ${headerRowIndex} row(s) above it).`,
		);
	}

	// Map column indices
	const colMap = {};
	headerRow.forEach((h, i) => {
		for (const field of ['name', 'email', 'is_member', ...EVENTS]) {
			if (!colMap[field] && detectColumn(h, field)) {
				colMap[field] = i;
			}
		}
	});

	if (colMap.name === undefined) {
		errors.push('No name column found in header row.');
		return { competitors: [], warnings, errors };
	}

	// Warn (once) if no membership column was found — all rows will default to member.
	const memberColumnPresent = colMap.is_member !== undefined;
	if (!memberColumnPresent) {
		warnings.push(
			'No membership column found (e.g. "member" or "NSL member"). All rows will be treated as members.',
		);
	}

	// Warn about active events with no matching column
	for (const event of activeEvents) {
		if (colMap[event] === undefined) {
			warnings.push(
				`Event "${event}" is marked active but no matching column was found in the CSV. This event will be treated as not held (excluded from scoring).`,
			);
		}
	}

	// Parse data rows
	const dataRows = rows.slice(headerRowIndex + 1);
	const competitors = [];
	const competitorsWithoutEmail = [];
	const seenEmails = new Set();

	dataRows.forEach((row, rowIndex) => {
		const lineNum = headerRowIndex + rowIndex + 2; // 1-based, accounting for header

		const rawName = row[colMap.name]?.toString().trim();
		if (!rawName) {
			warnings.push(`Row ${lineNum}: Empty name — skipped.`);
			return;
		}

		let rawEmail =
			colMap.email !== undefined ? row[colMap.email]?.toString().trim() : '';

		// Generate placeholder email if missing
		if (!rawEmail) {
			rawEmail = generatePlaceholderEmail(rawName);
			competitorsWithoutEmail.push(rawName);
		}

		// Check for duplicate emails within this CSV
		if (seenEmails.has(rawEmail.toLowerCase())) {
			warnings.push(
				`Row ${lineNum} (${rawName}): Duplicate email "${rawEmail}" — this row will be skipped.`,
			);
			return;
		}
		seenEmails.add(rawEmail.toLowerCase());

		const competitor = { name: rawName, email: rawEmail };

		// Membership: default true when the column is absent (backward compat).
		// When the column is present, parse each row; unrecognized values warn and fall back to false.
		if (memberColumnPresent) {
			const rawMember = row[colMap.is_member]?.toString();
			const parsed = parseMemberValue(rawMember);
			if (parsed === null) {
				warnings.push(
					`Row ${lineNum} (${rawName}): Unrecognized membership value "${rawMember ?? ''}" — treated as non-member.`,
				);
				competitor.is_member = false;
			} else {
				competitor.is_member = parsed;
			}
		} else {
			competitor.is_member = true;
		}

		for (const event of EVENTS) {
			if (!activeEvents.includes(event)) {
				competitor[`${event}_earned`] = null;
				continue;
			}

			if (colMap[event] === undefined) {
				// Column missing for active event → treat as not held (null)
				competitor[`${event}_earned`] = null;
				continue;
			}

			const raw = row[colMap[event]]?.toString().trim();

			if (!raw || raw === '') {
				// Blank cell in active event → 0
				competitor[`${event}_earned`] = 0;
				warnings.push(
					`Row ${lineNum} (${rawName}): Blank "${event}" value treated as 0.`,
				);
			} else if (NON_SCORE_VALUES.has(raw.toLowerCase())) {
				// Known non-score designation → null (excluded from average, not penalized)
				competitor[`${event}_earned`] = null;
				warnings.push(
					`Row ${lineNum} (${rawName}): "${raw}" in "${event}" treated as not scored (excluded from average).`,
				);
			} else {
				const val = parseFloat(raw);
				if (isNaN(val)) {
					warnings.push(
						`Row ${lineNum} (${rawName}): Non-numeric value "${raw}" in "${event}" — treated as 0.`,
					);
					competitor[`${event}_earned`] = 0;
				} else if (val < 0) {
					warnings.push(
						`Row ${lineNum} (${rawName}): Negative value "${raw}" in "${event}" — treated as 0.`,
					);
					competitor[`${event}_earned`] = 0;
				} else if (val > totalPoints[event]) {
					warnings.push(
						`Row ${lineNum} (${rawName}): Value "${raw}" in "${event}" exceeds total points (${totalPoints[event]}) — accepted but verify.`,
					);
					competitor[`${event}_earned`] = val;
				} else {
					competitor[`${event}_earned`] = val;
				}
			}
		}

		competitors.push(competitor);
	});

	// Add specific warning for competitors without email addresses
	if (competitorsWithoutEmail.length > 0) {
		warnings.push(
			`The following competitors had no email address — placeholder emails were generated. Update these in the admin panel: [${competitorsWithoutEmail.join(', ')}]`,
		);
	}

	if (competitors.length === 0) {
		errors.push('No valid competitor rows found after parsing.');
	}

	return { competitors, warnings, errors };
}

module.exports = { parseCSV };
