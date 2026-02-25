import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { computeCompetitorScores, computeRankings } from './rankings.js';

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

describe('Rankings - Tie-Breaking Logic', () => {
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

		// Create a tournament
		db.prepare('INSERT INTO tournaments (name, date) VALUES (?, ?)').run(
			'Test Tournament',
			'2024-01-01',
		);
	});

	it('assigns sequential ranks when no ties exist', () => {
		// Create competitors with different scores
		db.prepare('INSERT INTO competitors (name) VALUES (?), (?), (?), (?)').run(
			'Alice', 'Bob', 'Carol', 'Dave'
		);

		// Alice: 90, Bob: 80, Carol: 70, Dave: 60 knockdowns (all out of 120)
		db.prepare(`INSERT INTO tournament_results 
			(competitor_id, tournament_id, knockdowns_earned) 
			VALUES (1, 1, 108), (2, 1, 96), (3, 1, 84), (4, 1, 72)`).run();

		const rankings = computeRankings(db);

		expect(rankings).toHaveLength(4);
		expect(rankings[0].name).toBe('Alice');
		expect(rankings[0].rank).toBe(1);
		expect(rankings[1].name).toBe('Bob'); 
		expect(rankings[1].rank).toBe(2);
		expect(rankings[2].name).toBe('Carol');
		expect(rankings[2].rank).toBe(3);
		expect(rankings[3].name).toBe('Dave');
		expect(rankings[3].rank).toBe(4);
	});

	it('handles two-way tie at the top (both get rank 1, next gets rank 3)', () => {
		// Alice and Bob tie for first, Carol gets third
		db.prepare('INSERT INTO competitors (name) VALUES (?), (?), (?)').run(
			'Alice', 'Bob', 'Carol'
		);

		// Alice: 90%, Bob: 90%, Carol: 70%
		db.prepare(`INSERT INTO tournament_results 
			(competitor_id, tournament_id, knockdowns_earned) 
			VALUES (1, 1, 108), (2, 1, 108), (3, 1, 84)`).run();

		const rankings = computeRankings(db);

		expect(rankings).toHaveLength(3);
		
		// Alice and Bob should both be rank 1 (tied for first)
		const aliceRank = rankings.find(r => r.name === 'Alice').rank;
		const bobRank = rankings.find(r => r.name === 'Bob').rank;
		expect(aliceRank).toBe(1);
		expect(bobRank).toBe(1);
		
		// Carol should be rank 3 (not rank 2, because positions 1 and 2 were "used")
		const carolRank = rankings.find(r => r.name === 'Carol').rank;
		expect(carolRank).toBe(3);
	});

	it('handles two-way tie in the middle', () => {
		// Alice first, Bob and Carol tied for second/third, Dave fourth
		db.prepare('INSERT INTO competitors (name) VALUES (?), (?), (?), (?)').run(
			'Alice', 'Bob', 'Carol', 'Dave'
		);

		// Alice: 90%, Bob: 80%, Carol: 80%, Dave: 70%
		db.prepare(`INSERT INTO tournament_results 
			(competitor_id, tournament_id, knockdowns_earned) 
			VALUES (1, 1, 108), (2, 1, 96), (3, 1, 96), (4, 1, 84)`).run();

		const rankings = computeRankings(db);

		expect(rankings).toHaveLength(4);
		expect(rankings.find(r => r.name === 'Alice').rank).toBe(1);
		expect(rankings.find(r => r.name === 'Bob').rank).toBe(2);
		expect(rankings.find(r => r.name === 'Carol').rank).toBe(2);
		expect(rankings.find(r => r.name === 'Dave').rank).toBe(4); // Not 3!
	});

	it('handles three-way tie', () => {
		// Alice, Bob, Carol all tied for first, Dave gets fourth
		db.prepare('INSERT INTO competitors (name) VALUES (?), (?), (?), (?)').run(
			'Alice', 'Bob', 'Carol', 'Dave'
		);

		// Alice: 85%, Bob: 85%, Carol: 85%, Dave: 70%
		db.prepare(`INSERT INTO tournament_results 
			(competitor_id, tournament_id, knockdowns_earned) 
			VALUES (1, 1, 102), (2, 1, 102), (3, 1, 102), (4, 1, 84)`).run();

		const rankings = computeRankings(db);

		expect(rankings).toHaveLength(4);
		expect(rankings.find(r => r.name === 'Alice').rank).toBe(1);
		expect(rankings.find(r => r.name === 'Bob').rank).toBe(1);
		expect(rankings.find(r => r.name === 'Carol').rank).toBe(1);
		expect(rankings.find(r => r.name === 'Dave').rank).toBe(4); // Skips ranks 2 and 3
	});

	it('handles multiple separate ties', () => {
		// Alice and Bob tied for first, Carol and Dave tied for third, Eve gets fifth
		db.prepare('INSERT INTO competitors (name) VALUES (?), (?), (?), (?), (?)').run(
			'Alice', 'Bob', 'Carol', 'Dave', 'Eve'
		);

		// Alice: 90%, Bob: 90%, Carol: 80%, Dave: 80%, Eve: 70%
		db.prepare(`INSERT INTO tournament_results 
			(competitor_id, tournament_id, knockdowns_earned) 
			VALUES (1, 1, 108), (2, 1, 108), (3, 1, 96), (4, 1, 96), (5, 1, 84)`).run();

		const rankings = computeRankings(db);

		expect(rankings).toHaveLength(5);
		expect(rankings.find(r => r.name === 'Alice').rank).toBe(1);
		expect(rankings.find(r => r.name === 'Bob').rank).toBe(1);
		expect(rankings.find(r => r.name === 'Carol').rank).toBe(3);
		expect(rankings.find(r => r.name === 'Dave').rank).toBe(3);
		expect(rankings.find(r => r.name === 'Eve').rank).toBe(5);
	});

	it('handles ties with very close but different total scores', () => {
		// Test floating point precision doesn't cause false ties
		db.prepare('INSERT INTO competitors (name) VALUES (?), (?)').run('Alice', 'Bob');

		// Create results that will produce slightly different total scores
		// Alice: knockdowns=108/120=90%, distance=0, speed=0, woods=0 → total=22.5
		// Bob: knockdowns=107/120≈89.17%, distance=0, speed=0, woods=0 → total≈22.29
		db.prepare(`INSERT INTO tournament_results 
			(competitor_id, tournament_id, knockdowns_earned, distance_earned, speed_earned, woods_earned) 
			VALUES (1, 1, 108, 0, 0, 0), (2, 1, 107, 0, 0, 0)`).run();

		const rankings = computeRankings(db);

		expect(rankings).toHaveLength(2);
		expect(rankings[0].name).toBe('Alice'); // Higher score
		expect(rankings[0].rank).toBe(1);
		expect(rankings[1].name).toBe('Bob');
		expect(rankings[1].rank).toBe(2);
		expect(rankings[0].total).toBeGreaterThan(rankings[1].total);
	});
});
