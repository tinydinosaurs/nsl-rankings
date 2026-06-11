# NSL Rankings — Agent Instructions

## Project Summary
_Copyable snapshot for cross-project conversations (hosting, architecture, etc.)_

**NSL Rankings** is an internal web app for tracking national slingshot league competition results. Admins upload tournament results via CSV; the app computes live rankings across four events (knockdowns, distance, speed, woods course) and displays a public leaderboard.

- **Stack:** React 18 + Vite (frontend), Node.js + Express (backend), SQLite via `better-sqlite3`
- **Auth:** JWT (24hr), three roles: `owner`, `admin`, `user`. Public leaderboard requires no auth.
- **Deployment target:** Render — single web service, Express serves both API and built React app; SQLite lives on a mounted persistent disk
- **Scale:** Small internal tool, ~10–50 competitors, handful of admins. No concurrency requirements.
- **SQLite constraint:** Single-server only — no horizontal scaling, no read replicas. Acceptable for this scale.
- **Data sensitivity:** Low. Stores competitor names, emails (some auto-generated placeholders), and numeric scores. No payment data, no sensitive PII beyond contact info.
- **External services:** None. No third-party auth, no external APIs, no object storage. All processing happens in-process; the only runtime dependency is the SQLite file on local disk.
- **Current state:** Working POC. Not yet deployed to production.

---

This file contains project-specific rules for AI coding assistants. Read it fully before making any changes.

---

## Running the App

**Always start both servers from the project root:**

```bash
npm run dev
```

This uses `concurrently` to start both workspaces in one terminal.

| Service               | URL                   | Command (if running individually) |
| --------------------- | --------------------- | --------------------------------- |
| Frontend (Vite/React) | http://localhost:5173 | `npm run dev --workspace=client`  |
| Backend (Express)     | http://localhost:3001 | `npm run dev --workspace=server`  |

The frontend proxies `/api/*` requests to the backend via Vite config — do not hardcode `localhost:3001` in frontend code.

**Credentials are set via environment variables — never hardcoded.**

Use `server/.env` (this file is gitignored and must never be committed). It contains:

```
OWNER_USERNAME=yourname
OWNER_PASSWORD=yourchosenpassword
ADMIN_USERNAME=adminname
ADMIN_PASSWORD=adminpassword
JWT_SECRET=your-long-random-secret
```

Seeding behavior in `database.js`:

- Owner account: seeds on first boot if no owner exists, using `OWNER_USERNAME` / `OWNER_PASSWORD`. Falls back to `owner`/`owner123` locally if env vars are not set — **this fallback must never reach production**.
- Admin account: seeds on first boot only if `ADMIN_USERNAME` env var is explicitly set. No env var = no admin seeded. This allows the seed to be safely skipped in production after first boot by removing the env vars.
- User account: **the default `user` seed has been removed**. Do not re-add it.

To reset credentials locally: delete `server/data/rankings.db` and restart the server. Seeding runs automatically on a fresh database.

The SQLite database file is created automatically at `server/data/rankings.db` on first run. Delete this file to reset all data and re-run seeding.

---

## Running Tests

Both workspaces have Vitest. Run from the project root:

```bash
# Run all tests (server + client)
npm test

# Server tests only
npm run test:server

# Client tests only
npm run test:client

# Watch mode
npm run test:watch --workspace=server
npm run test:watch --workspace=client

# Run a specific server test file
npm run test --workspace=server -- rankings.test.js
```

Server tests use `environment: 'node'` (vitest.config.js). Client tests use `environment: 'jsdom'` (vite.config.js). Test setup for client is in `client/src/test/setup.js`.

---

## Project Structure

