import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';

const createUploadRouter = require('./routes/upload.js');
const { errorHandler } = require('./middleware/errors.js');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

const SCHEMA = `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL
  );
  CREATE TABLE competitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    is_member INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    date TEXT NOT NULL,
    has_knockdowns INTEGER NOT NULL DEFAULT 1,
    has_distance INTEGER NOT NULL DEFAULT 1,
    has_speed INTEGER NOT NULL DEFAULT 1,
    has_woods INTEGER NOT NULL DEFAULT 1,
    total_points_knockdowns REAL NOT NULL DEFAULT 120,
    total_points_distance REAL NOT NULL DEFAULT 120,
    total_points_speed REAL NOT NULL DEFAULT 120,
    total_points_woods REAL NOT NULL DEFAULT 120
  );
  CREATE TABLE tournament_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    competitor_id INTEGER NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    knockdowns_earned REAL,
    distance_earned REAL,
    speed_earned REAL,
    woods_earned REAL,
    UNIQUE(competitor_id, tournament_id)
  );
`;

function buildApp(db) {
	const app = express();
	app.use(express.json());
	app.use('/api/upload', createUploadRouter(db));
	app.use(errorHandler);
	return app;
}

// Minimal valid commit payload
function validCommitBody(overrides = {}) {
	return {
		tournament_name: 'Test Tournament',
		tournament_date: '2025-06-01',
		activeEvents: ['knockdowns', 'distance', 'speed', 'woods'],
		totalPoints: { knockdowns: 120, distance: 120, speed: 120, woods: 120 },
		competitors: [
			{
				name: 'Alice Nguyen',
				email: 'alice@example.com',
				existing_competitor_id: null,
				existing_name: null,
				knockdowns_earned: 100,
				distance_earned: 90,
				speed_earned: 110,
				woods_earned: 80,
			},
		],
		...overrides,
	};
}

