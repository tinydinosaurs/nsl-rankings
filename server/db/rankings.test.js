import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { computeCompetitorScores } from './rankings.js';

describe('Rankings - Core Business Logic', () => {
	let db;

	beforeEach(() => {
		// In-memory DB for testing
		db = new Database(':memory:');

		// Create minimal schema
		db.exec(`
      CREATE TABLE competitors (id INTEGER PRIMARY KEY, name TEXT);
      CREATE TABLE tournaments (
        id INTEGER PRIMARY KEY, name TEXT, date TEXT,
        total_points_knockdowns REAL DEFAULT 120,
        total_points_distance REAL DEFAULT 120, 
        total_points_speed REAL DEFAULT 120,
        total_points_woods REAL DEFAULT 120,
        has_knockdowns INTEGER DEFAULT 1,
        has_distance INTEGER DEFAULT 1,
        has_speed INTEGER DEFAULT 1,
        has_woods INTEGER DEFAULT 1
      );
      CREATE TABLE tournament_results (
        competitor_id INTEGER, tournament_id INTEGER,
        knockdowns_earned REAL, distance_earned REAL,
        speed_earned REAL, woods_earned REAL
      );
    `);
	});

	it('computes correct event averages (not running averages)', () => {
		// Setup: competitor with 3 tournaments (need 3+ to distinguish from running avg)
		db.prepare('INSERT INTO competitors (name) VALUES (?)').run('Alice');
		db.prepare(
			`INSERT INTO tournaments (name, date, total_points_knockdowns) 
                VALUES (?, ?, ?)`,
		).run('Tournament 1', '2024-01-01', 100);
		db.prepare(
			`INSERT INTO tournaments (name, date, total_points_knockdowns) 
                VALUES (?, ?, ?)`,
		).run('Tournament 2', '2024-01-02', 200);
		db.prepare(
			`INSERT INTO tournaments (name, date, total_points_knockdowns) 
                VALUES (?, ?, ?)`,
		).run('Tournament 3', '2024-01-03', 150);

		// Alice scores: 80/100=80%, 120/200=60%, 120/150=80%
		db.prepare(
			`INSERT INTO tournament_results 
                (competitor_id, tournament_id, knockdowns_earned) 
                VALUES (?, ?, ?)`,
		).run(1, 1, 80);
		db.prepare(
			`INSERT INTO tournament_results 
                (competitor_id, tournament_id, knockdowns_earned) 
                VALUES (?, ?, ?)`,
		).run(1, 2, 120);
		db.prepare(
			`INSERT INTO tournament_results 
                (competitor_id, tournament_id, knockdowns_earned) 
                VALUES (?, ?, ?)`,
		).run(1, 3, 120);

		const scores = computeCompetitorScores(1, db);

		// True average: (80 + 60 + 80) / 3 = 73.33
		// Running average would be: 80 → (80+60)/2=70 → (70+80)/2=75 (wrong!)
		expect(scores.knockdowns).toBeCloseTo(73.33, 2);
		expect(scores.knockdowns).not.toBe(75); // Explicitly reject running average
		expect(scores.total).toBeCloseTo(73.33 / 4, 2); // Always divide by 4
	});

	it('handles zero participation correctly', () => {
		// Competitor who never participated in any tournaments
		db.prepare('INSERT INTO competitors (name) VALUES (?)').run('Bob');

		const scores = computeCompetitorScores(1, db);

		expect(scores.knockdowns).toBe(null);
		expect(scores.distance).toBe(null);
		expect(scores.speed).toBe(null);
		expect(scores.woods).toBe(null);
		expect(scores.total).toBe(0); // (0 + 0 + 0 + 0) / 4
	});

	it('handles partial participation (some events only)', () => {
		// Competitor participated in knockdowns and distance, not speed/woods
		db.prepare('INSERT INTO competitors (name) VALUES (?)').run('Carol');
		db.prepare('INSERT INTO tournaments (name, date) VALUES (?, ?)').run(
			'Tournament 1',
			'2024-01-01',
		);

		// Only participated in 2 of 4 events
		db.prepare(
			`INSERT INTO tournament_results 
             (competitor_id, tournament_id, knockdowns_earned, distance_earned) 
             VALUES (?, ?, ?, ?)`,
		).run(1, 1, 60, 80); // 60/120=50%, 80/120=66.67%

		const scores = computeCompetitorScores(1, db);

		expect(scores.knockdowns).toBe(50);
		expect(scores.distance).toBeCloseTo(66.67, 2);
		expect(scores.speed).toBe(null);
		expect(scores.woods).toBe(null);
		expect(scores.total).toBeCloseTo((50 + 66.67 + 0 + 0) / 4, 2); // ~29.17
	});

	it('treats earned score of 0 as valid participation (not null)', () => {
		// Competitor participated but scored 0 points
		db.prepare('INSERT INTO competitors (name) VALUES (?)').run('Dave');
		db.prepare('INSERT INTO tournaments (name, date) VALUES (?, ?)').run(
			'Tournament 1',
			'2024-01-01',
		);

		// Scored 0 points (participated but failed)
		db.prepare(
			`INSERT INTO tournament_results 
             (competitor_id, tournament_id, knockdowns_earned) 
             VALUES (?, ?, ?)`,
		).run(1, 1, 0); // 0/120 = 0%

		const scores = computeCompetitorScores(1, db);

		expect(scores.knockdowns).toBe(0); // Not null - they participated!
		expect(scores.total).toBe(0); // (0 + 0 + 0 + 0) / 4
	});

	it('handles single tournament correctly', () => {
		// Ensure true average works with n=1
		db.prepare('INSERT INTO competitors (name) VALUES (?)').run('Eve');
		db.prepare('INSERT INTO tournaments (name, date) VALUES (?, ?)').run(
			'Tournament 1',
			'2024-01-01',
		);

		db.prepare(
			`INSERT INTO tournament_results 
             (competitor_id, tournament_id, knockdowns_earned) 
             VALUES (?, ?, ?)`,
		).run(1, 1, 90); // 90/120 = 75%

		const scores = computeCompetitorScores(1, db);

		expect(scores.knockdowns).toBe(75);
		expect(scores.total).toBe(75 / 4);
	});

	it('handles different total_points per tournament', () => {
		// Each tournament can have different max points
		db.prepare('INSERT INTO competitors (name) VALUES (?)').run('Frank');
		db.prepare(
			`INSERT INTO tournaments (name, date, total_points_knockdowns) 
             VALUES (?, ?, ?)`,
		).run('Tournament 1', '2024-01-01', 100);
		db.prepare(
			`INSERT INTO tournaments (name, date, total_points_knockdowns) 
             VALUES (?, ?, ?)`,
		).run('Tournament 2', '2024-01-02', 300);

		// Same earned points, different totals
		db.prepare(
			`INSERT INTO tournament_results 
             (competitor_id, tournament_id, knockdowns_earned) 
             VALUES (?, ?, ?)`,
		).run(1, 1, 50); // 50/100 = 50%
		db.prepare(
			`INSERT INTO tournament_results 
             (competitor_id, tournament_id, knockdowns_earned) 
             VALUES (?, ?, ?)`,
		).run(1, 2, 150); // 150/300 = 50%

		const scores = computeCompetitorScores(1, db);

		expect(scores.knockdowns).toBe(50); // (50 + 50) / 2 = 50
	});
});
