# NSL Rankings

Internal web app for tracking national slingshot league competition results.
Admins upload tournament CSVs (or Excel/ODS files); the app computes live
rankings across four events — knockdowns, distance, speed, woods course — and
publishes a public leaderboard.

Live: https://nsl-rankings.onrender.com

## Tech Stack

- **Frontend:** React 18 + Vite, TanStack Table, React Router v6
- **Backend:** Node.js + Express
- **Database:** SQLite (`better-sqlite3`) — file-based, single-server
- **Auth:** JWT (24h tokens), bcrypt password hashing, three roles (`owner`,
  `admin`, `user`)
- **CSV parsing:** PapaParse + SheetJS (handles `.csv`, `.xlsx`, `.xls`, `.ods`)

## Quick Start

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend:  http://localhost:3001

The SQLite database is created automatically at `server/data/rankings.db` on
first boot.

### Credentials

Credentials are set via environment variables — never hardcoded. Create
`server/.env` (gitignored) with at least:

```
OWNER_USERNAME=yourname
OWNER_PASSWORD=yourchosenpassword
JWT_SECRET=your-long-random-secret
```

Optional: `ADMIN_USERNAME` / `ADMIN_PASSWORD` to seed an admin account on first
boot. Without `ADMIN_USERNAME`, no admin is seeded.

To reset everything locally:

```bash
rm server/data/rankings.db
npm run dev   # seeding runs again
```

To repopulate with realistic demo data:

```bash
npm run seed:demo --workspace=server
# or wipe + reseed:
npm run seed:reset --workspace=server
```

## Tests

```bash
npm test                 # everything
npm run test:server      # server only
npm run test:client      # client only
```

Server tests use Vitest with an in-memory SQLite DB. Client tests use Vitest +
jsdom + React Testing Library.

## Roles

| Role    | Permissions                                                  |
| ------- | ------------------------------------------------------------ |
| `owner` | Everything admins can do, plus create/delete admin accounts  |
| `admin` | Upload, edit/delete results, manage competitors & tournaments|
| `user`  | Reserved for post-MVP — no current UI                        |

The public leaderboard at `/` requires no authentication.

## Scoring

- **Event score** = average of `(earned / total_points) × 100` across all
  tournaments where that event was held for that competitor.
- **Total score** = `(knockdowns + distance + speed + woods) / 4` — always
  divided by four.
- `null` earned = event not held in that tournament (excluded from average).
  `0` earned = competitor participated and scored nothing (included).
- Missing events do not change a competitor's existing score.
- Scores are never cached — always recomputed from raw results.

Implementation: [server/db/rankings.js](server/db/rankings.js).

## Membership & the public leaderboard

Each competitor has an `is_member` flag. Only members appear on the public
leaderboard and the admin Rankings view. Non-members still show up on the
Competitors and Tournaments admin pages (with a "Non-member" badge), and their
results still feed the per-event history if you toggle them to a member later.

CSVs may include a `member` (or `NSL Member`) boolean column — `true`/`yes`/`1`
mark a competitor as a member; `false`/`no`/`0` mark non-members. If the column
is missing entirely, the parser warns and treats every row as a member to keep
existing workflows working.

## CSV format

The parser is flexible:

- Detects the header row (scans the first 5 rows)
- Recognises common column aliases (`knock downs`, `kd`, `velocity` for speed,
  `forest`/`wc` for woods, etc.)
- Skips blank rows and warns about unparseable values
- Treats blank cells in active events as `0`
- Shows a preview (with warnings) before committing

**Required columns:** competitor name, plus one column per active event.
Missing emails get a generated placeholder
(`firstname.lastname.nsl@placeholder.local`).

## Project structure

See [AGENTS.md](AGENTS.md) for the canonical layout and architecture rules
(database injection pattern, testing conventions, CommonJS vs ESM split,
roadmap, etc.). That file is the source of truth for contributors and AI
assistants.

## Deployment

Deployed on Render as a single web service. Express serves both the API and
the built React app; SQLite lives on a 1 GB persistent disk mounted at `/data`.
Pushes to `main` trigger an automatic redeploy.

## Environment variables (server)

| Variable          | Default                      | Notes                                  |
| ----------------- | ---------------------------- | -------------------------------------- |
| `PORT`            | `3001`                       | API port                               |
| `JWT_SECRET`      | dev fallback                 | **Must be set in production**          |
| `CLIENT_URL`      | `http://localhost:5173`      | CORS origin; required in production    |
| `OWNER_USERNAME`  | —                            | Seeded on first boot if no owner exists |
| `OWNER_PASSWORD`  | —                            | Required alongside `OWNER_USERNAME`    |
| `ADMIN_USERNAME`  | —                            | Optional admin seed                    |
| `ADMIN_PASSWORD`  | —                            | Required alongside `ADMIN_USERNAME`    |
| `NODE_ENV`        | —                            | `production` switches DB to `/data/rankings.db` |
