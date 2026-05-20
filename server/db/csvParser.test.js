import { describe, it, expect } from 'vitest';
const { parseCSV } = require('./csvParser.js');

// Default tournament settings — all 4 events active, 120 pts each
const allEvents = {
	activeEvents: ['knockdowns', 'distance', 'speed', 'woods'],
	totalPoints: { knockdowns: 120, distance: 120, speed: 120, woods: 120 },
};

// Helpers to build minimal CSVs.
// Most tests don't care about membership, so `csv()` auto-injects a `member`
// column (and a `yes` value per row) when no row already declares one. Tests
// that exercise the "missing membership column" error path use `csvNoMember()`
// to opt out.
function csv(...rows) {
	if (rows.length === 0) return '';
	if (rows.some((r) => /\b(member|members|membership)\b/i.test(r))) {
		return rows.join('\n');
	}
	// Find the header row (the one that mentions a name-like column) so we
	// inject `member` into the header and `yes` into the data rows below it.
	// Rows above the header (junk title rows) and rows that aren't full data
	// rows (single-cell title rows) are passed through unchanged.
	const headerIdx = rows.findIndex((r) =>
		/\b(name|competitor|athlete|player|participant)\b/i.test(r),
	);
	if (headerIdx === -1) return rows.join('\n');
	return rows
		.map((r, i) => {
			if (i < headerIdx) return r;
			if (i === headerIdx) return r + ',member';
			return r + ',yes';
		})
		.join('\n');
}

function csvNoMember(...rows) {
	return rows.join('\n');
}