```
nsl-rankings/
├── package.json                        # Root — workspace scripts, start/build commands
├── AGENTS.md                           # AI agent instructions for this project
├── client/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── App.jsx                     # Router + RequireAuth / RequireAdmin / RequireOwner
│       ├── index.css                   # Global styles and CSS variables
│       ├── main.jsx
│       ├── components/
│       │   └── shared/
│       │       ├── AddCompetitorModal/
│       │       ├── AddResultModal/
│       │       ├── Badge/
│       │       ├── Checkbox/
│       │       ├── ConfirmDialog/
│       │       ├── EditCompetitorModal/
│       │       ├── EditResultModal/
│       │       ├── EditTournamentModal/
│       │       ├── EditableField/
│       │       ├── EmptyState/
│       │       ├── EventChip/
│       │       ├── EyeIcons/           # Shared SVG eye icon components
│       │       ├── IdentityStrip/
│       │       ├── Layout/             # Nav + page shell
│       │       ├── Modal/
│       │       ├── PageHeader/
│       ├── constants/
│       │   └── events.js              # Event definitions (client copy)
│       ├── hooks/
│       │   └── useAuth.jsx            # Auth context + JWT storage
│       ├── pages/
│       │   ├── AccountPage/           # /admin/account — profile + change password
│       │   ├── AdminPage/             # /admin — dashboard
│       │   ├── AdminUsersPage/        # /admin/users — owner-only user management
│       │   ├── CompetitorPage/        # /admin/competitors (list + detail)
│       │   ├── HelpPage/              # /admin/help — admin documentation
│       │   ├── LoginPage/             # /login
│       │   ├── RankingsPage/          # / — public leaderboard
│       │   ├── TournamentDraftPage/   # /admin/tournaments/new + /admin/tournaments/:id/upload — unified draft-until-commit page (TournamentUploadWrapper hydrates the update-mode case)
│       │   └── TournamentPage/        # /admin/tournaments (list + detail)
│       ├── styles/
│       │   └── podium.css       ├── test/
       │   └── setup.js               # Vitest client test setup (jsdom)│       └── utils/
│           ├── api.js                 # Axios instance (auth headers, /api proxy)
│           └── formatScore.js
└── server/
    ├── index.js                       # Express entry point, static file serving
    ├── package.json
    ├── integration.test.js
    ├── validation.test.js
    ├── upload.test.js
    ├── seed-demo.js                   # Seed script for demo data
    ├── seed-reset.js                  # Reset + reseed script
    ├── vitest.config.js
    ├── constants/
    │   └── events.js                  # Event definitions — single source of truth
    ├── db/
    │   ├── database.js                # SQLite connection, schema, seeding
    │   ├── rankings.js                # Score computation (core business logic)
    │   ├── rankings.test.js
    │   ├── csvParser.js               # Flexible CSV parsing with column aliases
    │   └── csvParser.test.js
    ├── middleware/
    │   ├── auth.js                    # JWT verify, requireAdmin, requireOwner
    │   ├── errors.js                  # Error classes + global error handler
    │   └── validation.js              # Request body validation
    ├── routes/
    │   ├── auth.js                    # /api/auth/* — login, user CRUD
    │   ├── auth.test.js
    │   ├── rankings.js                # /api/rankings/* and public leaderboard
    │   └── upload.js                  # /api/upload/preview and /commit
    └── utils/
        └── competitorUtils.js
```

---

## Project Docs Layout

Two folders, two purposes — don't mix them.

- **`docs/`** — public, committed to git. Anything other contributors (or the
  GitHub UI) should see. Currently: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `SECURITY.md`, `tokens.yaml`. GitHub auto-discovers community health files
  in `docs/`, the repo root, or `.github/` — keep `CONTRIBUTING.md`,
  `CODE_OF_CONDUCT.md`, and `SECURITY.md` in one of those three locations
  or the auto-linked banners in the GitHub UI disappear.
- **`notes/`** — local-only, **gitignored**. The maintainer's working
  memory: `ROADMAP.md`, `TECH_DEBT.md`, `TROUBLESHOOTING.md`, design
  scratch, archived migration plans. Safe to be candid (cost figures,
  honest "this option sucks because…" notes, half-formed ideas). Files
  here are visible to the maintainer and to AI assistants working in this
  workspace, but not to anyone who clones the repo.

