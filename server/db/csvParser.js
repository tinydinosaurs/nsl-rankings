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

// Known non-score designations — treated as null (not scored, not penalized).
// Excluded from the competitor's average for that event.
// DQ / disqualified are intentionally NOT in this set: a disqualification is a
// penalty, not "didn't participate," so it counts as 0 in the average. See
// `DQ_VALUES` below.
const NON_SCORE_VALUES = new Set(['dns', 'dnf', 'scratch', 'n/a', '-', 'wd']);

// Disqualification designations — treated as 0 (penalty counts toward average).
const DQ_VALUES = new Set(['dq', 'disqualified']);

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

	// Membership column is required: it gates inclusion on the public leaderboard,
	// so a missing column must fail loudly rather than silently default everyone to member.
	if (colMap.is_member === undefined) {
		errors.push(
			'No membership column found (e.g. "member" or "NSL member"). Add the column and re-upload. Use "yes"/"no" — blank cells will be treated as non-members.',
		);
		return { competitors: [], warnings, errors };
	}

	// Warn about active events with no matching column. The structured
	// `missing_event_columns` array drives the slice-5 preview banner with
	// one-click remediation; the string warning stays for back-compat with
	// the existing inline warnings list.
	const missingEventColumns = [];
	for (const event of activeEvents) {
		if (colMap[event] === undefined) {
			missingEventColumns.push(event);
			warnings.push(
				`Event "${event}" is marked active but no matching column was found in the CSV. This event will be treated as not held (excluded from scoring).`,
			);
		}
	}

	// Parse data rows
	const dataRows = rows.slice(headerRowIndex + 1);
	const competitors = [];
	const competitorsWithoutEmail = [];
	const blankMembershipRows = [];
	const seenEmails = new Set();
	// Aggregate non-score values by event + value so admins see
	// "Distance: 3 row(s) marked DNS" instead of 3 separate per-row warnings.
	const nonScoreCounts = new Map(); // key: `${event}|${rawLower}` -> count
	const dqCounts = new Map(); // key: event -> count

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

		// Membership column is guaranteed present here (missing column errors out above).
		// Blank cells default to non-member and are aggregated into a single warning.
		// Unrecognized values warn per-row so the admin can find and fix them.
		const rawMember = row[colMap.is_member]?.toString();
		const trimmedMember = (rawMember ?? '').trim();
		if (trimmedMember === '') {
			competitor.is_member = false;
			blankMembershipRows.push(rawName);
		} else {
			const parsed = parseMemberValue(rawMember);
			if (parsed === null) {
				warnings.push(
					`Row ${lineNum} (${rawName}): Unrecognized membership value "${rawMember}" — treated as non-member.`,
				);
				competitor.is_member = false;
			} else {
				competitor.is_member = parsed;
			}
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
				const key = `${event}|${raw.toLowerCase()}`;
				nonScoreCounts.set(key, (nonScoreCounts.get(key) ?? 0) + 1);
			} else if (DQ_VALUES.has(raw.toLowerCase())) {
				// Disqualification → 0 (penalty counts toward average)
				competitor[`${event}_earned`] = 0;
				dqCounts.set(event, (dqCounts.get(event) ?? 0) + 1);
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

	// Aggregate blank membership cells into a single count warning.
	if (blankMembershipRows.length > 0) {
		warnings.push(
			`${blankMembershipRows.length} row(s) had no membership value and will be saved as non-members.`,
		);
	}

	// Aggregated non-score warnings (e.g. "Distance: 3 row(s) marked DNS — excluded from average").
	for (const [key, count] of nonScoreCounts) {
		const [event, value] = key.split('|');
		warnings.push(
			`${event}: ${count} row(s) marked "${value.toUpperCase()}" — not scored (excluded from average).`,
		);
	}

	// Aggregated DQ warnings (counts as 0 in the average).
	for (const [event, count] of dqCounts) {
		warnings.push(
			`${event}: ${count} row(s) marked DQ — counted as 0 (penalty applied to average).`,
		);
	}

	if (competitors.length === 0) {
		errors.push('No valid competitor rows found after parsing.');
	}

	return {
		competitors,
		warnings,
		errors,
		missing_event_columns: missingEventColumns,
	};
}

module.exports = { parseCSV };