describe('csvParser', () => {
	describe('happy path', () => {
		it('parses a clean 4-event CSV', () => {
			const text = csv(
				'name,email,knockdowns,distance,speed,woods',
				'Alice,alice@example.com,100,90,110,80',
			);
			const { competitors, warnings, errors } = parseCSV(text, allEvents);
			expect(errors).toHaveLength(0);
			expect(competitors).toHaveLength(1);
			const c = competitors[0];
			expect(c.name).toBe('Alice');
			expect(c.email).toBe('alice@example.com');
			expect(c.knockdowns_earned).toBe(100);
			expect(c.distance_earned).toBe(90);
			expect(c.speed_earned).toBe(110);
			expect(c.woods_earned).toBe(80);
		});

		it('accepts alternate column headers via aliases', () => {
			const text = csv(
				'athlete,e-mail,kd,dist,spd,wc',
				'Bob,bob@example.com,120,115,108,95',
			);
			const { competitors, errors } = parseCSV(text, allEvents);
			expect(errors).toHaveLength(0);
			expect(competitors[0].knockdowns_earned).toBe(120);
			expect(competitors[0].distance_earned).toBe(115);
		});

		it('parses multiple competitors', () => {
			const text = csv(
				'name,email,knockdowns,distance,speed,woods',
				'Alice,alice@example.com,100,90,110,80',
				'Bob,bob@example.com,95,105,88,110',
			);
			const { competitors, errors } = parseCSV(text, allEvents);
			expect(errors).toHaveLength(0);
			expect(competitors).toHaveLength(2);
		});

		it('skips junk rows above the header', () => {
			const text = csv(
				'NSL Tournament Results 2025',
				'name,email,knockdowns,distance,speed,woods',
				'Alice,a@example.com,100,90,110,80',
			);
			const { competitors, errors, warnings } = parseCSV(text, allEvents);
			expect(errors).toHaveLength(0);
			expect(competitors).toHaveLength(1);
			expect(warnings.some((w) => w.includes('row 2'))).toBe(true);
		});
	});

	describe('inactive events', () => {
		it('sets null for events not in activeEvents', () => {
			const text = csv(
				'name,email,knockdowns,distance,speed,woods',
				'Alice,alice@example.com,100,90,110,80',
			);
			const threeEvent = {
				activeEvents: ['knockdowns', 'distance', 'speed'],
				totalPoints: { knockdowns: 120, distance: 120, speed: 120, woods: 120 },
			};
			const { competitors } = parseCSV(text, threeEvent);
			expect(competitors[0].woods_earned).toBeNull();
		});

		it('warns but sets null when an active event column is missing from CSV', () => {
			const text = csv(
				'name,email,knockdowns,distance,speed',
				'Alice,alice@example.com,100,90,110',
			);
			const { competitors, warnings } = parseCSV(text, allEvents);
			expect(competitors[0].woods_earned).toBeNull();
			expect(
				warnings.some(
					(w) =>
						w.includes('"woods"') &&
						w.includes('active but no matching column'),
				),
			).toBe(true);
		});
	});

	describe('blank cells', () => {
		it('treats a blank cell in an active event as 0', () => {
			const text = csv(
				'name,email,knockdowns,distance,speed,woods',
				'Alice,alice@example.com,,90,110,80',
			);
			const { competitors, warnings } = parseCSV(text, allEvents);
			expect(competitors[0].knockdowns_earned).toBe(0);
			expect(
				warnings.some((w) => w.includes('Blank') && w.includes('knockdowns')),
			).toBe(true);
		});
	});

	describe('NON_SCORE_VALUES', () => {
		const nonScoreCases = [
			'DNS',
			'DQ',
			'DNF',
			'Scratch',
			'N/A',
			'-',
			'WD',
			'Disqualified',
		];

		it.each(nonScoreCases)('treats "%s" as null (not 0)', (value) => {
			const text = csv(
				'name,email,knockdowns,distance,speed,woods',
				`Alice,alice@example.com,${value},90,110,80`,
			);
			const { competitors, warnings } = parseCSV(text, allEvents);
			expect(competitors[0].knockdowns_earned).toBeNull();
			expect(warnings.some((w) => w.includes('not scored'))).toBe(true);
		});

		it('is case-insensitive for NON_SCORE_VALUES', () => {
			const text = csv(
				'name,email,knockdowns,distance,speed,woods',
				'Alice,alice@example.com,dns,90,110,80',
			);
			const { competitors } = parseCSV(text, allEvents);
			expect(competitors[0].knockdowns_earned).toBeNull();
		});
	});

	describe('non-numeric values', () => {
		it('treats a non-numeric value as 0 with a warning', () => {
			const text = csv(
				'name,email,knockdowns,distance,speed,woods',
				'Alice,alice@example.com,abc,90,110,80',
			);
			const { competitors, warnings } = parseCSV(text, allEvents);
			expect(competitors[0].knockdowns_earned).toBe(0);
			expect(warnings.some((w) => w.includes('Non-numeric'))).toBe(true);
		});

		it('treats a negative value as 0 with a warning', () => {
			const text = csv(
				'name,email,knockdowns,distance,speed,woods',
				'Alice,alice@example.com,-5,90,110,80',
			);
			const { competitors, warnings } = parseCSV(text, allEvents);
			expect(competitors[0].knockdowns_earned).toBe(0);
			expect(warnings.some((w) => w.includes('Negative'))).toBe(true);
		});

		it('accepts values exceeding total_points with a warning', () => {
			const text = csv(
				'name,email,knockdowns,distance,speed,woods',
				'Alice,alice@example.com,150,90,110,80',
			);
			const { competitors, warnings } = parseCSV(text, allEvents);
			expect(competitors[0].knockdowns_earned).toBe(150);
			expect(warnings.some((w) => w.includes('exceeds total points'))).toBe(
				true,
			);
		});
	});

	describe('placeholder email generation', () => {
		it('generates a placeholder email for competitors with no email', () => {
			const text = csv(
				'name,knockdowns,distance,speed,woods',
				'Alice Nguyen,100,90,110,80',
			);
			const { competitors, warnings } = parseCSV(text, allEvents);
			expect(competitors[0].email).toBe('alice.nguyen.nsl@placeholder.local');
			expect(
				warnings.some((w) => w.includes('placeholder emails were generated')),
			).toBe(true);
		});

		it('generates a placeholder when the email column is present but blank', () => {
			const text = csv(
				'name,email,knockdowns,distance,speed,woods',
				'Bob Smith,,100,90,110,80',
			);
			const { competitors } = parseCSV(text, allEvents);
			expect(competitors[0].email).toBe('bob.smith.nsl@placeholder.local');
		});

		it('is deterministic — same name always produces same placeholder', () => {
			const text = csv(
				'name,knockdowns,distance,speed,woods',
				'Carol Jones,100,90,110,80',
			);
			const { competitors: first } = parseCSV(text, allEvents);
			const { competitors: second } = parseCSV(text, allEvents);
			expect(first[0].email).toBe(second[0].email);
		});
	});

	describe('duplicate email handling', () => {
		it('skips the second row with a duplicate email', () => {
			const text = csv(
				'name,email,knockdowns,distance,speed,woods',
				'Alice,alice@example.com,100,90,110,80',
				'Alice Clone,alice@example.com,50,50,50,50',
			);
			const { competitors, warnings } = parseCSV(text, allEvents);
			expect(competitors).toHaveLength(1);
			expect(warnings.some((w) => w.includes('Duplicate email'))).toBe(true);
		});

		it('duplicate detection is case-insensitive', () => {
			const text = csv(
				'name,email,knockdowns,distance,speed,woods',
				'Alice,Alice@Example.COM,100,90,110,80',
				'Alice Two,alice@example.com,50,50,50,50',
			);
			const { competitors } = parseCSV(text, allEvents);
			expect(competitors).toHaveLength(1);
		});

		it('keeps the first row and continues parsing subsequent valid rows', () => {
			const text = csv(
				'name,email,knockdowns,distance,speed,woods',
				'Alice,alice@example.com,100,90,110,80',
				'Alice Clone,alice@example.com,50,50,50,50',
				'Bob,bob@example.com,95,105,88,110',
			);
			const { competitors } = parseCSV(text, allEvents);
			expect(competitors).toHaveLength(2);
			expect(competitors[0].name).toBe('Alice');
			expect(competitors[1].name).toBe('Bob');
		});
	});

	describe('error cases', () => {
		it('errors when the CSV has no rows', () => {
			const { errors } = parseCSV('', allEvents);
			expect(errors.length).toBeGreaterThan(0);
		});

		it('errors when no name-like column is found', () => {
			const text = csv('score1,score2', '100,90');
			const { errors } = parseCSV(text, allEvents);
			expect(errors.some((e) => e.includes('header row'))).toBe(true);
		});

		it('errors when there are no data rows after the header', () => {
			const text = 'name,email,knockdowns';
			const { errors } = parseCSV(text, allEvents);
			expect(errors.some((e) => e.includes('empty'))).toBe(true);
		});

		it('skips rows with an empty name, with a warning', () => {
			const text = csv(
				'name,email,knockdowns,distance,speed,woods',
				',alice@example.com,100,90,110,80',
				'Bob,bob@example.com,95,105,88,110',
			);
			const { competitors, warnings } = parseCSV(text, allEvents);
			expect(competitors).toHaveLength(1);
			expect(warnings.some((w) => w.includes('Empty name'))).toBe(true);
		});
	});

	describe('membership column', () => {
		it('errors and skips parsing when the membership column is missing', () => {
			const text = csvNoMember(
				'name,email,knockdowns,distance,speed,woods',
				'Alice,alice@example.com,100,90,110,80',
				'Bob,bob@example.com,95,105,88,110',
			);
			const { competitors, errors } = parseCSV(text, allEvents);
			expect(competitors).toHaveLength(0);
			expect(errors.some((e) => e.includes('No membership column found'))).toBe(
				true,
			);
		});

		it('parses true/false values from a "member" column', () => {
			const text = csv(
				'name,email,member,knockdowns,distance,speed,woods',
				'Alice,alice@example.com,true,100,90,110,80',
				'Bob,bob@example.com,false,95,105,88,110',
			);
			const { competitors, warnings } = parseCSV(text, allEvents);
			expect(competitors).toHaveLength(2);
			expect(competitors[0].is_member).toBe(true);
			expect(competitors[1].is_member).toBe(false);
			expect(
				warnings.some((w) => w.includes('No membership column found')),
			).toBe(false);
		});

		it('recognizes alternate truthy/falsy values', () => {
			const text = csv(
				'name,email,membership,knockdowns,distance,speed,woods',
				'A,a@example.com,yes,100,90,110,80',
				'B,b@example.com,Y,100,90,110,80',
				'C,c@example.com,1,100,90,110,80',
				'D,d@example.com,Member,100,90,110,80',
				'E,e@example.com,no,100,90,110,80',
				'F,f@example.com,N,100,90,110,80',
				'G,g@example.com,0,100,90,110,80',
				'H,h@example.com,non-member,100,90,110,80',
			);
			const { competitors } = parseCSV(text, allEvents);
			expect(competitors.map((c) => c.is_member)).toEqual([
				true,
				true,
				true,
				true,
				false,
				false,
				false,
				false,
			]);
		});

		it('matches the "NSL Member" alias header used in mock data', () => {
			const text = csv(
				'Competitor,Email Address,NSL Member,Knock Downs,Dist,Speed,Woods Course',
				'Alice,alice@example.com,yes,100,90,110,80',
				'Bob,bob@example.com,no,95,105,88,110',
			);
			const { competitors, warnings } = parseCSV(text, allEvents);
			expect(competitors).toHaveLength(2);
			expect(competitors[0].is_member).toBe(true);
			expect(competitors[1].is_member).toBe(false);
			expect(
				warnings.some((w) => w.includes('No membership column found')),
			).toBe(false);
		});

		it('warns and treats unknown values as non-member', () => {
			const text = csv(
				'name,email,member,knockdowns,distance,speed,woods',
				'Alice,alice@example.com,maybe,100,90,110,80',
			);
			const { competitors, warnings } = parseCSV(text, allEvents);
			expect(competitors[0].is_member).toBe(false);
			expect(
				warnings.some((w) =>
					w.includes('Unrecognized membership value "maybe"'),
				),
			).toBe(true);
		});

		it('treats blank membership cells as non-member and aggregates them into one warning', () => {
			const text = csv(
				'name,email,member,knockdowns,distance,speed,woods',
				'Alice,alice@example.com,,100,90,110,80',
				'Bob,bob@example.com,,95,105,88,110',
				'Carol,carol@example.com,yes,80,80,80,80',
			);
			const { competitors, warnings } = parseCSV(text, allEvents);
			expect(competitors[0].is_member).toBe(false);
			expect(competitors[1].is_member).toBe(false);
			expect(competitors[2].is_member).toBe(true);
			// Single aggregated warning with the count, not per-row noise.
			const blankWarnings = warnings.filter((w) =>
				w.includes('had no membership value'),
			);
			expect(blankWarnings).toHaveLength(1);
			expect(blankWarnings[0]).toContain('2 row(s)');
		});
	});
});
