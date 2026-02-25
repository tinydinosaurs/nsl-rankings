const db = require('./db/database');

/**
 * Reset database to clean state
 * Keeps user accounts but removes all tournament data
 */

console.log('🗑️  Resetting database to clean state...');

// Clear tournament data
console.log('Removing tournament results...');
db.prepare('DELETE FROM tournament_results').run();

console.log('Removing tournaments...');  
db.prepare('DELETE FROM tournaments').run();

console.log('Removing competitors...');
db.prepare('DELETE FROM competitors').run();

console.log('✅ Database reset complete!');
console.log('👤 User accounts preserved');
console.log('🌱 Run "npm run seed:demo" to add demo data');

db.close();