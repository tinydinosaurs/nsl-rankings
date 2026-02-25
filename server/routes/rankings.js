const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { computeRankings, getCompetitorHistory } = require('../db/rankings');
const { 
  NotFoundError, 
  ValidationError, 
  ConflictError,
  asyncHandler 
} = require('../middleware/errors');

function createRankingsRouter(db) {
const router = express.Router();

// GET /api/rankings — authenticated rankings table  
router.get('/', authenticate, (req, res) => {
  const rankings = computeRankings(db);
  res.json(rankings);
});

// GET /api/rankings/public — public rankings table (no auth required)
router.get('/public', (req, res) => {
  const rankings = computeRankings(db);
  res.json(rankings);
});

// GET /api/rankings/competitors — list all competitors
router.get('/competitors', authenticate, (req, res) => {
  const competitors = db.prepare('SELECT id, name, email, created_at FROM competitors ORDER BY name').all();
  res.json(competitors);
});

// GET /api/rankings/competitors/:id — competitor detail with history
router.get('/competitors/:id', 
  authenticate, 
  asyncHandler((req, res) => {
    const competitor = db.prepare('SELECT id, name, email FROM competitors WHERE id = ?').get(req.params.id);
    if (!competitor) {
      throw new NotFoundError('Competitor');
    }

    const history = getCompetitorHistory(competitor.id, db);
    res.json({ ...competitor, history });
  })
);

// POST /api/rankings/competitors — admin adds a competitor
router.post('/competitors', 
  requireAdmin, 
  asyncHandler((req, res) => {
    const { name, email } = req.body;
    if (!name?.trim()) {
      throw new ValidationError('Name is required');
    }

    const trimmedName = name.trim();
    const trimmedEmail = email?.trim() || null;

    // Check for duplicate email (if provided)
    if (trimmedEmail) {
      const existingEmail = db.prepare('SELECT id FROM competitors WHERE LOWER(email) = LOWER(?)').get(trimmedEmail);
      if (existingEmail) {
        throw new ConflictError('Competitor with this email already exists', { id: existingEmail.id });
      }
    }

    // Check for duplicate name (case-insensitive)
    const existingName = db.prepare('SELECT id FROM competitors WHERE LOWER(name) = LOWER(?)').get(trimmedName);
    if (existingName) {
      throw new ConflictError('Competitor with this name already exists', { id: existingName.id });
    }

    const result = db.prepare('INSERT INTO competitors (name, email) VALUES (?, ?)').run(trimmedName, trimmedEmail);
    res.status(201).json({ id: result.lastInsertRowid, name: trimmedName, email: trimmedEmail });
  })
);

// PUT /api/rankings/competitors/:id — admin edits competitor
router.put('/competitors/:id', 
  requireAdmin, 
  asyncHandler((req, res) => {
    const { name, email } = req.body;
    if (!name?.trim()) {
      throw new ValidationError('Name is required');
    }

    const competitor = db.prepare('SELECT id, name, email FROM competitors WHERE id = ?').get(req.params.id);
    if (!competitor) {
      throw new NotFoundError('Competitor');
    }

    const trimmedName = name.trim();
    const trimmedEmail = email?.trim() || null;

    // Check for duplicate email (if provided and different from current)
    if (trimmedEmail && trimmedEmail.toLowerCase() !== competitor.email?.toLowerCase()) {
      const existingEmail = db.prepare('SELECT id FROM competitors WHERE LOWER(email) = LOWER(?) AND id != ?').get(trimmedEmail, req.params.id);
      if (existingEmail) {
        throw new ConflictError('Another competitor with this email already exists', { id: existingEmail.id });
      }
    }

    // Check for duplicate name (if different from current)
    if (trimmedName.toLowerCase() !== competitor.name.toLowerCase()) {
      const existingName = db.prepare('SELECT id FROM competitors WHERE LOWER(name) = LOWER(?) AND id != ?').get(trimmedName, req.params.id);
      if (existingName) {
        throw new ConflictError('Another competitor with this name already exists', { id: existingName.id });
      }
    }

    db.prepare('UPDATE competitors SET name = ?, email = ? WHERE id = ?').run(trimmedName, trimmedEmail, req.params.id);
    res.json({ id: parseInt(req.params.id), name: trimmedName, email: trimmedEmail });
  })
);

// DELETE /api/rankings/competitors/:id — admin deletes competitor and all results
router.delete('/competitors/:id', 
  requireAdmin, 
  asyncHandler((req, res) => {
    const competitor = db.prepare('SELECT id FROM competitors WHERE id = ?').get(req.params.id);
    if (!competitor) {
      throw new NotFoundError('Competitor');
    }

    db.prepare('DELETE FROM competitors WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  })
);

// GET /api/rankings/tournaments — list tournaments
router.get('/tournaments', authenticate, (req, res) => {
  const tournaments = db.prepare('SELECT * FROM tournaments ORDER BY date DESC').all();
  res.json(tournaments);
});

// POST /api/rankings/tournaments — admin creates tournament manually
router.post('/tournaments', 
  requireAdmin, 
  asyncHandler((req, res) => {
    const {
      name, date,
      has_knockdowns = 1, has_distance = 1, has_speed = 1, has_woods = 1,
      total_points_knockdowns = 120, total_points_distance = 120,
      total_points_speed = 120, total_points_woods = 120,
    } = req.body;

    if (!date) {
      throw new ValidationError('Date is required');
    }
    if (name !== undefined && name !== null && !date) {
      throw new ValidationError('A tournament with a name must also have a date');
    }

    // Warn if duplicate name+date
    const duplicate = db.prepare(
      'SELECT id FROM tournaments WHERE date = ? AND (name = ? OR (name IS NULL AND ? IS NULL))'
    ).get(date, name || null, name || null);
    if (duplicate) {
      throw new ConflictError(
        'A tournament with this name and date already exists',
        { tournament_id: duplicate.id }
      );
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
  })
);

// DELETE /api/rankings/tournaments/:id — admin deletes tournament and all its results
router.delete('/tournaments/:id', 
  requireAdmin, 
  asyncHandler((req, res) => {
    const t = db.prepare('SELECT id FROM tournaments WHERE id = ?').get(req.params.id);
    if (!t) {
      throw new NotFoundError('Tournament');
    }
    db.prepare('DELETE FROM tournaments WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  })
);

// POST /api/rankings/results — admin adds/updates a single result manually
router.post('/results', 
  requireAdmin, 
  asyncHandler((req, res) => {
    const { competitor_id, tournament_id, knockdowns_earned, distance_earned, speed_earned, woods_earned } = req.body;

    if (!competitor_id || !tournament_id) {
      throw new ValidationError('competitor_id and tournament_id are required');
    }

    const competitor = db.prepare('SELECT id FROM competitors WHERE id = ?').get(competitor_id);
    if (!competitor) {
      throw new NotFoundError('Competitor');
    }

    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournament_id);
    if (!tournament) {
      throw new NotFoundError('Tournament');
    }

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
  })
);

  return router;
}

module.exports = createRankingsRouter;
