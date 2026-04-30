# NSL Rankings — Roadmap

Living planning doc. Tracks where the project stands, what's needed for MVP, and what comes after.

---

## Current State (POC Complete)

The POC is functionally complete and has been demoed to stakeholders. It includes:

- Public leaderboard at `/` (no auth required)
- Admin dashboard, competitor management, tournament management, CSV upload, individual result edit/delete
- Owner-only user management at `/admin/users`
- Three-role auth (`owner`, `admin`, `user`) with JWT
- Email-based competitor identification with placeholder generation for missing emails
- Flexible CSV/Excel/ODS parser (column aliases, header row detection, blank-cell handling)
- 100+ server tests, 45+ client tests, all passing
- Hardened seeding (no fallback credentials, fail-fast on missing env vars in production)

---

## Completed Milestones

Running log of pre-MVP work that's done. Newest at the top.

- **2026-04-29 — Production deployment live on Render.** Web service + 1 GB persistent disk at `/data`, owner account seeded from env vars, GitHub App connected for auto-deploy on push to `main`, `/api/health` green, full owner login → admin creation → CSV upload flow verified. App is live at `https://nsl-rankings.onrender.com`. Total cost: ~$7.25/month (Starter instance + 1 GB disk).

---

## Pre-MVP Work

The path from POC to MVP — everything needed before handing the app to a real user for real data entry. Listed in rough priority order: must-haves for a beta tournament first, operational/admin quality work next, polish and verification last.

### 1. Member-Only Rankings

The CSV will gain a new column (header something like `member` or `NSL member`) containing a boolean. Only competitors marked `true` should appear in rankings. Non-members may compete in tournaments and have their results recorded, but they don't show up on the leaderboard.

**Why this is #1:** it changes the meaning of the leaderboard. Doing the WordPress embed before this would mean re-doing it after.

Detailed plan in the chat thread; high-level scope:

