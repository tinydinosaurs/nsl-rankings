const db = require('./db/database');

/**
 * Demo seed data for POC testing
 * Creates realistic tournament data that people can mess with
 */

console.log('🌱 Seeding demo data...');

// Demo competitors - mix of realistic names with email addresses
const demoCompetitors = [
	{ name: 'Alice Chen', email: 'alice.chen@email.com' },
	{ name: 'Bob Martinez', email: 'bob.martinez@email.com' },
	{ name: 'Carmen Rodriguez', email: 'carmen.rodriguez@email.com' },
	{ name: 'David Park', email: 'david.park@email.com' },
	{ name: 'Elena Volkov', email: 'elena.volkov@email.com' },
	{ name: 'Frank Johnson', email: 'frank.johnson@email.com' },
	{ name: 'Grace Kim', email: 'grace.kim@email.com' },
	{ name: 'Hassan Ali', email: 'hassan.ali@email.com' },
	{ name: 'Isabella Torres', email: 'isabella.torres@email.com' },
	{ name: 'Jake Wilson', email: 'jake.wilson@email.com' },
	{ name: 'Katherine Liu', email: 'katherine.liu@email.com' },
	{ name: 'Luis Garcia', email: 'luis.garcia@email.com' },
	{ name: 'Maya Patel', email: 'maya.patel@email.com' },
	{ name: 'Nick Thompson', email: 'nick.thompson@email.com' },
	{ name: 'Olivia Brown', email: 'olivia.brown@email.com' },
	{ name: 'Pavel Novak', email: 'pavel.novak@email.com' },
	{ name: "Quinn O'Connor", email: 'quinn.oconnor@email.com' },
	{ name: 'Rachel Green', email: 'rachel.green@email.com' },
	{ name: 'Sam Anderson', email: 'sam.anderson@email.com' },
	{ name: 'Tara Singh', email: 'tara.singh@email.com' },
	{ name: 'Victor Reyes', email: 'victor.reyes@email.com' },
	{ name: 'Wendy Chang', email: 'wendy.chang@email.com' },
	{ name: 'Xavier Dubois', email: 'xavier.dubois@email.com' },
	{ name: 'Yuki Tanaka', email: 'yuki.tanaka@email.com' },
	{ name: 'Zoe Mitchell', email: 'zoe.mitchell@email.com' },
	{ name: 'Alex Morgan', email: 'alex.morgan@email.com' },
	{ name: 'Blair Hughes', email: 'blair.hughes@email.com' },
	{ name: 'Casey Smith', email: 'casey.smith@email.com' },
	{ name: 'Dylan Foster', email: 'dylan.foster@email.com' },
	{ name: 'Emma Davis', email: 'emma.davis@email.com' },
	{ name: 'Felix Weber', email: 'felix.weber@email.com' },
	{ name: 'Gina Romano', email: 'gina.romano@email.com' },
	{ name: 'Hugo Larsen', email: 'hugo.larsen@email.com' },
	{ name: 'Iris Nakamura', email: 'iris.nakamura@email.com' },
	{ name: 'Joel Murphy', email: 'joel.murphy@email.com' },
	{ name: 'Kira Petrov', email: 'kira.petrov@email.com' },
	{ name: 'Logan Scott', email: 'logan.scott@email.com' },
	{ name: 'Mia Thompson', email: 'mia.thompson@email.com' },
	{ name: 'Nathan Reed', email: 'nathan.reed@email.com' },
	{ name: 'Oscar Silva', email: 'oscar.silva@email.com' },
];

// Demo tournaments with realistic data
const demoTournaments = [
	{
		name: 'Spring Championship 2024',
		date: '2024-03-15',
		has_knockdowns: 1,
		has_distance: 1,
		has_speed: 1,
		has_woods: 1,
		total_points_knockdowns: 120,
		total_points_distance: 120,
		total_points_speed: 120,
		total_points_woods: 120,
	},
	{
		name: 'Summer Regional 2024',
		date: '2024-07-20',
		has_knockdowns: 1,
		has_distance: 1,
		has_speed: 1,
		has_woods: 0, // No woods event
		total_points_knockdowns: 100,
		total_points_distance: 100,
		total_points_speed: 100,
		total_points_woods: 100, // Use default value instead of null
	},
	{
		name: 'Fall Invitational 2024',
		date: '2024-10-12',
		has_knockdowns: 1,
		has_distance: 1,
		has_speed: 1,
		has_woods: 1,
		total_points_knockdowns: 150,
		total_points_distance: 150,
		total_points_speed: 150,
		total_points_woods: 150,
	},
];

// Seed competitors
console.log('Adding competitors...');
const competitorIds = [];
for (const competitor of demoCompetitors) {
	try {
		const result = db
			.prepare('INSERT INTO competitors (name, email) VALUES (?, ?)')
			.run(competitor.name, competitor.email);
		competitorIds.push(result.lastInsertRowid);
	} catch (e) {
		if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
			// Competitor already exists, get ID (try by email first, then by name)
			let existing = db
				.prepare('SELECT id FROM competitors WHERE email = ?')
				.get(competitor.email);
			if (!existing) {
				existing = db
					.prepare('SELECT id FROM competitors WHERE name = ?')
					.get(competitor.name);
			}
			if (existing) {
				competitorIds.push(existing.id);
			}
		} else {
			throw e;
		}
	}
}

