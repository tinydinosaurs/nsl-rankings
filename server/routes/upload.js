const express = require('express');
const multer = require('multer');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const { parseCSV } = require('../db/csvParser');
const { EVENTS } = require('../constants/events');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/**
 * POST /api/upload/preview
 * Accepts a CSV file + tournament settings.
 * Returns parsed competitors with computed scores, warnings, and errors.
 * Does NOT write to the database.
 */
router.post('/preview', requireAdmin, upload.single('csv'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });

  const csvText = req.file.buffer.toString('utf-8');

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
    return res.status(400).json({ error: 'At least one event must be selected' });
  }

  const { competitors, warnings, errors } = parseCSV(csvText, { activeEvents, totalPoints });

  if (errors.length > 0) {
    return res.status(422).json({ errors, warnings, competitors: [] });
  }

  // Enrich with existing scores so the admin can see what will change
  const enriched = competitors.map(c => {
    const existing = db.prepare('SELECT id, name FROM competitors WHERE LOWER(name) = LOWER(?)').get(c.name);
    return {
      ...c,
      existing_competitor_id: existing?.id ?? null,
      is_new: !existing,
    };
  });

  res.json({ competitors: enriched, warnings, errors: [] });
});

/**
 * POST /api/upload/commit
 * Accepts tournament metadata + the parsed competitors array from /preview.
 * Writes tournament + results to the database.
 */
router.post('/commit', requireAdmin, (req, res) => {
  const {
    tournament_name, tournament_date,
    activeEvents, totalPoints,
    competitors,
  } = req.body;

  if (!tournament_date) return res.status(400).json({ error: 'Tournament date is required' });
  if (!competitors?.length) return res.status(400).json({ error: 'No competitors provided' });

  // Check for duplicate tournament
  const duplicate = db.prepare(
    `SELECT id FROM tournaments WHERE date = ? AND (name = ? OR (name IS NULL AND ? IS NULL))`
  ).get(tournament_date, tournament_name || null, tournament_name || null);

  if (duplicate) {
    return res.status(409).json({
      error: 'A tournament with this name and date already exists. Delete it first or use a different date.',
      tournament_id: duplicate.id,
    });
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
      // Upsert competitor by name
      let competitorId = comp.existing_competitor_id;
      if (!competitorId) {
        const cResult = db.prepare('INSERT INTO competitors (name) VALUES (?)').run(comp.name);
        competitorId = cResult.lastInsertRowid;
        inserted.push(comp.name);
      } else {
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
});

module.exports = router;
