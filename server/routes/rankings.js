const express = require('express');
const db = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { computeRankings, getCompetitorHistory } = require('../db/rankings');

const router = express.Router();

// GET /api/rankings — public rankings table
router.get('/', authenticate, (req, res) => {
  const rankings = computeRankings();
  res.json(rankings);
});

// GET /api/rankings/competitors — list all competitors
router.get('/competitors', authenticate, (req, res) => {
  const competitors = db.prepare('SELECT id, name, created_at FROM competitors ORDER BY name').all();
  res.json(competitors);
});

// GET /api/rankings/competitors/:id — competitor detail with history
router.get('/competitors/:id', authenticate, (req, res) => {
  const competitor = db.prepare('SELECT id, name FROM competitors WHERE id = ?').get(req.params.id);
  if (!competitor) return res.status(404).json({ error: 'Competitor not found' });

  const history = getCompetitorHistory(competitor.id);
  res.json({ ...competitor, history });
});

// POST /api/rankings/competitors — admin adds a competitor
router.post('/competitors', requireAdmin, (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });

  // Check for duplicate (case-insensitive)
  const existing = db.prepare('SELECT id FROM competitors WHERE LOWER(name) = LOWER(?)').get(name.trim());
  if (existing) return res.status(409).json({ error: 'Competitor with this name already exists', id: existing.id });

  const result = db.prepare('INSERT INTO competitors (name) VALUES (?)').run(name.trim());
  res.status(201).json({ id: result.lastInsertRowid, name: name.trim() });
});

// PUT /api/rankings/competitors/:id — admin edits competitor name
router.put('/competitors/:id', requireAdmin, (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });

  const competitor = db.prepare('SELECT id FROM competitors WHERE id = ?').get(req.params.id);
  if (!competitor) return res.status(404).json({ error: 'Competitor not found' });

  db.prepare('UPDATE competitors SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
  res.json({ id: parseInt(req.params.id), name: name.trim() });
});

// DELETE /api/rankings/competitors/:id — admin deletes competitor and all results
router.delete('/competitors/:id', requireAdmin, (req, res) => {
  const competitor = db.prepare('SELECT id FROM competitors WHERE id = ?').get(req.params.id);
  if (!competitor) return res.status(404).json({ error: 'Competitor not found' });

  db.prepare('DELETE FROM competitors WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/rankings/tournaments — list tournaments
router.get('/tournaments', authenticate, (req, res) => {
  const tournaments = db.prepare('SELECT * FROM tournaments ORDER BY date DESC').all();
  res.json(tournaments);
});

// POST /api/rankings/tournaments — admin creates tournament manually
router.post('/tournaments', requireAdmin, (req, res) => {
  const {
    name, date,
    has_knockdowns = 1, has_distance = 1, has_speed = 1, has_woods = 1,
    total_points_knockdowns = 120, total_points_distance = 120,
    total_points_speed = 120, total_points_woods = 120,
  } = req.body;

  if (!date) return res.status(400).json({ error: 'Date is required' });
  if (name !== undefined && name !== null && !date) {
    return res.status(400).json({ error: 'A tournament with a name must also have a date' });
  }

  // Warn if duplicate name+date
  const duplicate = db.prepare(
    'SELECT id FROM tournaments WHERE date = ? AND (name = ? OR (name IS NULL AND ? IS NULL))'
  ).get(date, name || null, name || null);
  if (duplicate) {
    return res.status(409).json({
      error: 'A tournament with this name and date already exists',
      tournament_id: duplicate.id,
    });
  }

  const result = db.prepare(`
    INSERT INTO tournaments
      (name, date, has_knockdowns, has_distance, has_speed, has_woods,
       total_points_knockdowns, total_points_distance, total_points_speed, total_points_woods)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name || null, date,
    has_knockdowns ? 1 : 0, has_distance ? 1 : 0, has_speed ? 1 : 0, has_woods ? 1 : 0,
    total_points_knockdowns, total_points_distance, total_points_speed, total_points_woods
  );

  res.status(201).json({ id: result.lastInsertRowid });
});

// DELETE /api/rankings/tournaments/:id — admin deletes tournament and all its results
router.delete('/tournaments/:id', requireAdmin, (req, res) => {
  const t = db.prepare('SELECT id FROM tournaments WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Tournament not found' });
  db.prepare('DELETE FROM tournaments WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/rankings/results — admin adds/updates a single result manually
router.post('/results', requireAdmin, (req, res) => {
  const { competitor_id, tournament_id, knockdowns_earned, distance_earned, speed_earned, woods_earned } = req.body;

  if (!competitor_id || !tournament_id) {
    return res.status(400).json({ error: 'competitor_id and tournament_id required' });
  }

  const competitor = db.prepare('SELECT id FROM competitors WHERE id = ?').get(competitor_id);
  if (!competitor) return res.status(404).json({ error: 'Competitor not found' });

  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournament_id);
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

  db.prepare(`
    INSERT INTO tournament_results
      (competitor_id, tournament_id, knockdowns_earned, distance_earned, speed_earned, woods_earned)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(competitor_id, tournament_id) DO UPDATE SET
      knockdowns_earned = excluded.knockdowns_earned,
      distance_earned = excluded.distance_earned,
      speed_earned = excluded.speed_earned,
      woods_earned = excluded.woods_earned
  `).run(
    competitor_id, tournament_id,
    knockdowns_earned ?? null, distance_earned ?? null,
    speed_earned ?? null, woods_earned ?? null
  );

  res.json({ success: true });
});

module.exports = router;
