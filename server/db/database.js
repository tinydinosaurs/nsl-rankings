const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'data', 'rankings.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS competitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
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

// Seed a default admin user if none exists
const existingAdmin = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
if (!existingAdmin) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
  console.log('Default admin created: username=admin, password=admin123 — CHANGE THIS IMMEDIATELY');
}

module.exports = db;