When suggesting where to put new documentation, default to `docs/` for
anything a contributor would benefit from, and `notes/` for working state
that should stay private. If something in `notes/` matures into
contributor-facing reference, promote it to `docs/` with an editorial pass
(strip cost numbers, internal jargon, and unfiltered opinions).

---

## Architecture Rules

### Database injection — always follow this pattern

Route files and business logic must accept a `db` parameter rather than importing `database.js` directly. This is required for testing.

```js
// ✅ CORRECT — factory function pattern
function createAuthRouter(db) {
  const router = express.Router();
  router.post('/login', (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    // ...
  });
  return router;
}
module.exports = createAuthRouter;

// ✅ CORRECT — business logic with default
function computeRankings(dbInstance = db) { ... }

// ❌ WRONG — never do this in route files
const db = require('../db/database');
```

**`server/index.js` wires everything together:**

```js
const db = require('./db/database');
app.use('/api/auth', require('./routes/auth')(db));
app.use('/api/rankings', require('./routes/rankings')(db));
app.use('/api/upload', require('./routes/upload')(db));
```

### Testing pattern

Tests use in-memory SQLite — never `TEST_DATABASE_PATH`, never `vi.mock`, never `require.cache`:

```js
import Database from 'better-sqlite3';

beforeEach(() => {
	db = new Database(':memory:');
	db.exec(`CREATE TABLE ...`);
	// seed test data
});
```

### Module system

- `server/` uses **CommonJS** (`require` / `module.exports`)
- `client/` uses **ESM** (`import` / `export`)
- Never mix them. Do not use `require()` inside test files that have `import` at the top.

---

## Scoring Logic — Do Not Change Without Review

This is the core of the application. The rules are:

- **Event score** = average of `(earned / total_points) × 100` across all tournaments where that event was present for that competitor
- **Total score** = `(knockdowns + distance + speed + woods) / 4` — always divided by 4
- **Null vs zero**: `null` earned = event not held in that tournament (excluded from average). `0` earned = competitor participated and scored nothing (included in average)
- **Missing events** do not change a competitor's existing score — they contribute nothing, positive or negative
- Scores are never cached — always recomputed from raw `tournament_results` rows

The implementation lives in `server/db/rankings.js`. Tests for this logic are the highest-value tests in the project.

---

## Data Model

### Schema

**`competitors`**
- `id` (PK)
- `name` (text) — human-facing; duplicate detection is case-insensitive
- `email` (text, unique) — authoritative identifier
- `created_at`

**`tournaments`**
- `id` (PK)
- `name` (text, nullable) — encouraged but not required
- `date` (text, **non-nullable**) — required; a tournament without a date is invalid
- `has_knockdowns`, `has_distance`, `has_speed`, `has_woods` (boolean) — which events were held
- `total_points_knockdowns`, `total_points_distance`, `total_points_speed`, `total_points_woods` (real, default 120)

**`tournament_results`**
- `id` (PK)
- `competitor_id` (FK → competitors, ON DELETE CASCADE)
- `tournament_id` (FK → tournaments, ON DELETE CASCADE)
- `knockdowns_earned`, `distance_earned`, `speed_earned`, `woods_earned` (real, nullable)
  - `null` = event was not held in this tournament (excluded from average)
  - `0` = event was held, competitor scored nothing (included in average)

**`users`**
- `id`, `username`, `password_hash`, `role` (`owner` | `admin` | `user`), `created_at`

### Key Rules

- `competitors.email` is the **unique identifier** — match returning competitors by email, not name
- Names can vary ("Bob Smith" vs "Robert Smith") — email is authoritative
- Competitors without an email get a generated placeholder: `firstname.lastname.nsl@placeholder.local`
- `tournament_results` stores raw `earned` values — never computed scores
- Deleting a tournament cascades to all its results (foreign key with `ON DELETE CASCADE`)
- Deleting a competitor cascades to all their results

---

## Roles & Access Control

Three roles, in descending order of permission:

