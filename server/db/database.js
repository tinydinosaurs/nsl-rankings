const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

// Load environment variables
require('dotenv').config();

// Support test database path for integration testing
const DB_PATH =
	process.env.TEST_DATABASE_PATH ||
	path.join(__dirname, '..', 'data', 'rankings.db');

// Ensure data directory exists (for production database)
const fs = require('fs');
if (!process.env.TEST_DATABASE_PATH) {
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

// Seed a default owner user if none exists
const existingOwner = db
	.prepare('SELECT id FROM users WHERE role = ?')
	.get('owner');
if (!existingOwner) {
	const username = process.env.OWNER_USERNAME || 'owner';
	const password = process.env.OWNER_PASSWORD || 'owner123';
	const hash = bcrypt.hashSync(password, 10);
	db.prepare(
		'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
	).run(username, hash, 'owner');
	console.log(`Owner created: username=${username}`);
}
// NO else block

// Admin seed
const existingAdmin = db
	.prepare('SELECT id FROM users WHERE role = ?')
	.get('admin');
if (!existingAdmin && process.env.ADMIN_USERNAME) {
	const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);
	db.prepare(
		'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
	).run(process.env.ADMIN_USERNAME, hash, 'admin');
	console.log(`Admin created: username=${process.env.ADMIN_USERNAME}`);
}
// NO else block

module.exports = db;
