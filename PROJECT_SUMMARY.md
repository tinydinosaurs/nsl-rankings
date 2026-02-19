# Sport Rankings App — Project Summary

This document describes the requirements and architecture of a national sport rankings web app, intended as a handoff reference for AI coding assistants (Cursor, GitHub Copilot, etc.).

---

## What This App Does

Tracks national rankings for a four-event sport. Admins upload tournament results (via CSV or manual entry); all authenticated users can view sortable rankings and per-competitor history.

---

## Scoring Logic

### Event Score

Each of the four events produces a score of 0–100:

```
event_score = (points_earned / total_points_possible) × 100
```

The displayed event score is the **true average** of all individual tournament event scores — not a running average of averages. The denominator always equals the number of tournaments in which that competitor participated in that event.

### Total Score

```
total_score = (knockdowns_score + distance_score + speed_score + woods_score) / 4
```

- Always divided by 4, regardless of how many events a competitor has participated in.
- If a competitor has never participated in an event, that event contributes 0.
- If a tournament doesn't include an event, that event's score is **unchanged** — it is not averaged in, and does not contribute 0.

### Data Model Consequence

Every raw result (earned points, total points possible, tournament) must be stored permanently. Scores are recomputed from the full history, never stored as a cached average.

---

## The Four Events

| Column       | Notes                           |
| ------------ | ------------------------------- |
| `knockdowns` |                                 |
| `distance`   |                                 |
| `speed`      |                                 |
| `woods`      | Sometimes called "woods course" |

---

## Data Model

### `competitors`

- `id` (PK)
- `name` (text) — human-facing identifier; duplicate detection is case-insensitive

### `tournaments`

- `id` (PK)
- `name` (text, nullable) — strongly encouraged but not required
- `date` (text, **non-nullable**) — required; a tournament without a date is invalid
- `has_knockdowns`, `has_distance`, `has_speed`, `has_woods` (boolean) — which events were held
- `total_points_knockdowns`, `total_points_distance`, `total_points_speed`, `total_points_woods` (real, default 120) — total possible points per event, set per-tournament

### `tournament_results`

- `id` (PK)
- `competitor_id` (FK → competitors)
- `tournament_id` (FK → tournaments)
- `knockdowns_earned`, `distance_earned`, `speed_earned`, `woods_earned` (real, nullable)
    - `null` = event was not held in this tournament (do not include in average)
    - `0` = event was held, competitor scored nothing

### `users`

- `id`, `username`, `password_hash`, `role` (`admin` | `user`)

---

## Business Rules

- **Blank cell in active event** → treated as 0 (not null)
- **Missing event in tournament** → `null` stored, existing score unchanged
- **Total score always /4** — missing events contribute 0 to numerator
- **Tournament deduplication**: warn admin if same name + date already exists; offer to merge or treat as new
- **Competitor deduplication**: matched case-insensitively by name; admin should be able to merge duplicates (future feature)
- **Tournament name without date** → error; date without name → warning but allowed

---

## Tech Stack

| Layer            | Technology                            |
| ---------------- | ------------------------------------- |
| Frontend         | React 18 + Vite                       |
| Routing          | React Router v6                       |
| Table            | TanStack Table v8                     |
| HTTP client      | Axios                                 |
| Backend          | Node.js + Express                     |
| Database (local) | SQLite via `better-sqlite3`           |
| Auth             | JWT (24hr) + bcrypt                   |
| CSV parsing      | PapaParse                             |
| Monorepo         | npm workspaces (`client/`, `server/`) |

### Running Locally

```bash
npm install && npm install --workspace=client && npm install --workspace=server
npm run dev
# Frontend: http://localhost:5173
# Backend:  http://localhost:3001
```

Default credentials (change immediately): `admin` / `admin123`

---

## Project Structure