| Role    | Can do                                                                                       |
| ------- | -------------------------------------------------------------------------------------------- |
| `owner` | Everything admins can do + create/delete admin accounts                                      |
| `admin` | Upload CSVs, edit/delete results, manage competitors and tournaments, create `user` accounts |
| `user`  | Exists in backend, no current UI purpose — do not build UI for this role                     |

Middleware:

- `requireOwner` — only `owner` role passes
- `requireAdmin` — both `admin` and `owner` pass
- `authenticate` — any valid JWT passes

The public leaderboard (`GET /api/rankings/public`) requires **no auth**, sends `Cache-Control: public, max-age=300`, and is CORS-allowed for every origin in `CLIENT_URL` (which accepts a comma-separated list — see `docs/WORDPRESS_EMBED.md`).

---

## API Endpoints

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| POST | `/api/auth/login` | — | Returns JWT |
| PUT | `/api/auth/me/password` | authenticated | Change own password (verifies current) |
| GET | `/api/auth/users` | owner | List all users |
| POST | `/api/auth/users` | owner | Create a user |
| PUT | `/api/auth/users/:id` | owner | Update username/password/role |
| DELETE | `/api/auth/users/:id` | owner | Delete a user |
| GET | `/api/rankings/public` | — | Public leaderboard + tournament stats. Sends `Cache-Control: public, max-age=300` for embeds (e.g. the WordPress page). |
| GET | `/api/rankings` | authenticated | Full rankings (authenticated view) |
| GET | `/api/rankings/competitors` | authenticated | List competitors with scores + tournament counts |
| GET | `/api/rankings/competitors/:id` | admin | Competitor record |
| GET | `/api/rankings/competitors/:id/history` | admin | Full history, per-event scores, overall rank |
| POST | `/api/rankings/competitors` | admin | Add a competitor |
| PUT | `/api/rankings/competitors/:id` | admin | Edit competitor name/email |
| DELETE | `/api/rankings/competitors/:id` | admin | Delete competitor + all results |
| GET | `/api/rankings/tournaments` | authenticated | List tournaments with participant counts |
| GET | `/api/rankings/tournaments/:id` | authenticated | Tournament detail + participants + event scores |
| POST | `/api/rankings/tournaments` | admin | Create a tournament |
| PUT | `/api/rankings/tournaments/:id` | admin | Edit tournament metadata |
| DELETE | `/api/rankings/tournaments/:id` | admin | Delete tournament + all results |
| DELETE | `/api/rankings/tournaments/:id/results` | admin | Remove all results from a tournament (keeps the tournament row) |
| POST | `/api/rankings/results` | admin | Add or upsert a single result |
| PUT | `/api/rankings/results/:id` | admin | Edit a result |
| DELETE | `/api/rankings/results/:id` | admin | Delete a result |
| POST | `/api/upload/preview` | admin | Parse CSV, return preview (no DB write). Response shape: `{ competitors, warnings, errors, membership_changes, missing_event_columns }`. On parser failure returns 422 with `details: { errors, warnings, missing_required_columns }` where `missing_required_columns` is a structured `string[]` (values: `'name'`, `'is_member'`) used by the client banner. |
| POST | `/api/upload/commit` | admin | Commit previewed results to DB. Accepts optional `replace_mode: boolean` (only valid with `tournament_id`) — when true, every existing result for that tournament is deleted inside the same transaction before the new rows are inserted. Default behavior (omitted or false) is upsert: matching emails overwrite, new emails insert, untouched results stay. |
| GET | `/api/health` | — | Health check |

---

## CSV Parser Rules