// Seed tournaments
console.log('Adding tournaments...');
const tournamentIds = [];
for (const tournament of demoTournaments) {
	try {
		const result = db
			.prepare(
				`
      INSERT INTO tournaments (name, date, has_knockdowns, has_distance, has_speed, has_woods,
                             total_points_knockdowns, total_points_distance, total_points_speed, total_points_woods)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
			)
			.run(
				tournament.name,
				tournament.date,
				tournament.has_knockdowns,
				tournament.has_distance,
				tournament.has_speed,
				tournament.has_woods,
				tournament.total_points_knockdowns,
				tournament.total_points_distance,
				tournament.total_points_speed,
				tournament.total_points_woods,
			);
		tournamentIds.push(result.lastInsertRowid);
	} catch (e) {
		if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
			// Tournament already exists, get ID
			const existing = db
				.prepare(
					'SELECT id FROM tournaments WHERE name = ? AND date = ?',
				)
				.get(tournament.name, tournament.date);
			tournamentIds.push(existing.id);
		} else {
			throw e;
		}
	}
}

// Generate realistic results for each tournament
console.log('Adding tournament results...');

function randomScore(maxPoints, competitorSkill = 0.7) {
	// Generate scores with some competitors consistently better than others
	const baseScore = maxPoints * competitorSkill;
	const variance = maxPoints * 0.15; // 15% variance
	const score = baseScore + (Math.random() - 0.5) * variance * 2;
	return Math.max(0, Math.min(maxPoints, Math.round(score * 100) / 100));
}

// Assign skill levels to competitors (some are consistently better)
const competitorSkills = competitorIds.map(() => 0.4 + Math.random() * 0.5); // 40-90% skill range

for (let t = 0; t < tournamentIds.length; t++) {
	const tournament = demoTournaments[t];
	const tournamentId = tournamentIds[t];

	// Not every competitor participates in every tournament (more realistic)
	const participantCount = Math.floor(
		competitorIds.length * (0.6 + Math.random() * 0.3),
	); // 60-90% participation
	const participants = competitorIds
		.slice()
		.sort(() => Math.random() - 0.5)
		.slice(0, participantCount);

	for (const competitorId of participants) {
		const skill = competitorSkills[competitorIds.indexOf(competitorId)];

		const knockdowns_earned = tournament.has_knockdowns
			? randomScore(tournament.total_points_knockdowns, skill)
			: null;
		const distance_earned = tournament.has_distance
			? randomScore(tournament.total_points_distance, skill)
			: null;
		const speed_earned = tournament.has_speed
			? randomScore(tournament.total_points_speed, skill)
			: null;
		const woods_earned = tournament.has_woods
			? randomScore(tournament.total_points_woods, skill)
			: null;

		try {
			db.prepare(
				`
        INSERT INTO tournament_results 
        (competitor_id, tournament_id, knockdowns_earned, distance_earned, speed_earned, woods_earned)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
			).run(
				competitorId,
				tournamentId,
				knockdowns_earned,
				distance_earned,
				speed_earned,
				woods_earned,
			);
		} catch (e) {
			if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
				// Result already exists, skip
				continue;
			} else {
				throw e;
			}
		}
	}
}

// Create a few interesting edge cases for demo
console.log('Adding edge cases...');

// Perfect scorer (if Alice Chen exists)
const alice = db
	.prepare('SELECT id FROM competitors WHERE name = ?')
	.get('Alice Chen');
if (alice) {
	const perfectTournament = tournamentIds[0];
	const tournament = demoTournaments[0];
	try {
		db.prepare(
			`
      INSERT OR REPLACE INTO tournament_results 
      (competitor_id, tournament_id, knockdowns_earned, distance_earned, speed_earned, woods_earned)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
		).run(
			alice.id,
			perfectTournament,
			tournament.total_points_knockdowns,
			tournament.total_points_distance,
			tournament.total_points_speed,
			tournament.total_points_woods,
		);
	} catch (e) {
		console.log('Could not add perfect score:', e.message);
	}
}

// Create some ties by making a few competitors have identical scores
const tieCompetitors = competitorIds.slice(5, 8); // Bob, Carmen, David
const tieTournament = tournamentIds[1];
const tieScore = 75;
for (const competitorId of tieCompetitors) {
	try {
		db.prepare(
			`
      INSERT OR REPLACE INTO tournament_results
      (competitor_id, tournament_id, knockdowns_earned, distance_earned, speed_earned, woods_earned)  
      VALUES (?, ?, ?, ?, ?, ?)
    `,
		).run(competitorId, tieTournament, tieScore, tieScore, tieScore, null);
	} catch (e) {
		console.log('Could not add tie score:', e.message);
	}
}

console.log('✅ Demo data seeded successfully!');
console.log(`📊 Added ${demoCompetitors.length} competitors`);
console.log(`🏆 Added ${demoTournaments.length} tournaments`);
console.log('🎯 Includes edge cases: perfect scores, ties, missing events');
console.log('');
console.log('You can now:');
console.log('🌐 Visit http://localhost:5173 for public leaderboard');
console.log('🔐 Login as admin/admin123 for full access');
console.log('👑 Login as owner/owner123 for owner functions');
console.log('🗑️  Run "npm run seed:reset" to clear data');

db.close();