```
sports-rankings/
├── client/src/
│   ├── pages/
│   │   ├── LoginPage.jsx          # Auth
│   │   ├── RankingsPage.jsx       # Main sortable rankings table
│   │   ├── CompetitorPage.jsx     # Per-competitor history + scores
│   │   ├── UploadPage.jsx         # CSV upload: configure → preview → confirm
│   │   └── AdminPage.jsx          # Tabbed: Competitors, Tournaments, Manual Entry, Users
│   ├── components/shared/Layout.jsx
│   ├── hooks/useAuth.jsx          # Auth context + JWT storage
│   └── utils/api.js               # Axios instance with auth interceptor
└── server/
    ├── index.js                   # Express entry point (port 3001)
    ├── db/
    │   ├── database.js            # SQLite schema + seed
    │   ├── rankings.js            # Score computation (source of truth)
    │   └── csvParser.js           # Flexible CSV parser
    ├── middleware/auth.js         # JWT verify, requireAdmin
    └── routes/
        ├── auth.js                # POST /login, CRUD /users
        ├── rankings.js            # Competitors, tournaments, results endpoints
        └── upload.js              # POST /preview, POST /commit
```

---

## API Endpoints

| Method          | Path                            | Auth  | Description                             |
| --------------- | ------------------------------- | ----- | --------------------------------------- |
| POST            | `/api/auth/login`               | —     | Returns JWT                             |
| GET/POST/DELETE | `/api/auth/users`               | admin | User management                         |
| GET             | `/api/rankings`                 | user  | Full rankings with computed scores      |
| GET             | `/api/rankings/competitors`     | user  | List all competitors                    |
| GET             | `/api/rankings/competitors/:id` | user  | Competitor + full tournament history    |
| POST/PUT/DELETE | `/api/rankings/competitors`     | admin | Manage competitors                      |
| GET/POST/DELETE | `/api/rankings/tournaments`     | admin | Manage tournaments                      |
| POST            | `/api/rankings/results`         | admin | Add/update single result                |
| POST            | `/api/upload/preview`           | admin | Parse CSV, return preview (no DB write) |
| POST            | `/api/upload/commit`            | admin | Commit previewed results to DB          |

---

## CSV Upload Flow

1. Admin selects which events are active and sets total points per event (default 120)
2. Admin enters tournament name (optional but warned if missing) and date (required)
3. CSV is uploaded and parsed by a **flexible parser** that:
    - Scans first 5 rows to find the header row
    - Recognizes column name aliases (e.g. "knock downs", "kd", "knockdown" → knockdowns)
    - Normalizes headers (lowercase, strip non-alphanumeric)
    - Treats blank cells in active events as 0
    - Skips blank rows, warns on non-numeric values
    - Flags values exceeding total_points as warnings (not errors)
    - Reports structured warnings and errors separately
4. Admin sees a **preview table** showing new vs. existing competitors and parsed earned values
5. Admin confirms → results committed in a single DB transaction

---

## UI Features

- **Rankings table**: sortable by any column (TanStack Table), color-coded scores (red → green via HSL), click competitor name to drill down
- **Competitor detail**: score cards per event + total, full tournament history table (newest first)
- **Admin panel**: tabbed interface — Competitors, Tournaments, Manual Entry, Users
- **Manual entry**: select competitor + tournament (auto-shows which events are active for that tournament), enter earned points
- **Role gating**: admin nav links and write operations hidden/blocked for user role

---

## Planned / Future Features

- **Deployment**: Supabase (Postgres) for DB, Railway or Render for backend, Vercel for frontend
- **Competitor merging**: resolve "Bob Smith" vs "Robert Smith" duplicates
- **LLM-assisted CSV parsing**: pass messy spreadsheets to an AI agent for extraction, since data is often collected offline in the field with inconsistent formatting
- **Handwriting recognition**: OCR on scanned score sheets (Google Document AI or AWS Textract)
- **Agent layer**: automate the full import pipeline for admins

---

## Known Issues / Immediate TODOs

- Default seed only creates an admin account; no viewer account is seeded. Fix: add a seeded `viewer`/`viewer123` user account in `server/db/database.js`, or log in as admin first and create one via Admin → Users.
- No competitor merge/deduplication UI yet — names must match exactly (case-insensitive) to be recognized as the same person across uploads.