describe('Upload Route', () => {
	let db;
	let app;
	let adminToken;

	beforeEach(() => {
		db = new Database(':memory:');
		db.exec(SCHEMA);

		const hash = bcrypt.hashSync('test123', 1);
		const result = db
			.prepare(
				'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
			)
			.run('testadmin', hash, 'admin');

		adminToken = jwt.sign(
			{ id: result.lastInsertRowid, username: 'testadmin', role: 'admin' },
			JWT_SECRET,
			{ expiresIn: '1h' },
		);

		app = buildApp(db);
	});

	// ─── /preview ─────────────────────────────────────────────────────────────

	describe('POST /api/upload/preview', () => {
		it('returns 401 without a token', async () => {
			const res = await request(app)
				.post('/api/upload/preview')
				.field('has_knockdowns', 'true')
				.field('has_distance', 'true')
				.field('has_speed', 'true')
				.field('has_woods', 'true')
				.field('total_points_knockdowns', '120')
				.field('total_points_distance', '120')
				.field('total_points_speed', '120')
				.field('total_points_woods', '120');
			expect(res.status).toBe(401);
		});

		it('returns 400 with no file attached', async () => {
			const res = await request(app)
				.post('/api/upload/preview')
				.set('Authorization', `Bearer ${adminToken}`)
				.field('has_knockdowns', 'true')
				.field('has_distance', 'true')
				.field('has_speed', 'true')
				.field('has_woods', 'true')
				.field('total_points_knockdowns', '120')
				.field('total_points_distance', '120')
				.field('total_points_speed', '120')
				.field('total_points_woods', '120');
			expect(res.status).toBe(400);
		});

		it('parses a clean CSV and returns enriched competitors', async () => {
			const csv =
				'name,email,knockdowns,distance,speed,woods\nAlice,alice@example.com,100,90,110,80';
			const res = await request(app)
				.post('/api/upload/preview')
				.set('Authorization', `Bearer ${adminToken}`)
				.field('has_knockdowns', 'true')
				.field('has_distance', 'true')
				.field('has_speed', 'true')
				.field('has_woods', 'true')
				.field('total_points_knockdowns', '120')
				.field('total_points_distance', '120')
				.field('total_points_speed', '120')
				.field('total_points_woods', '120')
				.attach('csv', Buffer.from(csv), 'test.csv');

			expect(res.status).toBe(200);
			expect(res.body.competitors).toHaveLength(1);
			expect(res.body.competitors[0].name).toBe('Alice');
			expect(res.body.competitors[0].is_new).toBe(true);
			expect(res.body.errors).toHaveLength(0);
		});

		describe('rebuildPlaceholderWarnings', () => {
			it('warns for a new no-email competitor', async () => {
				const csv =
					'name,knockdowns,distance,speed,woods\nNo Email Person,100,90,110,80';
				const res = await request(app)
					.post('/api/upload/preview')
					.set('Authorization', `Bearer ${adminToken}`)
					.field('has_knockdowns', 'true')
					.field('has_distance', 'true')
					.field('has_speed', 'true')
					.field('has_woods', 'true')
					.field('total_points_knockdowns', '120')
					.field('total_points_distance', '120')
					.field('total_points_speed', '120')
					.field('total_points_woods', '120')
					.attach('csv', Buffer.from(csv), 'test.csv');

				expect(res.status).toBe(200);
				expect(
					res.body.warnings.some((w) => w.includes('No Email Person')),
				).toBe(true);
			});

			it('suppresses the warning for a returning competitor already in the DB', async () => {
				// Seed a competitor with a placeholder email already in the DB
				db.prepare('INSERT INTO competitors (name, email) VALUES (?, ?)').run(
					'No Email Person',
					'no.email.person.nsl@placeholder.local',
				);

				const csv =
					'name,knockdowns,distance,speed,woods\nNo Email Person,100,90,110,80';
				const res = await request(app)
					.post('/api/upload/preview')
					.set('Authorization', `Bearer ${adminToken}`)
					.field('has_knockdowns', 'true')
					.field('has_distance', 'true')
					.field('has_speed', 'true')
					.field('has_woods', 'true')
					.field('total_points_knockdowns', '120')
					.field('total_points_distance', '120')
					.field('total_points_speed', '120')
					.field('total_points_woods', '120')
					.attach('csv', Buffer.from(csv), 'test.csv');

				expect(res.status).toBe(200);
				expect(res.body.competitors[0].is_new).toBe(false);
				expect(
					res.body.warnings.some((w) =>
						w.includes('placeholder emails were generated'),
					),
				).toBe(false);
			});

			it('warns only for new no-email competitors when mixed with returning ones', async () => {
				db.prepare('INSERT INTO competitors (name, email) VALUES (?, ?)').run(
					'Returning Person',
					'returning.person.nsl@placeholder.local',
				);

				const csv = [
					'name,knockdowns,distance,speed,woods',
					'Returning Person,100,90,110,80',
					'Brand New Person,95,85,105,75',
				].join('\n');

				const res = await request(app)
					.post('/api/upload/preview')
					.set('Authorization', `Bearer ${adminToken}`)
					.field('has_knockdowns', 'true')
					.field('has_distance', 'true')
					.field('has_speed', 'true')
					.field('has_woods', 'true')
					.field('total_points_knockdowns', '120')
					.field('total_points_distance', '120')
					.field('total_points_speed', '120')
					.field('total_points_woods', '120')
					.attach('csv', Buffer.from(csv), 'test.csv');

				expect(res.status).toBe(200);
				const warning = res.body.warnings.find((w) =>
					w.includes('placeholder emails were generated'),
				);
				expect(warning).toBeDefined();
				expect(warning).toContain('Brand New Person');
				expect(warning).not.toContain('Returning Person');
			});
		});
	});

	// ─── /commit ──────────────────────────────────────────────────────────────

	describe('POST /api/upload/commit', () => {
		it('returns 401 without a token', async () => {
			const res = await request(app)
				.post('/api/upload/commit')
				.send(validCommitBody());
			expect(res.status).toBe(401);
		});

		it('commits a valid tournament and returns 201', async () => {
			const res = await request(app)
				.post('/api/upload/commit')
				.set('Authorization', `Bearer ${adminToken}`)
				.send(validCommitBody());

			expect(res.status).toBe(201);
			expect(res.body.success).toBe(true);
			expect(res.body.tournament_id).toBeDefined();
			expect(res.body.new_competitors).toContain('Alice Nguyen');

			// Confirm data is in the database
			const tournament = db
				.prepare('SELECT * FROM tournaments WHERE id = ?')
				.get(res.body.tournament_id);
			expect(tournament).toBeDefined();
			expect(tournament.date).toBe('2025-06-01');
		});

		it('returns 409 for a duplicate tournament (same name + date)', async () => {
			await request(app)
				.post('/api/upload/commit')
				.set('Authorization', `Bearer ${adminToken}`)
				.send(validCommitBody());

			const res = await request(app)
				.post('/api/upload/commit')
				.set('Authorization', `Bearer ${adminToken}`)
				.send(validCommitBody());

			expect(res.status).toBe(409);
		});

		describe('totalPoints validation', () => {
			it('returns 400 when a totalPoints value is zero', async () => {
				const res = await request(app)
					.post('/api/upload/commit')
					.set('Authorization', `Bearer ${adminToken}`)
					.send(
						validCommitBody({
							totalPoints: {
								knockdowns: 0,
								distance: 120,
								speed: 120,
								woods: 120,
							},
						}),
					);
				expect(res.status).toBe(400);
				expect(res.body.error).toMatch(/total_points_knockdowns/);
			});

			it('returns 400 when a totalPoints value is negative', async () => {
				const res = await request(app)
					.post('/api/upload/commit')
					.set('Authorization', `Bearer ${adminToken}`)
					.send(
						validCommitBody({
							totalPoints: {
								knockdowns: -10,
								distance: 120,
								speed: 120,
								woods: 120,
							},
						}),
					);
				expect(res.status).toBe(400);
			});

			it('returns 400 when a totalPoints value is non-numeric', async () => {
				const res = await request(app)
					.post('/api/upload/commit')
					.set('Authorization', `Bearer ${adminToken}`)
					.send(
						validCommitBody({
							totalPoints: {
								knockdowns: 'abc',
								distance: 120,
								speed: 120,
								woods: 120,
							},
						}),
					);
				expect(res.status).toBe(400);
			});
		});

		describe('competitor field validation', () => {
			it('returns 400 when a competitor has an empty name', async () => {
				const res = await request(app)
					.post('/api/upload/commit')
					.set('Authorization', `Bearer ${adminToken}`)
					.send(
						validCommitBody({
							competitors: [
								{
									name: '',
									email: 'alice@example.com',
									existing_competitor_id: null,
									knockdowns_earned: 100,
									distance_earned: 90,
									speed_earned: 110,
									woods_earned: 80,
								},
							],
						}),
					);
				expect(res.status).toBe(400);
				expect(res.body.error).toMatch(/name/i);
			});

			it('returns 400 when an earned value is negative', async () => {
				const res = await request(app)
					.post('/api/upload/commit')
					.set('Authorization', `Bearer ${adminToken}`)
					.send(
						validCommitBody({
							competitors: [
								{
									name: 'Alice Nguyen',
									email: 'alice@example.com',
									existing_competitor_id: null,
									knockdowns_earned: -5,
									distance_earned: 90,
									speed_earned: 110,
									woods_earned: 80,
								},
							],
						}),
					);
				expect(res.status).toBe(400);
				expect(res.body.error).toMatch(/knockdowns_earned/);
			});

			it('returns 400 when an earned value is a string (tampered payload)', async () => {
				// Send raw JSON manually so the string survives serialization
				const body = JSON.stringify(
					validCommitBody({
						competitors: [
							{
								name: 'Alice Nguyen',
								email: 'alice@example.com',
								existing_competitor_id: null,
								knockdowns_earned: 'tampered',
								distance_earned: 90,
								speed_earned: 110,
								woods_earned: 80,
							},
						],
					}),
				);
				const res = await request(app)
					.post('/api/upload/commit')
					.set('Authorization', `Bearer ${adminToken}`)
					.set('Content-Type', 'application/json')
					.send(body);
				expect(res.status).toBe(400);
			});

			it('accepts null earned values (event not held for that competitor)', async () => {
				const res = await request(app)
					.post('/api/upload/commit')
					.set('Authorization', `Bearer ${adminToken}`)
					.send(
						validCommitBody({
							competitors: [
								{
									name: 'Alice Nguyen',
									email: 'alice@example.com',
									existing_competitor_id: null,
									knockdowns_earned: null,
									distance_earned: null,
									speed_earned: null,
									woods_earned: null,
								},
							],
						}),
					);
				expect(res.status).toBe(201);
			});
		});

		describe('tournament date validation', () => {
			it('returns 400 when tournament_date is missing', async () => {
				const body = validCommitBody();
				delete body.tournament_date;
				const res = await request(app)
					.post('/api/upload/commit')
					.set('Authorization', `Bearer ${adminToken}`)
					.send(body);
				expect(res.status).toBe(400);
			});
		});

		it('returns 400 when competitors array is empty', async () => {
			const res = await request(app)
				.post('/api/upload/commit')
				.set('Authorization', `Bearer ${adminToken}`)
				.send(validCommitBody({ competitors: [] }));
			expect(res.status).toBe(400);
		});

		it('updates an existing competitor name when it differs', async () => {
			const inserted = db
				.prepare('INSERT INTO competitors (name, email) VALUES (?, ?)')
				.run('Old Name', 'alice@example.com');

			await request(app)
				.post('/api/upload/commit')
				.set('Authorization', `Bearer ${adminToken}`)
				.send(
					validCommitBody({
						competitors: [
							{
								name: 'New Name',
								email: 'alice@example.com',
								existing_competitor_id: inserted.lastInsertRowid,
								existing_name: 'Old Name',
								knockdowns_earned: 100,
								distance_earned: 90,
								speed_earned: 110,
								woods_earned: 80,
							},
						],
					}),
				);

			const updated = db
				.prepare('SELECT name FROM competitors WHERE id = ?')
				.get(inserted.lastInsertRowid);
			expect(updated.name).toBe('New Name');
		});

		describe('tournament_id — attach to existing tournament', () => {
			it('commits results to an existing tournament without creating a new one', async () => {
				const { lastInsertRowid: existingId } = db
					.prepare(
						`INSERT INTO tournaments (name, date, has_knockdowns, has_distance, has_speed, has_woods,
						total_points_knockdowns, total_points_distance, total_points_speed, total_points_woods)
						VALUES ('Existing Cup', '2025-07-01', 1, 1, 1, 1, 120, 120, 120, 120)`,
					)
					.run();

				const res = await request(app)
					.post('/api/upload/commit')
					.set('Authorization', `Bearer ${adminToken}`)
					.send({
						tournament_id: existingId,
						activeEvents: ['knockdowns', 'distance', 'speed', 'woods'],
						totalPoints: { knockdowns: 120, distance: 120, speed: 120, woods: 120 },
						competitors: [
							{
								name: 'Bob Smith',
								email: 'bob@example.com',
								existing_competitor_id: null,
								knockdowns_earned: 80,
								distance_earned: 70,
								speed_earned: 90,
								woods_earned: 60,
							},
						],
					});

				expect(res.status).toBe(201);
				expect(res.body.tournament_id).toBe(existingId);
				expect(res.body.new_competitors).toContain('Bob Smith');

				// No extra tournament row should have been created
				const count = db.prepare('SELECT COUNT(*) as n FROM tournaments').get();
				expect(count.n).toBe(1);
			});

			it('returns 404 when tournament_id refers to a non-existent tournament', async () => {
				const res = await request(app)
					.post('/api/upload/commit')
					.set('Authorization', `Bearer ${adminToken}`)
					.send({
						tournament_id: 9999,
						activeEvents: ['knockdowns'],
						totalPoints: { knockdowns: 120, distance: 120, speed: 120, woods: 120 },
						competitors: [
							{
								name: 'Alice Nguyen',
								email: 'alice@example.com',
								existing_competitor_id: null,
								knockdowns_earned: 100,
								distance_earned: null,
								speed_earned: null,
								woods_earned: null,
							},
						],
					});

				expect(res.status).toBe(404);
			});

			it('skips the duplicate-tournament check when tournament_id is provided', async () => {
				// Create two tournaments with the same name+date — commit should not 409
				const { lastInsertRowid: id1 } = db
					.prepare(
						`INSERT INTO tournaments (name, date, has_knockdowns, has_distance, has_speed, has_woods,
						total_points_knockdowns, total_points_distance, total_points_speed, total_points_woods)
						VALUES ('Same Name', '2025-08-01', 1, 1, 1, 1, 120, 120, 120, 120)`,
					)
					.run();
				db.prepare(
					`INSERT INTO tournaments (name, date, has_knockdowns, has_distance, has_speed, has_woods,
					total_points_knockdowns, total_points_distance, total_points_speed, total_points_woods)
					VALUES ('Same Name', '2025-08-01', 1, 1, 1, 1, 120, 120, 120, 120)`,
				).run();

				const res = await request(app)
					.post('/api/upload/commit')
					.set('Authorization', `Bearer ${adminToken}`)
					.send({
						tournament_id: id1,
						activeEvents: ['knockdowns', 'distance', 'speed', 'woods'],
						totalPoints: { knockdowns: 120, distance: 120, speed: 120, woods: 120 },
						competitors: [
							{
								name: 'Alice Nguyen',
								email: 'alice@example.com',
								existing_competitor_id: null,
								knockdowns_earned: 100,
								distance_earned: 90,
								speed_earned: 110,
								woods_earned: 80,
							},
						],
					});

				expect(res.status).toBe(201);
			});

			it('upserts results when competitor already has a result for the tournament', async () => {
				const { lastInsertRowid: compId } = db
					.prepare('INSERT INTO competitors (name, email) VALUES (?, ?)')
					.run('Alice Nguyen', 'alice@example.com');
				const { lastInsertRowid: tournId } = db
					.prepare(
						`INSERT INTO tournaments (name, date, has_knockdowns, has_distance, has_speed, has_woods,
						total_points_knockdowns, total_points_distance, total_points_speed, total_points_woods)
						VALUES ('Cup', '2025-09-01', 1, 1, 1, 1, 120, 120, 120, 120)`,
					)
					.run();
				db.prepare(
					`INSERT INTO tournament_results
					(competitor_id, tournament_id, knockdowns_earned, distance_earned, speed_earned, woods_earned)
					VALUES (?, ?, 50, 50, 50, 50)`,
				).run(compId, tournId);

				const res = await request(app)
					.post('/api/upload/commit')
					.set('Authorization', `Bearer ${adminToken}`)
					.send({
						tournament_id: tournId,
						activeEvents: ['knockdowns', 'distance', 'speed', 'woods'],
						totalPoints: { knockdowns: 120, distance: 120, speed: 120, woods: 120 },
						competitors: [
							{
								name: 'Alice Nguyen',
								email: 'alice@example.com',
								existing_competitor_id: compId,
								existing_name: 'Alice Nguyen',
								knockdowns_earned: 100,
								distance_earned: 90,
								speed_earned: 110,
								woods_earned: 80,
							},
						],
					});

				expect(res.status).toBe(201);
				const result = db
					.prepare(
						'SELECT * FROM tournament_results WHERE competitor_id = ? AND tournament_id = ?',
					)
					.get(compId, tournId);
				expect(result.knockdowns_earned).toBe(100);
			});
		});
	});
});
