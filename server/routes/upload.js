const path = require('path');
const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { parseCSV } = require('../db/csvParser');
const { EVENTS } = require('../constants/events');
const { isPlaceholderEmail } = require('../utils/competitorUtils');

const XLSX_EXTENSIONS = ['.xlsx', '.xls', '.ods'];

function xlsxToCsv(buffer) {
	const workbook = XLSX.read(buffer, { type: 'buffer' });
	const sheet = workbook.Sheets[workbook.SheetNames[0]];
	return XLSX.utils.sheet_to_csv(sheet);
}
const {
	ValidationError,
	ConflictError,
	NotFoundError,
	FileProcessingError,
	asyncHandler,
} = require('../middleware/errors');

/**
 * Rebuilds the placeholder-email warning, only including competitors who are
 * genuinely new to the system and have no real email. Existing competitors with
 * placeholder emails are already tracked in the admin panel — no need to re-warn
 * on every upload once they've been committed.
 */
function rebuildPlaceholderWarnings(warnings, enriched) {
	const nonPlaceholderWarnings = warnings.filter(
		(w) => !w.includes('placeholder emails were generated'),
	);
	const needsWarning = enriched.filter(
		(c) => isPlaceholderEmail(c.email) && c.is_new,
	);
	if (needsWarning.length === 0) return nonPlaceholderWarnings;
	return [
		...nonPlaceholderWarnings,
		`The following competitors had no email address — placeholder emails were generated. ` +
			`Update these in the admin panel: [${needsWarning.map((c) => c.name).join(', ')}]`,
	];
}

