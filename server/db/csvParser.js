const Papa = require('papaparse');

const { EVENTS } = require('../constants/events');

// Aliases: maps various human-entered column names to canonical event names
const COLUMN_ALIASES = {
  knockdowns: ['knockdowns', 'knockdown', 'knock', 'kd', 'knock downs', 'knock-downs'],
  distance: ['distance', 'dist', 'dst', 'distanc'],
  speed: ['speed', 'spd', 'sp', 'velocity'],
  woods: ['woods', 'wood', 'woods course', 'woods_course', 'woodscourse', 'forest', 'wc'],
  name: ['name', 'competitor', 'athlete', 'player', 'participant', 'full name', 'fullname', 'full_name'],
};

function normalizeHeader(h) {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function detectColumn(header, field) {
  const normalized = normalizeHeader(header);
  return COLUMN_ALIASES[field].some(alias => normalizeHeader(alias) === normalized);
}

/**
 * Given raw CSV text and tournament settings (which events are active, total points per event),
 * parse and return:
 *   { competitors: [...], warnings: [...], errors: [...] }
 *
 * Each competitor: { name, knockdowns_earned, distance_earned, speed_earned, woods_earned }
 * null = event not present in this tournament
 * 0 = event present but blank/zero in spreadsheet
 */
function parseCSV(csvText, tournamentSettings) {
  const { activeEvents, totalPoints } = tournamentSettings;
  const warnings = [];
  const errors = [];

  // Parse with PapaParse — try to detect headers automatically
  const result = Papa.parse(csvText.trim(), {
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (result.errors.length > 0) {
    const fatalErrors = result.errors.filter(e => e.type === 'Delimiter');
    if (fatalErrors.length > 0) {
      errors.push('Could not parse CSV — check that the file uses comma or tab separators.');
      return { competitors: [], warnings, errors };
    }
  }

  const rows = result.data;
  if (rows.length < 2) {
    errors.push('CSV appears to be empty or has no data rows.');
    return { competitors: [], warnings, errors };
  }

  // Find the header row — scan first 5 rows for the one that contains a "name"-like column
  let headerRowIndex = -1;
  let headerRow = null;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const hasName = rows[i].some(cell => detectColumn(String(cell), 'name'));
    if (hasName) {
      headerRowIndex = i;
      headerRow = rows[i].map(String);
      break;
    }
  }

  if (headerRowIndex === -1) {
    errors.push('Could not find a header row. Make sure one of your columns is labeled "name", "competitor", "athlete", or similar.');
    return { competitors: [], warnings, errors };
  }

  if (headerRowIndex > 0) {
    warnings.push(`Header row found at row ${headerRowIndex + 1} (skipped ${headerRowIndex} row(s) above it).`);
  }

  // Map column indices
  const colMap = {};
  headerRow.forEach((h, i) => {
    for (const field of ['name', ...EVENTS]) {
      if (!colMap[field] && detectColumn(h, field)) {
        colMap[field] = i;
      }
    }
  });

  if (colMap.name === undefined) {
    errors.push('No name column found in header row.');
    return { competitors: [], warnings, errors };
  }

  // Warn about active events with no matching column
  for (const event of activeEvents) {
    if (colMap[event] === undefined) {
      warnings.push(`Event "${event}" is marked active but no matching column was found in the CSV. All competitors will receive a score of 0 for this event.`);
    }
  }

  // Parse data rows
  const dataRows = rows.slice(headerRowIndex + 1);
  const competitors = [];
  const seenNames = new Set();

  dataRows.forEach((row, rowIndex) => {
    const lineNum = headerRowIndex + rowIndex + 2; // 1-based, accounting for header

    const rawName = row[colMap.name]?.toString().trim();
    if (!rawName) {
      warnings.push(`Row ${lineNum}: Empty name — skipped.`);
      return;
    }

    if (seenNames.has(rawName.toLowerCase())) {
      warnings.push(`Row ${lineNum}: Duplicate name "${rawName}" — skipped. If this is a different person, resolve before uploading.`);
      return;
    }
    seenNames.add(rawName.toLowerCase());

    const competitor = { name: rawName };

    for (const event of EVENTS) {
      if (!activeEvents.includes(event)) {
        competitor[`${event}_earned`] = null;
        continue;
      }

      if (colMap[event] === undefined) {
        // Column missing for active event → treat as 0
        competitor[`${event}_earned`] = 0;
        continue;
      }

      const raw = row[colMap[event]]?.toString().trim();

      if (!raw || raw === '') {
        // Blank cell in active event → 0
        competitor[`${event}_earned`] = 0;
        warnings.push(`Row ${lineNum} (${rawName}): Blank "${event}" value treated as 0.`);
      } else {
        const val = parseFloat(raw);
        if (isNaN(val)) {
          warnings.push(`Row ${lineNum} (${rawName}): Non-numeric value "${raw}" in "${event}" — treated as 0.`);
          competitor[`${event}_earned`] = 0;
        } else if (val < 0) {
          warnings.push(`Row ${lineNum} (${rawName}): Negative value "${raw}" in "${event}" — treated as 0.`);
          competitor[`${event}_earned`] = 0;
        } else if (val > totalPoints[event]) {
          warnings.push(`Row ${lineNum} (${rawName}): Value "${raw}" in "${event}" exceeds total points (${totalPoints[event]}) — accepted but verify.`);
          competitor[`${event}_earned`] = val;
        } else {
          competitor[`${event}_earned`] = val;
        }
      }
    }

    competitors.push(competitor);
  });

  if (competitors.length === 0) {
    errors.push('No valid competitor rows found after parsing.');
  }

  return { competitors, warnings, errors };
}

module.exports = { parseCSV };
