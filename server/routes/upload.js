const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { requireAdmin } = require('../middleware/auth');
const { parseCSV } = require('../db/csvParser');
const { EVENTS } = require('../constants/events');

const XLSX_EXTENSIONS = ['.xlsx', '.xls', '.ods'];

function xlsxToCsv(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_csv(sheet);
}
const { 
  ValidationError, 
  ConflictError, 
  FileProcessingError,
  asyncHandler 
} = require('../middleware/errors');

function createUploadRouter(db) {
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/**
 * POST /api/upload/preview
 * Accepts a CSV file + tournament settings.
 * Returns parsed competitors with computed scores, warnings, and errors.
 * Does NOT write to the database.
 */
router.post('/preview', 
  requireAdmin, 
  upload.single('csv'), 
  asyncHandler((req, res) => {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const ext = require('path').extname(req.file.originalname).toLowerCase();
    const isSpreadsheet = XLSX_EXTENSIONS.includes(ext);
    const csvText = isSpreadsheet
      ? xlsxToCsv(req.file.buffer)
      : req.file.buffer.toString('utf-8');

    // Parse tournament settings from form fields
    const activeEvents = [];
    const totalPoints = {};

    for (const event of EVENTS) {
      if (req.body[`has_${event}`] === 'true' || req.body[`has_${event}`] === true) {
        activeEvents.push(event);
      }
      totalPoints[event] = parseFloat(req.body[`total_points_${event}`]) || 120;
    }

    if (activeEvents.length === 0) {
      throw new ValidationError('At least one event must be selected');
    }

    const { competitors, warnings, errors } = parseCSV(csvText, { activeEvents, totalPoints });

    if (errors.length > 0) {
      throw new FileProcessingError('CSV parsing failed', { errors, warnings });
    }

    // Enrich with existing scores so the admin can see what will change
    const enriched = competitors.map(c => {
      let existing = null;
      
      // Try matching by email first (if competitor has email)
      if (c.email) {
        existing = db.prepare('SELECT id, name, email FROM competitors WHERE LOWER(email) = LOWER(?)').get(c.email);
      }
      
      // If no email match, try name matching (fallback for existing competitors without email)
      if (!existing) {
        existing = db.prepare('SELECT id, name, email FROM competitors WHERE LOWER(name) = LOWER(?)').get(c.name);
      }
      
      return {
        ...c,
        existing_competitor_id: existing?.id ?? null,
        existing_name: existing?.name ?? null,
        existing_email: existing?.email ?? null,
        is_new: !existing,
        match_type: existing ? (c.email && existing.email ? 'email' : 'name') : null,
      };
    });

    // Suppress placeholder-email warnings for competitors who matched an existing record with a real email
    const emailsWithRealMatch = new Set(
      enriched
        .filter(c => c.existing_email && !c.existing_email.endsWith('.nsl@placeholder.local'))
        .map(c => c.email?.toLowerCase())
    );
    const filteredWarnings = warnings.filter(w => {
      // The placeholder warning lists names; check if any suppressed competitor is mentioned
      if (!w.includes('placeholder emails were generated')) return true;
      // Rebuild the warning excluding names that already have a real email on record
      return false; // handled below
    });

    // Rebuild the placeholder warning without names that matched real emails
    const suppressedEmails = emailsWithRealMatch;
    const placeholderWarning = warnings.find(w => w.includes('placeholder emails were generated'));
    if (placeholderWarning) {
      const remaining = enriched
        .filter(c => c.email?.endsWith('.nsl@placeholder.local') && !suppressedEmails.has(c.email?.toLowerCase()))
        // only those that are truly new or matched another placeholder
        .filter(c => !c.existing_email || c.existing_email.endsWith('.nsl@placeholder.local'))
        .map(c => c.name);
      if (remaining.length > 0) {
        filteredWarnings.push(
          `The following competitors had no email address — placeholder emails were generated. Update these in the admin panel: [${remaining.join(', ')}]`
        );
      }
    }

    res.json({ competitors: enriched, warnings: filteredWarnings, errors: [] });
  })
);

/**
 * POST /api/upload/commit
 * Accepts tournament metadata + the parsed competitors array from /preview.
 * Writes tournament + results to the database.
 */
router.post('/commit', 
  requireAdmin, 
  asyncHandler((req, res) => {
    const {
      tournament_name, tournament_date,
      activeEvents, totalPoints,
      competitors,
    } = req.body;

    if (!tournament_date) {
      throw new ValidationError('Tournament date is required');
    }
    if (!competitors?.length) {
      throw new ValidationError('No competitors provided');
    }

    // Check for duplicate tournament
    const duplicate = db.prepare(
      `SELECT id FROM tournaments WHERE date = ? AND (name = ? OR (name IS NULL AND ? IS NULL))`
    ).get(tournament_date, tournament_name || null, tournament_name || null);

    if (duplicate) {
      throw new ConflictError(
        'A tournament with this name and date already exists. Delete it first or use a different date.',
        { tournament_id: duplicate.id }
      );
    }

    const commitAll = db.transaction(() => {
      // Create tournament
      const tResult = db.prepare(`
        INSERT INTO tournaments
          (name, date, has_knockdowns, has_distance, has_speed, has_woods,
           total_points_knockdowns, total_points_distance, total_points_speed, total_points_woods)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        tournament_name || null,
        tournament_date,
        activeEvents.includes('knockdowns') ? 1 : 0,
        activeEvents.includes('distance') ? 1 : 0,
        activeEvents.includes('speed') ? 1 : 0,
        activeEvents.includes('woods') ? 1 : 0,
        totalPoints.knockdowns ?? 120,
        totalPoints.distance ?? 120,
        totalPoints.speed ?? 120,
        totalPoints.woods ?? 120,
      );

      const tournamentId = tResult.lastInsertRowid;
      const inserted = [];
      const updated = [];

      for (const comp of competitors) {
        // All competitors now have email addresses (required by parser)
        let competitorId = comp.existing_competitor_id;
        
        if (!competitorId) {
          // Insert new competitor
          const cResult = db.prepare('INSERT INTO competitors (name, email) VALUES (?, ?)').run(
            comp.name, 
            comp.email
          );
          competitorId = cResult.lastInsertRowid;
          inserted.push(comp.name);
        } else {
          // Update existing competitor's name if it's different
          if (comp.name !== comp.existing_name) {
            db.prepare('UPDATE competitors SET name = ? WHERE id = ?').run(comp.name, competitorId);
          }
          updated.push(comp.name);
        }

        // Insert result (null for inactive events)
        db.prepare(`
          INSERT INTO tournament_results
            (competitor_id, tournament_id, knockdowns_earned, distance_earned, speed_earned, woods_earned)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          competitorId,
          tournamentId,
          activeEvents.includes('knockdowns') ? (comp.knockdowns_earned ?? null) : null,
          activeEvents.includes('distance') ? (comp.distance_earned ?? null) : null,
          activeEvents.includes('speed') ? (comp.speed_earned ?? null) : null,
          activeEvents.includes('woods') ? (comp.woods_earned ?? null) : null,
        );
      }

      return { tournamentId, inserted, updated };
    });

    const result = commitAll();
    res.status(201).json({
      success: true,
      tournament_id: result.tournamentId,
      new_competitors: result.inserted,
      updated_competitors: result.updated,
    });
  })
);

  return router;
}

module.exports = createUploadRouter;