- Accepted file types: `.csv`, `.xlsx`, `.xls`, `.ods` — Excel/ODS files are converted to CSV via SheetJS before parsing
- Scans first 5 rows for the header row (spreadsheets often have junk rows at the top)
- Column names are matched via aliases — see `COLUMN_ALIASES` in `csvParser.js`
- **Required columns:** `name` and `is_member`. Missing either of them aborts parsing — the parser pushes an error message into `errors` and includes the missing key in the structured `missing_required_columns: string[]` field. The preview route surfaces this as a 422 with `details.missing_required_columns`; `TournamentDraftPage` renders a warn-and-remediate banner with `[Choose different file]` / `[View CSV format guide]` actions instead of the plain error alert.
- Blank cells in **active** events → `0` (competitor participated, scored nothing)
- Missing event column for an **active** event → `0` with a warning, and the event is included in the parser's structured `missing_event_columns: string[]` field. `TournamentDraftPage` renders a warn-and-remediate banner from that field with `[Choose different file]` / `[Edit tournament events]` actions, and the commit-time confirmation modal surfaces it as an explicit acknowledgement.
- **Non-score values** in `NON_SCORE_VALUES` (`dns`, `dnf`, `scratch`, `n/a`, `-`, `wd`) → `null` (excluded from the competitor's average for that event)
- **DQ / disqualified** → `0` (penalty counts toward the average — a disqualification is a result, not "didn't participate")
- Non-score and DQ warnings are **aggregated by event + value** (e.g. `knockdowns: 3 row(s) marked "DNS"`) rather than emitted per row
- Competitors with no email → generate placeholder, warn, **do not skip**
- Duplicate email within one CSV → warning, skip the second row, continue parsing
- Values exceeding `total_points` → warning, accept the value, continue
- Non-numeric values → warning, treat as `0`
- Do not add `mail` or `contact` as email column aliases — too ambiguous

---

## Pages & Routes

| Route              | Component              | Auth  | Notes                                                 |
| ------------------ | ---------------------- | ----- | ----------------------------------------------------- |
| `/`                        | `RankingsPage`         | None  | Public leaderboard                                    |
| `/login`                   | `LoginPage`            | None  | Redirect to `/admin` if already authed                |
| `/admin`                   | `AdminPage`            | Admin | Dashboard: stats, quick actions, recent tournaments, top 5 |
| `/admin/competitors`       | `CompetitorsListPage`  | Admin | List, search, filter, add, delete competitors         |
| `/admin/competitors/:id`   | `CompetitorDetailPage` | Admin | Edit name/email, view history, delete results         |
| `/admin/tournaments`       | `TournamentListPage`   | Admin | List, add, delete tournaments. "Add Tournament" navigates to `/admin/tournaments/new` |
| `/admin/tournaments/new`   | `TournamentDraftPage`  | Admin | Create a tournament. Single-page draft — metadata, file picker, and inline preview on one screen. Draft is held in sessionStorage; **nothing is written to the DB until Commit**. With a file: posts to `/api/upload/commit`. Without a file: posts to `/api/rankings/tournaments` (metadata-only "shell" tournament). |
| `/admin/tournaments/:id`   | `TournamentDetailPage` | Admin | View/edit results, delete tournament. "Upload Results" button navigates to the upload page. |
| `/admin/tournaments/:id/upload` | `TournamentUploadWrapper` → `TournamentDraftPage` (`mode="update"`) | Admin | Add results to an existing tournament. Wrapper loads the tournament and seeds the draft page's initial metadata; metadata is editable inline and lands in the same transaction as the results via `/api/upload/commit` with `tournament_id` set. When the tournament already has results, the commit-confirm modal exposes a choice between **Update existing results** (upsert) and **Replace all results** (delete + insert in one transaction). No sessionStorage draft layer in update mode. |
| `/admin/users`             | `AdminUsersPage`       | Owner | Create/edit/delete admin and owner accounts           |
| `/admin/account`           | `AccountPage`          | Admin | Profile (username + role) and self-service password change |
| `/admin/help`              | `HelpPage`             | Admin | Admin documentation — upload flow, CSV format, scoring math |

React Router v6 is already configured in `client/src/App.jsx`. Add new routes there — do not create a new router.

---

## What Not to Build (POC Scope)

Do not implement the following without explicit instruction — they are out of scope for the current POC:

- LLM-assisted CSV parsing
- Handwriting recognition / OCR
- User-facing accounts or self-registration
- Password change UI
- Deployment configuration
- Data export or reporting features
- Automated accessibility audits
- Competitor duplicate auto-detection (basic manual merge only)