function createUploadRouter(db) {
	const router = express.Router();
	const upload = multer({
		storage: multer.memoryStorage(),
		limits: { fileSize: 5 * 1024 * 1024 },
	});

	/**
	 * POST /api/upload/preview
	 * Accepts a CSV file + tournament settings.
	 * Returns parsed competitors with computed scores, warnings, and errors.
	 * Does NOT write to the database.
	 */
	router.post(
		'/preview',
		authenticate,
		requireAdmin,
		upload.single('csv'),
		asyncHandler((req, res) => {
			if (!req.file) {
				throw new ValidationError('No file uploaded');
			}

			const ext = path.extname(req.file.originalname).toLowerCase();
			const isSpreadsheet = XLSX_EXTENSIONS.includes(ext);
			const csvText = isSpreadsheet
				? xlsxToCsv(req.file.buffer)
				: req.file.buffer.toString('utf-8');

			// Parse tournament settings from form fields
			const activeEvents = [];
			const totalPoints = {};

			for (const event of EVENTS) {
				if (
					req.body[`has_${event}`] === 'true' ||
					req.body[`has_${event}`] === true
				) {
					activeEvents.push(event);
				}
				totalPoints[event] =
					parseFloat(req.body[`total_points_${event}`]) || 120;
			}

			if (activeEvents.length === 0) {
				throw new ValidationError('At least one event must be selected');
			}

			const {
				competitors,
				warnings,
				errors,
				missing_event_columns: missingEventColumns = [],
				missing_required_columns: missingRequiredColumns = [],
			} = parseCSV(csvText, {
				activeEvents,
				totalPoints,
			});

			if (errors.length > 0) {
				throw new FileProcessingError('CSV parsing failed', {
					errors,
					warnings,
					missing_required_columns: missingRequiredColumns,
				});
			}

			// Enrich with existing scores so the admin can see what will change
			const enriched = competitors.map((c) => {
				let existing = null;

				// Try matching by email first (if competitor has email)
				if (c.email) {
					existing = db
						.prepare(
							'SELECT id, name, email, is_member FROM competitors WHERE LOWER(email) = LOWER(?)',
						)
						.get(c.email);
				}

				// If no email match, try name matching (fallback for existing competitors without email)
				if (!existing) {
					existing = db
						.prepare(
							'SELECT id, name, email, is_member FROM competitors WHERE LOWER(name) = LOWER(?)',
						)
						.get(c.name);
				}

				return {
					...c,
					existing_competitor_id: existing?.id ?? null,
					existing_name: existing?.name ?? null,
					existing_email: existing?.email ?? null,
					existing_is_member: existing ? existing.is_member === 1 : null,
					is_new: !existing,
					match_type: existing
						? c.email && existing.email
							? 'email'
							: 'name'
						: null,
				};
			});

			// Build membership-change diff so the admin can see who will be flipped
			const membershipChanges = enriched
				.filter(
					(c) =>
						!c.is_new &&
						typeof c.is_member === 'boolean' &&
						c.existing_is_member !== c.is_member,
				)
				.map((c) => ({
					name: c.name,
					email: c.email,
					before: c.existing_is_member,
					after: c.is_member,
				}));

			res.json({
				competitors: enriched,
				warnings: rebuildPlaceholderWarnings(warnings, enriched),
				errors: [],
				membership_changes: membershipChanges,
				missing_event_columns: missingEventColumns,
			});
		}),
	);

	/**
	 * POST /api/upload/commit
	 * Accepts tournament metadata + the parsed competitors array from /preview.
	 * Writes tournament + results to the database.
	 */
	router.post(
		'/commit',
		authenticate,
		requireAdmin,
		asyncHandler((req, res) => {
			const {
				tournament_name,
				tournament_date,
				activeEvents,
				totalPoints,
				competitors,
				replace_mode: replaceModeRaw,
			} = req.body;

			// Optional: if provided, attach results to this existing tournament instead of creating one
			const tournamentId =
				req.body.tournament_id != null
					? parseInt(req.body.tournament_id, 10)
					: null;
			const isExisting = tournamentId !== null && !isNaN(tournamentId);

			// replace_mode = true means: wipe existing tournament_results for this
			// tournament inside the same transaction, then insert from the payload.
			// Only meaningful on the existing-tournament path — a new tournament
			// has nothing to replace.
			const replaceMode = replaceModeRaw === true || replaceModeRaw === 'true';
			if (replaceMode && !isExisting) {
				throw new ValidationError(
					'replace_mode is only valid when tournament_id is supplied',
				);
			}

			if (!isExisting && !tournament_date) {
				throw new ValidationError('Tournament date is required');
			}
			if (!competitors?.length) {
				throw new ValidationError('No competitors provided');
			}

			// Validate totalPoints — needed when creating a new tournament,
			// and also when updating an existing tournament's totals (validated
			// lazily inside the isExisting branch below).
			const validatedPoints = {};
			if (!isExisting) {
				for (const event of EVENTS) {
					const val = parseFloat(totalPoints?.[event]);
					if (!isFinite(val) || val <= 0) {
						throw new ValidationError(
							`total_points_${event} must be a positive number`,
						);
					}
					validatedPoints[event] = val;
				}
			}

			// Validate each competitor field before writing
			for (const comp of competitors) {
				if (typeof comp.name !== 'string' || !comp.name.trim()) {
					throw new ValidationError('Invalid competitor name in payload');
				}
				for (const event of EVENTS) {
					const val = comp[`${event}_earned`];
					if (val !== null && val !== undefined) {
						if (typeof val !== 'number' || !isFinite(val) || val < 0) {
							throw new ValidationError(
								`Invalid ${event}_earned value for "${comp.name}"`,
							);
						}
					}
				}
			}

			const commitAll = db.transaction(() => {
				let finalTournamentId;

				if (isExisting) {
					// Verify the tournament exists
					const existing = db
						.prepare('SELECT id, name, date FROM tournaments WHERE id = ?')
						.get(tournamentId);
					if (!existing) {
						throw new NotFoundError(`Tournament ${tournamentId}`);
					}
					finalTournamentId = tournamentId;

					// Optionally update tournament metadata. Each field is updated
					// only when explicitly provided in the payload, so clients can
					// commit results without touching metadata (and vice versa, in
					// principle — though metadata-only commits are rejected up top
					// by the empty-competitors guard).
					const updates = [];
					const params = [];
					const hasNameUpdate = Object.prototype.hasOwnProperty.call(
						req.body,
						'tournament_name',
					);
					const hasDateUpdate = Object.prototype.hasOwnProperty.call(
						req.body,
						'tournament_date',
					);
					const hasEventsUpdate = Array.isArray(activeEvents);
					const hasTotalsUpdate =
						totalPoints != null && typeof totalPoints === 'object';

					if (hasNameUpdate) {
						updates.push('name = ?');
						params.push(tournament_name || null);
					}
					if (hasDateUpdate) {
						if (!tournament_date) {
							throw new ValidationError('Tournament date is required');
						}
						updates.push('date = ?');
						params.push(tournament_date);
					}
					if (hasEventsUpdate) {
						for (const event of EVENTS) {
							updates.push(`has_${event} = ?`);
							params.push(activeEvents.includes(event) ? 1 : 0);
						}
					}
					if (hasTotalsUpdate) {
						for (const event of EVENTS) {
							const val = parseFloat(totalPoints?.[event]);
							if (!isFinite(val) || val <= 0) {
								throw new ValidationError(
									`total_points_${event} must be a positive number`,
								);
							}
							validatedPoints[event] = val;
							updates.push(`total_points_${event} = ?`);
							params.push(val);
						}
					}

					// Duplicate name+date guard: only when name or date might collide.
					// Excludes self so an unchanged commit doesn't 409 against itself.
					if (hasNameUpdate || hasDateUpdate) {
						const targetName = hasNameUpdate
							? tournament_name || null
							: existing.name;
						const targetDate = hasDateUpdate ? tournament_date : existing.date;
						const duplicate = db
							.prepare(
								`SELECT id FROM tournaments
								 WHERE id != ? AND date = ? AND (name = ? OR (name IS NULL AND ? IS NULL))`,
							)
							.get(tournamentId, targetDate, targetName, targetName);
						if (duplicate) {
							throw new ConflictError(
								'A tournament with this name and date already exists.',
								{ tournament_id: duplicate.id },
							);
						}
					}

					if (updates.length > 0) {
						params.push(tournamentId);
						db.prepare(
							`UPDATE tournaments SET ${updates.join(', ')} WHERE id = ?`,
						).run(...params);
					}
				} else {
					// Check for duplicate tournament
					const duplicate = db
						.prepare(
							`SELECT id FROM tournaments WHERE date = ? AND (name = ? OR (name IS NULL AND ? IS NULL))`,
						)
						.get(
							tournament_date,
							tournament_name || null,
							tournament_name || null,
						);

					if (duplicate) {
						throw new ConflictError(
							'A tournament with this name and date already exists. Delete it first or use a different date.',
							{ tournament_id: duplicate.id },
						);
					}

					// Create tournament
					const tResult = db
						.prepare(
							`
        INSERT INTO tournaments
          (name, date, has_knockdowns, has_distance, has_speed, has_woods,
           total_points_knockdowns, total_points_distance, total_points_speed, total_points_woods)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
						)
						.run(
							tournament_name || null,
							tournament_date,
							activeEvents.includes('knockdowns') ? 1 : 0,
							activeEvents.includes('distance') ? 1 : 0,
							activeEvents.includes('speed') ? 1 : 0,
							activeEvents.includes('woods') ? 1 : 0,
							validatedPoints.knockdowns,
							validatedPoints.distance,
							validatedPoints.speed,
							validatedPoints.woods,
						);
					finalTournamentId = tResult.lastInsertRowid;
				}

				// Decide which event columns to populate on each result row. The
				// payload's activeEvents wins when present; for an existing
				// tournament with no activeEvents in the payload, fall back to the
				// tournament's stored has_<event> flags.
				let effectiveActiveEvents;
				if (Array.isArray(activeEvents)) {
					effectiveActiveEvents = activeEvents;
				} else {
					const row = db
						.prepare(
							`SELECT has_knockdowns, has_distance, has_speed, has_woods
							 FROM tournaments WHERE id = ?`,
						)
						.get(finalTournamentId);
					effectiveActiveEvents = EVENTS.filter((ev) => row[`has_${ev}`] === 1);
				}

				const inserted = [];
				const updated = [];

				// Replace mode — wipe existing rows for this tournament *inside the
				// same transaction* so a downstream failure rolls everything back
				// and the admin never sees an empty tournament.
				let replacedCount = 0;
				if (replaceMode && isExisting) {
					const delResult = db
						.prepare('DELETE FROM tournament_results WHERE tournament_id = ?')
						.run(finalTournamentId);
					replacedCount = delResult.changes;
				}

				for (const comp of competitors) {
					// All competitors now have email addresses (required by parser)
					let competitorId = comp.existing_competitor_id;

					// Default to member when the CSV lacked a membership column (parser sets
					// is_member=true in that case, but defend against malformed payloads).
					const isMemberFlag =
						typeof comp.is_member === 'boolean' ? (comp.is_member ? 1 : 0) : 1;

					if (!competitorId) {
						// Insert new competitor
						const cResult = db
							.prepare(
								'INSERT INTO competitors (name, email, is_member) VALUES (?, ?, ?)',
							)
							.run(comp.name, comp.email, isMemberFlag);
						competitorId = cResult.lastInsertRowid;
						inserted.push(comp.name);
					} else {
						// Update existing competitor's name and membership if either changed
						if (comp.name !== comp.existing_name) {
							db.prepare('UPDATE competitors SET name = ? WHERE id = ?').run(
								comp.name,
								competitorId,
							);
						}
						db.prepare(
							'UPDATE competitors SET is_member = ? WHERE id = ? AND is_member != ?',
						).run(isMemberFlag, competitorId, isMemberFlag);
						updated.push(comp.name);
					}

					// Insert or update result (upsert handles re-uploads to the same tournament)
					db.prepare(
						`
          INSERT INTO tournament_results
            (competitor_id, tournament_id, knockdowns_earned, distance_earned, speed_earned, woods_earned)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(competitor_id, tournament_id) DO UPDATE SET
            knockdowns_earned = excluded.knockdowns_earned,
            distance_earned = excluded.distance_earned,
            speed_earned = excluded.speed_earned,
            woods_earned = excluded.woods_earned
        `,
					).run(
						competitorId,
						finalTournamentId,
						effectiveActiveEvents.includes('knockdowns')
							? (comp.knockdowns_earned ?? null)
							: null,
						effectiveActiveEvents.includes('distance')
							? (comp.distance_earned ?? null)
							: null,
						effectiveActiveEvents.includes('speed')
							? (comp.speed_earned ?? null)
							: null,
						effectiveActiveEvents.includes('woods')
							? (comp.woods_earned ?? null)
							: null,
					);
				}

				return {
					tournamentId: finalTournamentId,
					inserted,
					updated,
					replacedCount,
				};
			});

			const result = commitAll();
			res.status(201).json({
				success: true,
				tournament_id: result.tournamentId,
				new_competitors: result.inserted,
				updated_competitors: result.updated,
				replace_mode: replaceMode,
				replaced_count: result.replacedCount,
			});
		}),
	);

	return router;
}

module.exports = createUploadRouter;
