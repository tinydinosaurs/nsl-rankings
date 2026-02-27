const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { computeRankings, getCompetitorHistory, computeCompetitorScores } = require('../db/rankings');
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

// GET /api/rankings/competitors — enhanced list with scores, counts, and filtering
router.get('/competitors', authenticate, (req, res) => {
  const { filter } = req.query; // 'placeholder-emails' for filtering
  
  // Get all competitors with email status
  const competitors = db.prepare(`
    SELECT 
      id, 
      name, 
      email,
      created_at,
      CASE 
        WHEN email IS NULL OR email LIKE '%.nsl@placeholder.local' THEN 1
        ELSE 0
      END as has_placeholder_email
    FROM competitors 
    ORDER BY name
  `).all();
  
  // Enhance with scores and tournament counts
  const enhancedCompetitors = competitors.map(competitor => {
    // Get total score using existing function
    const scores = computeCompetitorScores(competitor.id, db);
    
    // Count tournaments attended
    const tournamentCount = db.prepare(`
      SELECT COUNT(DISTINCT tournament_id) as count
      FROM tournament_results 
      WHERE competitor_id = ?
    `).get(competitor.id)?.count || 0;
    
    return {
      id: competitor.id,
      name: competitor.name,
      email: competitor.email,
      has_placeholder_email: Boolean(competitor.has_placeholder_email),
      total_score: scores.total,
      tournament_count: tournamentCount,
      created_at: competitor.created_at
    };
  });
  
  // Apply filtering if requested
  let filteredCompetitors = enhancedCompetitors;
  if (filter === 'placeholder-emails') {
    filteredCompetitors = enhancedCompetitors.filter(c => c.has_placeholder_email);
  }
  
  res.json(filteredCompetitors);
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

// GET /api/rankings/tournaments — enhanced list with participant counts and event info
router.get('/tournaments', authenticate, (req, res) => {
  const tournaments = db.prepare('SELECT * FROM tournaments ORDER BY date DESC').all();
  
  // Enhance with participant counts and active events summary
  const enhancedTournaments = tournaments.map(tournament => {
    // Count participants
    const participantCount = db.prepare(
      'SELECT COUNT(*) as count FROM tournament_results WHERE tournament_id = ?'
    ).get(tournament.id)?.count || 0;
    
    // Create active events array
    const activeEvents = [];
    if (tournament.has_knockdowns) activeEvents.push('knockdowns');
    if (tournament.has_distance) activeEvents.push('distance');
    if (tournament.has_speed) activeEvents.push('speed');
    if (tournament.has_woods) activeEvents.push('woods');
    
    return {
      ...tournament,
      participant_count: participantCount,
      active_events: activeEvents,
      active_event_count: activeEvents.length
    };
  });
  
  res.json(enhancedTournaments);
});

// GET /api/rankings/tournaments/:id — tournament detail with participant roster
router.get('/tournaments/:id', 
  authenticate,
  asyncHandler((req, res) => {
    // Get tournament info
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) {
      throw new NotFoundError('Tournament');
    }

    // Get all participants with their results for this tournament
    const participants = db.prepare(`
      SELECT 
        tr.id as result_id,
        tr.competitor_id,
        c.name as competitor_name,
        c.email as competitor_email,
        tr.knockdowns_earned,
        tr.distance_earned,
        tr.speed_earned,
        tr.woods_earned
      FROM tournament_results tr
      JOIN competitors c ON c.id = tr.competitor_id
      WHERE tr.tournament_id = ?
      ORDER BY c.name
    `).all(req.params.id);

    // Calculate event scores for each participant
    const participantsWithScores = participants.map(p => {
      const scores = {};
      
      // Calculate percentage scores for each active event
      if (tournament.has_knockdowns && p.knockdowns_earned !== null) {
        scores.knockdowns_score = (p.knockdowns_earned / tournament.total_points_knockdowns) * 100;
      }
      if (tournament.has_distance && p.distance_earned !== null) {
        scores.distance_score = (p.distance_earned / tournament.total_points_distance) * 100;
      }
      if (tournament.has_speed && p.speed_earned !== null) {
        scores.speed_score = (p.speed_earned / tournament.total_points_speed) * 100;
      }
      if (tournament.has_woods && p.woods_earned !== null) {
        scores.woods_score = (p.woods_earned / tournament.total_points_woods) * 100;
      }

      return {
        ...p,
        scores
      };
    });

    res.json({
      tournament,
      participants: participantsWithScores,
      participant_count: participantsWithScores.length
    });
  })
);

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

// PUT /api/rankings/tournaments/:id — admin edits tournament metadata
router.put('/tournaments/:id',
  requireAdmin,
  asyncHandler((req, res) => {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) {
      throw new NotFoundError('Tournament');
    }

    const {
      name,
      date,
      has_knockdowns,
      has_distance,
      has_speed,
      has_woods,
      total_points_knockdowns,
      total_points_distance,
      total_points_speed,
      total_points_woods
    } = req.body;

    // Validate required fields
    if (date !== undefined && !date) {
      throw new ValidationError('Date cannot be null or empty');
    }

    // Always check for duplicates using current values as fallback for unchanged fields
    const checkName = name !== undefined ? name || null : tournament.name;
    const checkDate = date !== undefined ? date : tournament.date;
    const duplicate = db
      .prepare(
        'SELECT id FROM tournaments WHERE date = ? AND name = ? AND id != ?',
      )
      .get(checkDate, checkName, req.params.id);
    if (duplicate) {
      throw new ConflictError(
        'Another tournament with this name and date already exists',
        { tournament_id: duplicate.id }
      );
    }

    // Build update query dynamically based on provided fields
    const updates = [];
    const values = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name || null);
    }
    if (date !== undefined) {
      updates.push('date = ?');
      values.push(date);
    }
    if (has_knockdowns !== undefined) {
      updates.push('has_knockdowns = ?');
      values.push(has_knockdowns ? 1 : 0);
    }
    if (has_distance !== undefined) {
      updates.push('has_distance = ?');
      values.push(has_distance ? 1 : 0);
    }
    if (has_speed !== undefined) {
      updates.push('has_speed = ?');
      values.push(has_speed ? 1 : 0);
    }
    if (has_woods !== undefined) {
      updates.push('has_woods = ?');
      values.push(has_woods ? 1 : 0);
    }
    if (total_points_knockdowns !== undefined) {
      updates.push('total_points_knockdowns = ?');
      values.push(total_points_knockdowns);
    }
    if (total_points_distance !== undefined) {
      updates.push('total_points_distance = ?');
      values.push(total_points_distance);
    }
    if (total_points_speed !== undefined) {
      updates.push('total_points_speed = ?');
      values.push(total_points_speed);
    }
    if (total_points_woods !== undefined) {
      updates.push('total_points_woods = ?');
      values.push(total_points_woods);
    }

    if (updates.length === 0) {
      throw new ValidationError('No valid fields provided for update');
    }

    // Perform the update
    values.push(req.params.id);
    const query = `UPDATE tournaments SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values);

    // Return updated tournament
    const updatedTournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    res.json(updatedTournament);
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

    // Fetch and return the created/updated result
    const savedResult = db.prepare(
      'SELECT * FROM tournament_results WHERE competitor_id = ? AND tournament_id = ?'
    ).get(competitor_id, tournament_id);

    res.json({ success: true, result: savedResult });
  })
);

// PUT /api/rankings/results/:id — admin edits an individual result
router.put('/results/:id',
  requireAdmin,
  asyncHandler((req, res) => {
    const { knockdowns_earned, distance_earned, speed_earned, woods_earned } = req.body;
    
    // Get the existing result
    const result = db.prepare('SELECT * FROM tournament_results WHERE id = ?').get(req.params.id);
    if (!result) {
      throw new NotFoundError('Tournament result');
    }

    // Validate that the tournament still exists
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(result.tournament_id);
    if (!tournament) {
      throw new NotFoundError('Tournament');
    }

    // Update the result with new scores
    db.prepare(`
      UPDATE tournament_results SET
        knockdowns_earned = ?,
        distance_earned = ?,
        speed_earned = ?,
        woods_earned = ?
      WHERE id = ?
    `).run(
      knockdowns_earned !== undefined
        ? knockdowns_earned
        : result.knockdowns_earned,
      distance_earned !== undefined ? distance_earned : result.distance_earned,
      speed_earned !== undefined ? speed_earned : result.speed_earned,
      woods_earned !== undefined ? woods_earned : result.woods_earned,
      req.params.id
    );

    // Return the updated result with competitor/tournament info for context
    const updatedResult = db.prepare(`
      SELECT 
        tr.id,
        tr.competitor_id,
        tr.tournament_id,
        tr.knockdowns_earned,
        tr.distance_earned,
        tr.speed_earned,
        tr.woods_earned,
        c.name as competitor_name,
        t.name as tournament_name,
        t.date as tournament_date
      FROM tournament_results tr
      JOIN competitors c ON tr.competitor_id = c.id
      JOIN tournaments t ON tr.tournament_id = t.id
      WHERE tr.id = ?
    `).get(req.params.id);

    res.json(updatedResult);
  })
);

// DELETE /api/rankings/results/:id — admin deletes an individual result
router.delete('/results/:id',
  requireAdmin,
  asyncHandler((req, res) => {
    // Get the result info before deleting for response context
    const result = db.prepare(`
      SELECT 
        tr.id,
        tr.competitor_id,
        tr.tournament_id,
        c.name as competitor_name,
        t.name as tournament_name,
        t.date as tournament_date
      FROM tournament_results tr
      JOIN competitors c ON tr.competitor_id = c.id
      JOIN tournaments t ON tr.tournament_id = t.id
      WHERE tr.id = ?
    `).get(req.params.id);
    
    if (!result) {
      throw new NotFoundError('Tournament result');
    }

    // Delete the result
    db.prepare('DELETE FROM tournament_results WHERE id = ?').run(req.params.id);

    res.json({ 
      success: true, 
      deleted: {
        id: result.id,
        competitor_name: result.competitor_name,
        tournament_name: result.tournament_name,
        tournament_date: result.tournament_date
      }
    });
  })
);

  return router;
}

module.exports = createRankingsRouter;
