const db = require('./database');
const { EVENTS } = require('../constants/events');

/**
 * Compute a single event score for one competitor.
 * Returns the average of (earned / total * 100) across all tournaments
 * where that event was present (has_<event> = 1 AND earned is not null).
 */
function computeEventScore(competitorId, event, dbInstance = db) {
	const rows = dbInstance
		.prepare(
			`
    SELECT
      tr.${event}_earned AS earned,
      t.total_points_${event} AS total
    FROM tournament_results tr
    JOIN tournaments t ON t.id = tr.tournament_id
    WHERE tr.competitor_id = ?
      AND t.has_${event} = 1
      AND tr.${event}_earned IS NOT NULL
  `,
		)
		.all(competitorId);

	if (rows.length === 0) return null;

	const scores = rows.map((r) => (r.earned / r.total) * 100);
	return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/**
 * Compute all scores for a single competitor.
 * Returns { knockdowns, distance, speed, woods, total }
 * Missing events are null individually but treated as 0 in total.
 */
function computeCompetitorScores(competitorId, dbInstance = db) {
	const scores = {};
	for (const event of EVENTS) {
		scores[event] = computeEventScore(competitorId, event, dbInstance);
	}

	// Total is always / 4, null events count as 0
	const total = EVENTS.reduce((sum, e) => sum + (scores[e] ?? 0), 0) / 4;
	scores.total = total;

	return scores;
}

/**
 * Compute full rankings: all competitors with their scores, sorted by total desc.
 */
function computeRankings(dbInstance = db) {
	const competitors = dbInstance
		.prepare('SELECT id, name FROM competitors ORDER BY name')
		.all();

	const rankings = competitors.map((c) => {
		const scores = computeCompetitorScores(c.id, dbInstance);
		return {
			id: c.id,
			name: c.name,
			...scores,
		};
	});

	// Sort by total score descending
	rankings.sort((a, b) => b.total - a.total);

	// Assign rank (ties share the same rank)
	let rank = 1;
	for (let i = 0; i < rankings.length; i++) {
		if (i > 0 && rankings[i].total !== rankings[i - 1].total) {
			rank = i + 1;
		}
		rankings[i].rank = rank;
	}

	return rankings;
}

/**
 * Get full tournament history for a single competitor.
 */
function getCompetitorHistory(competitorId, dbInstance = db) {
	const results = dbInstance
		.prepare(
			`
    SELECT
      t.id AS tournament_id,
      t.name AS tournament_name,
      t.date AS tournament_date,
      t.has_knockdowns, t.has_distance, t.has_speed, t.has_woods,
      t.total_points_knockdowns, t.total_points_distance,
      t.total_points_speed, t.total_points_woods,
      tr.knockdowns_earned, tr.distance_earned,
      tr.speed_earned, tr.woods_earned
    FROM tournament_results tr
    JOIN tournaments t ON t.id = tr.tournament_id
    WHERE tr.competitor_id = ?
    ORDER BY t.date ASC
  `,
		)
		.all(competitorId);

	return results.map((r) => {
		const eventScores = {};
		for (const event of EVENTS) {
			if (r[`has_${event}`] && r[`${event}_earned`] !== null) {
				eventScores[event] =
					(r[`${event}_earned`] / r[`total_points_${event}`]) * 100;
			} else {
				eventScores[event] = null;
			}
		}
		return {
			tournament_id: r.tournament_id,
			tournament_name: r.tournament_name,
			tournament_date: r.tournament_date,
			...eventScores,
		};
	});
}

module.exports = {
	computeRankings,
	computeCompetitorScores,
	getCompetitorHistory,
	EVENTS,
};