- Add `competitors.is_member` (boolean, default false for new rows; true when backfilling existing rows so the current leaderboard isn't wiped)
- CSV parser: recognize the new column with aliases (`member`, `nsl member`, `is_member`, `membership`); parse common truthy/falsy values; warn if the column is missing entirely (and treat all rows as members for backward compatibility)
- Membership comes *from the CSV* — the latest upload for a competitor wins. Admins can also toggle it manually on the competitor edit page.
- Upload preview shows a **"Membership changes" callout** at the top whenever the incoming CSV would flip any competitor's status (e.g. "3 membership changes: Bob Smith — non-member → member; Alice Jones — non-member → member; Carlos Diaz — member → non-member"). Admin reviews before committing.
- `computeRankings()` filters to `WHERE is_member = 1`
- All admin views still show non-members (with a clear "non-member" badge) so admins can manage them; public leaderboard shows members only
- Add tests covering: ranked vs. unranked, non-member with results, member status change between tournaments

### 2. WordPress Embed (Public Leaderboard)

The non-profit's WordPress site needs to display the leaderboard. The app already exposes `GET /api/rankings/public` — no new endpoint needed.

**Approach:** JSON endpoint + small JavaScript snippet on the WordPress page.

**Server changes:**
- Add the WordPress site's domain to the CORS allowlist (currently configured via `CLIENT_URL` env var — extend to support a comma-separated list, or add a second `WORDPRESS_URL` env var)
- Add `Cache-Control: public, max-age=300` to the `/api/rankings/public` response so browsers and any CDN cache it for 5 minutes

**WordPress side:**
- Add a Custom HTML block (or a snippet in the theme's `functions.php`) on the leaderboard page
- The snippet:
  - Inserts a `<div id="nsl-leaderboard">Loading…</div>` placeholder
  - Fetches the JSON from the Render URL on page load
  - Renders a styled HTML table into the placeholder
  - Handles error state (server unreachable → fallback message)

**Why fetch on page load (not cron):**
- Payload is tiny (a few KB even with 150 competitors)
- Always current — no staleness window
- WordPress's built-in cron (`wp-cron`) is unreliable (only runs on page visits)
- HTTP caching headers handle traffic spikes naturally

If traffic ever becomes a real concern, add a Cloudflare or similar edge cache in front of `/api/rankings/public` — no app changes required.

### 3. Mobile-Readable Public Leaderboard

The current rankings table is not optimized for small screens. The leaderboard URL will be shared on phones — this matters more than internal admin polish.

**Scope:**
- Small screens: collapse to a card layout, or horizontal scroll with sticky competitor name + total score columns
- Event columns may scroll out of view on narrow screens — that's acceptable as long as name + total stay visible
- Empty states matter on day one: leaderboard with zero tournaments, zero competitors, or one tournament should all render gracefully (not a blank page or a broken table)

### 4. Password Change UI

Owner and admin accounts currently have no way to change their own password — passwords are set at creation by whoever created the account (the owner via env vars, admins via the user management UI). Before going live with real users this needs to exist so admins aren't dependent on the owner for password resets.

**Scope:**
- Add `PUT /api/auth/me/password` — accepts `{ currentPassword, newPassword }`, verifies current via bcrypt, updates `password_hash`
- Add a "Profile" or "Account Settings" page (e.g. `/admin/account`) accessible from the nav when logged in
- Form: current password, new password, confirm new password
- Same password strength rules as account creation
- Apply to all roles (`owner`, `admin`)

No password reset flow (email-based "I forgot my password") for MVP — owner can reset an admin's password manually via `/admin/users`. Self-service reset is a post-MVP item if/when needed.

### 5. Hide Login from Public Leaderboard

The public leaderboard currently has a visible "Login" button in the nav. Most visitors can't create an account, so it's confusing. Need to make the login path discoverable to admins but not surfaced on the public page.

**Approach:**
- Remove the login link from the public nav
- Keep `/login` as the route (or move to a slightly less obvious path like `/admin-login`)
- Admins bookmark the URL
- Optional: small "Staff" link in the footer if total invisibility feels too aggressive

This is "security through obscurity" only at the URL level — actual security is the JWT auth. The point is UX, not access control.

### 6. Upload Confirmation + Batch Delete

After clicking "Commit" on the upload preview, the page should clearly confirm what happened — e.g. "27 results imported into Spring Open 2026" with a link to the tournament page. The current success state is too quiet to build trust on a first try.

Paired with this: a **"Delete all results from this tournament"** button on the tournament detail page so a bad upload can be reverted in one click, instead of deleting results individually or nuking the whole tournament. Confirmation dialog required.

Stretch: tag each upload as a batch (`upload_batch_id` on `tournament_results`) and offer an explicit "Undo last upload." The simpler delete-all-for-tournament covers ~90% of real cases.

### 7. Backup Script

Render's persistent disk survives redeploys but is not backed up. Data loss would end the project's credibility. Need at least a daily snapshot stored off-server.

**Approach:**
- Server-side cron (`node-cron`) running once per day
- Use `better-sqlite3`'s `.backup()` API to produce a consistent snapshot file
- Upload the snapshot to Backblaze B2 or AWS S3 (B2 is cheaper at this scale; both have free tiers)
- Retain last 30 days, drop older snapshots
- Document the restore process: download latest snapshot → replace `/data/rankings.db` → restart service

Cost: pennies per month.

### 8. Error Monitoring + Uptime Ping

Right now the only way to know the app is broken is to check Render logs or have a user report it. Two free services close that loop:

- **Sentry** (or equivalent) — server-side SDK captures unhandled exceptions and 5xx responses. Free tier easily covers this app's volume. ~30 min setup.
- **UptimeRobot** (or Better Stack) — pings `/api/health` every 5 min, emails on downtime. Free tier sufficient.

Together: the moment something breaks, you know.

### 9. Footer with Version + "How Rankings Work" Page

Two small polish items that materially reduce support requests:

- Add a footer to every page with the build version (git short SHA, populated at build time via a Vite env var) and deploy timestamp. When someone says "it's broken," you can verify they're on the new code.
- Add a static `/how-rankings-work` page (linked from the public leaderboard) explaining the scoring formula in plain English: per-event averages, total = sum/4, missing events excluded. Reduces "why is X ranked higher than me" arguments.

### 10. CSV Export Per Tournament

The reverse of upload. On the tournament detail page, an admin can click "Export CSV" and download the current state of the tournament's results in the same format the upload accepts. Useful for sharing, archiving, and producing a clean copy after manual edits.

**Implementation:** new endpoint `GET /api/rankings/tournaments/:id/export` returning CSV with the canonical column names. Admin-only.

### 11. Audit Log

Append-only log of every mutating action (create/update/delete on competitors, tournaments, results, users). New `audit_log` table:

- `id`, `user_id`, `username` (denormalized so it stays readable after a user is deleted), `action` (e.g. `result.delete`), `entity_type`, `entity_id`, `before_json`, `after_json`, `timestamp`

Surfaced as an owner-only admin page. Becomes essential the moment two admins disagree about who changed what.

### 12. Tournament Lock

Add `tournaments.locked BOOLEAN DEFAULT 0` (idempotent `ALTER TABLE` migration). Once a tournament is finalized (e.g. at end of season), the owner can lock it — all mutating operations on its results return 403. Unlocking requires a confirmation. Protects historical data from accidental edits.

### 13. Mobile-Readable Admin Pages

Admins may need to add or fix a single result from their phone at the venue. The upload page, competitor list, and tournament detail page need basic responsive layout — not a full mobile redesign, just usable.

**Scope:** same approach as the public leaderboard (sticky important columns, collapse non-essentials, larger tap targets on actions).

### 14. Custom Domain

Move from `nsl-rankings.onrender.com` to a real domain (e.g. `rankings.nationalslingshotleague.org` or whatever the org chooses).

**Scope:**
- Buy domain (or use a subdomain of an existing org domain)
- Render Settings → Custom Domains → add domain → add the CNAME record at the registrar
- Render auto-provisions a free Let's Encrypt TLS cert
- Update the `CLIENT_URL` env var in Render to the new domain (otherwise CORS will reject requests)
- Update the WordPress embed snippet to point at the new domain

The `.onrender.com` URL keeps working in parallel unless explicitly disabled — useful as a fallback during the cutover.

### 15. Outstanding Bugs / Cleanup

From the integration test review (CODE_REVIEW.md, items not yet applied):

- **Fix integration test ESM/CommonJS mixing** — `server/integration.test.js` uses `import` at the top but `require()` for route files. Violates the rule documented in AGENTS.md.
- **Fix multi-tournament test assertions** — the test uses `expect(total).toBeGreaterThan(0)` instead of verifying the actual computed score values. This is the most important test in the file (proves averaging logic) and currently doesn't actually prove anything.
- **Delete the "Integration Test Coverage Summary" block** — fake test that always passes regardless of actual results.

### 16. Pre-Launch Smoke Test

Before declaring MVP, run through the full demo script in production:

1. Open the public URL in incognito → leaderboard renders, including empty/sparse states if applicable
2. Open the WordPress page → embedded leaderboard renders, matches the app
3. Log in as owner → create an admin account → change owner password
4. Log in as that admin in another browser → upload a real CSV from a past tournament
5. Verify the upload confirmation + the audit log entry both appear
6. Edit a result → verify rankings update on both the app and the WordPress embed (after cache window)
7. Delete a result → same verification, audit log captures it
8. Lock the tournament → confirm further edits are rejected
9. Verify the backup script ran in the last 24h (check the B2/S3 bucket)
10. Verify Sentry receives a test error and UptimeRobot reports the service as up
11. Verify the owner can't be deleted, admins can't access `/admin/users`

---

## MVP Definition of Done

The MVP is complete when:

1. The app is deployed to Render with persistent storage and survives a redeploy without losing data
2. The public leaderboard is embedded on the WordPress site and renders correctly on desktop and mobile
3. A board member can log in as admin, upload a tournament CSV, and view updated rankings — without help
4. The mobile leaderboard view is usable (competitor name and total score always visible)
5. The integration test cleanup is done and `npm test` passes cleanly
6. One real beta user has used the app to upload at least one real tournament

---

## Beta Plan

Beta = one real tournament cycle with one or two real admins (board members), using real data.

**What to watch for:**
- CSV format surprises (real spreadsheets that don't match the demo data)
- Confusion in the upload flow (warnings vs. errors, what to do when a competitor's email is missing)
- Mobile leaderboard friction
- Anything that requires you to explain something — that's a UX bug

**Duration:** One tournament cycle (probably 2–4 weeks given the 3-tournaments-per-year cadence). Triage findings into "fix before next tournament" vs. "post-MVP backlog."

---

## Post-MVP Roadmap

Prioritized features for after MVP launch. Reorder as real-world feedback arrives.

### 🔴 Highest Priority

#### Tournament Detail Page on Public Leaderboard
The public leaderboard shows overall rankings but not per-tournament breakdowns. Let visitors click a tournament name (e.g. in a "Recent Tournaments" sidebar) and see who participated and what they scored — read-only, no auth.

Reuses much of the existing admin tournament detail logic; mostly UI/route work plus a public-safe endpoint.

#### "Compare to Existing" Upload Preview
During CSV preview, when a row matches an existing competitor, show side-by-side: "Bob Smith — currently 87.3 overall, will become 84.1 after this tournament." Builds confidence in the math before committing.

Server-side: extend the preview endpoint to compute the projected overall score for each affected competitor. Client-side: show old/new in the preview table.

#### Tournament-Level Total-Points Sanity Check
Individual results that exceed `total_points` already produce a warning. Add a tournament-level check: "5 of 12 results exceed total points — did you mean to set total_points higher?" Catches the common mistake of leaving the default 120 when the event was actually scored out of 150.

#### Annual Season Reset
Rankings should operate on a per-season basis (e.g. 2026, 2027). The leaderboard should reflect only the current season; historical seasons should be browsable but separate.

**Technical sketch:**
- Add a `season` column to `tournaments` (TEXT, e.g. `"2026"`) — derived from date or set explicitly
- Idempotent `ALTER TABLE` migration on startup; backfill existing tournaments based on `date` year
- `computeRankings()` accepts an optional season filter; defaults to current year
- Public leaderboard endpoint accepts `?season=YYYY` query param; defaults to current
- Admin UI: season switcher (dropdown of years with tournaments)
- No destructive reset — historical data is preserved and viewable
- Owner can manually override the "current season" if a season spans a calendar boundary

#### Admin Invitation Flow
The current owner-creates-admin-with-manual-password approach is a stopgap. For a proper workflow:

- Owner generates an invite link with an expiring token
- Admin clicks the link, sets their own username and password
- Token is single-use and expires (e.g. 7 days)
- No email server required — owner shares the link out of band

#### JWT Storage: httpOnly Cookies
Currently the JWT is stored in `localStorage` (XSS risk). Migration plan documented in `useAuth.jsx` and `api.js`:

- Server returns JWT as `Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict`
- Add `cookie-parser` middleware; read token from `req.cookies.token`
- Client: remove all `localStorage` token handling
- Add a lightweight `/api/auth/me` endpoint for the client to re-derive auth state on load

### 🟠 High Priority

#### Competitor Name Merge UI
When "Bob Smith" and "Robert Smith" exist as separate records (different emails), admin needs a way to consolidate them.

- Search for potential duplicates
- Select a canonical record; merge the other into it (re-parent all results)
- Merged record deleted; results preserved under the canonical ID

#### Placeholder Email Collision Warning at Commit
The preview step warns about competitors without emails, but doesn't yet warn at commit time when a placeholder email matches an existing competitor with a different real email — which could silently merge two different people.

#### Division Support
Add a `division` column to `competitors` so different competitor classes (e.g. Pro, Amateur, Kids) can be ranked separately.

- Add `division TEXT` column via idempotent `ALTER TABLE` migration
- Update CSV parser to capture `division` column (add to `COLUMN_ALIASES`)
- Update `computeRankings()` to support filtering by division
- Add division filter UI on public leaderboard and admin views
- **Not urgent** — only build when a real division-based requirement appears (e.g. a kids ranking)

### 🟡 Medium Priority — Code Quality

- **`getCompetitorHistory()` tests** — chronological order, per-tournament score calculation, null handling
- **HTTP integration tests for results & competitors endpoints** — partial updates, auth guards, cascades, placeholder email generation
- **`EditResultModal` component tests** — input rendering for null/non-null events, blank-as-zero behavior
- **N+1 query optimization** — `GET /competitors` and `GET /tournaments` fire multiple queries per row. Acceptable for current scale; collapse into JOINs when performance matters.
- **Overall rank computation** — `GET /competitors/:id/history` calls `computeRankings()` to find one competitor's rank. Replace with a dedicated subquery at scale.
- **Optional-field support in `validateBody`** — would let `PUT /users/:id` use the same middleware as `POST /users`
- **Request validation** — schema validation on remaining routes (`POST /login`, upload routes, ID params)
- **Client-side `getErrorMessage` helper** — replace ad-hoc `err.response?.data?.error` patterns across page components
- **Accessibility** — `htmlFor` labels linked to input `id`s, keyboard navigation audit, focus management

### 🟢 Lower Priority

- **Migrate to React Query (TanStack Query)** — replace `useState(null)` + `useEffect(() => load())` patterns. No user-visible benefit; do at MVP transition or later.
- **Fix `useCallback` linting warnings** — goes away if React Query is adopted.
- **Seasonal view toggle** — current season vs. all-time on the public leaderboard.
- **Bulk actions** — bulk email updates, bulk competitor management.
- **Self-service password reset (email)** — "forgot password" link with email-based recovery. Requires an SMTP/transactional email provider (Resend, Postmark). Owner-driven manual reset covers MVP.
- **Print-friendly leaderboard** — a `?print=1` view (or a well-tuned `@media print` stylesheet) so the leaderboard prints cleanly at the awards ceremony.
- **Advanced reporting / data export** — CSV/PDF export of rankings or results.

### ⏸️ Out of Scope (For Now)

Real ideas, but require significant additional infrastructure or planning:

- **LLM-assisted CSV parsing** — pass messy spreadsheets to an AI agent for extraction
- **Handwriting recognition / OCR** — scan paper score sheets (Google Document AI or AWS Textract)
- **Agent automation layer** — automate the full import pipeline end-to-end
- **TypeScript + GraphQL migration** — worthwhile if the codebase grows substantially
- **Automated accessibility audit** — full WCAG audit once feature set stabilizes
- **Kids ranking** — long-term, would use the division system above
