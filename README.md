# Sport Rankings App

A national rankings tracker for a four-event sport. Admins upload tournament CSVs or enter results manually; everyone can view sortable rankings and competitor history.

## Tech Stack

- **Frontend**: React 18 + Vite, TanStack Table, React Router
- **Backend**: Node.js + Express
- **Database**: SQLite (via `better-sqlite3`) — zero setup, file-based
- **Auth**: JWT (24hr tokens), bcrypt password hashing
- **CSV Parsing**: PapaParse with flexible column detection

---

## Quick Start

### 1. Install dependencies

```bash
# From the project root
npm install
npm install --workspace=client
npm install --workspace=server
```

### 2. Start development servers

```bash
npm run dev
```

This starts:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

The SQLite database file is created automatically at `server/data/rankings.db`.

### 3. Default admin account

On first run, a default admin is created:
- **Username**: `admin`
- **Password**: `admin123`

**Change this immediately** via Admin → Users.

---

## Project Structure

```
sports-rankings/
├── client/                  # React frontend (Vite)
│   └── src/
│       ├── pages/
│       │   ├── LoginPage.jsx
│       │   ├── RankingsPage.jsx     # Main sortable rankings table
│       │   ├── CompetitorPage.jsx   # Per-competitor history
│       │   ├── UploadPage.jsx       # CSV upload with preview
│       │   └── AdminPage.jsx        # Admin tools (tabs)
│       ├── hooks/useAuth.jsx
│       ├── utils/api.js
│       └── components/shared/Layout.jsx
└── server/
    ├── index.js             # Express entry point
    ├── db/
    │   ├── database.js      # SQLite schema + seed
    │   ├── rankings.js      # Score computation logic
    │   └── csvParser.js     # Flexible CSV parser
    ├── middleware/auth.js   # JWT middleware
    └── routes/
        ├── auth.js          # Login, user management
        ├── rankings.js      # Competitors, tournaments, results
        └── upload.js        # CSV preview + commit
```

---

## Scoring Logic

**Event score** = average of `(earned / total_points) × 100` across all tournaments where that event was present.

**Total score** = `(knockdowns + distance + speed + woods) / 4`  
Missing events contribute 0 to the total (not excluded from denominator).

**On upload**: new scores are added to the per-event history. The displayed score is always the true average of all raw results — not a running average of averages.

---

## CSV Format

The parser is flexible and tolerant of messy spreadsheets. It will:
- Detect the header row (scans first 5 rows)
- Recognize column names by common aliases (e.g. "knock downs", "kd", "knockdown" → knockdowns)
- Skip blank rows and warn about unparseable values
- Treat blank cells in active events as 0
- Show a preview with warnings before committing

**Minimum required columns**: one for competitor names, one per active event.

Example valid CSV:
```
name, knockdowns, distance, speed, woods course
Alice, 90, 80, 110, 60
Bob, 120, 95, 100, 75
```

Totals are set per-upload in the UI (default: 120 per event).

---

## Admin Features

- **Competitors**: Add, rename, delete
- **Tournaments**: Create, delete (deletes all associated results)
- **Manual Entry**: Add/update a single result for any competitor × tournament
- **Upload CSV**: Preview → confirm flow with per-event toggle and total-points override
- **Users**: Create admin or user accounts, delete accounts

---

## Deployment (Future)

When ready to deploy:

1. **Database**: Migrate to [Supabase](https://supabase.com) (free tier, Postgres)
   - Schema maps 1:1 from SQLite → Postgres with minor type adjustments
2. **Backend**: Deploy to [Railway](https://railway.app) or [Render](https://render.com) (both have free tiers)
3. **Frontend**: Deploy to [Vercel](https://vercel.com) or [Netlify](https://netlify.com) (both free)
4. Set environment variables: `JWT_SECRET`, `DATABASE_URL`, `CLIENT_URL`

---

## Environment Variables (server)

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3001` | API port |
| `JWT_SECRET` | `dev-secret-change-in-production` | **Must change in prod** |
| `CLIENT_URL` | `http://localhost:5173` | CORS origin |
