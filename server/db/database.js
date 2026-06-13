const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

// Load environment variables
require('dotenv').config();

// Support test database path for integration testing.
// In production (Render), the DB lives on the mounted persistent disk at /data.
// In dev, it lives at server/data/rankings.db (created automatically below).
const DB_PATH =
	process.env.TEST_DATABASE_PATH ||
	(process.env.NODE_ENV === 'production'
		? '/data/rankings.db'
		: path.join(__dirname, '..', 'data', 'rankings.db'));

// Ensure data directory exists (dev only — in production, /data is the mount point and is provisioned by Render)
const fs = require('fs');
if (!process.env.TEST_DATABASE_PATH && process.env.NODE_ENV !== 'production') {
	const dataDir = path.join(__dirname, '..', 'data');
	if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'user')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS competitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tournaments (
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
    total_points_woods REAL NOT NULL DEFAULT 120,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tournament_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    competitor_id INTEGER NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    knockdowns_earned REAL,
    distance_earned REAL,
    speed_earned REAL,
    woods_earned REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(competitor_id, tournament_id)
  );
`);

// Idempotent migration: add competitors.is_member if missing.
// Default to 0 for new rows, but backfill existing rows to 1 so deploying this
// change doesn't silently empty the public leaderboard for current data.
const competitorColumns = db.prepare('PRAGMA table_info(competitors)').all();
if (!competitorColumns.some((col) => col.name === 'is_member')) {
	db.exec('ALTER TABLE competitors ADD COLUMN is_member INTEGER NOT NULL DEFAULT 0');
	const backfilled = db.prepare('UPDATE competitors SET is_member = 1').run();
	if (backfilled.changes > 0) {
		console.log(`Migration: backfilled is_member=1 for ${backfilled.changes} existing competitors`);
	}
}

// Seed a default owner user if none exists
const existingOwner = db
	.prepare('SELECT id FROM users WHERE role = ?')
	.get('owner');
if (!existingOwner) {
	if (!process.env.OWNER_USERNAME || !process.env.OWNER_PASSWORD) {
		console.error(
			'FATAL: OWNER_USERNAME and OWNER_PASSWORD must be set in environment variables.',
		);
		process.exit(1);
	}
	const username = process.env.OWNER_USERNAME;
	const password = process.env.OWNER_PASSWORD;
	const hash = bcrypt.hashSync(password, 10);
	// INSERT OR IGNORE to be safe against parallel test workers all racing to
	// seed the same on-disk dev DB. The role check above already prevents this
	// in normal use; this is just belt-and-suspenders for vitest's parallel pool.
	db.prepare(
		'INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)',
	).run(username, hash, 'owner');
	console.log(`Owner created: username=${username}`);
}
// NO else block

// Admin seed
const existingAdmin = db
	.prepare('SELECT id FROM users WHERE role = ?')
	.get('admin');
if (!existingAdmin && process.env.ADMIN_USERNAME) {
	if (!process.env.ADMIN_PASSWORD) {
		console.error(
			'FATAL: ADMIN_PASSWORD must be set when ADMIN_USERNAME is provided.',
		);
		process.exit(1);
	}
	const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);
	db.prepare(
		'INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)',
	).run(process.env.ADMIN_USERNAME, hash, 'admin');
	console.log(`Admin created: username=${process.env.ADMIN_USERNAME}`);
}
// NO else block

module.exports = db;
