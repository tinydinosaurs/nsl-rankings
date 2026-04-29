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

The path from POC to MVP — everything needed before handing the app to a real user for real data entry.

### 1. WordPress Embed (Public Leaderboard)

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

### 2. Mobile-Readable Public Leaderboard

The current rankings table is not optimized for small screens. The leaderboard URL will be shared on phones — this matters more than internal admin polish.

**Scope:**
- Small screens: collapse to a card layout, or horizontal scroll with sticky competitor name + total score columns
- Event columns may scroll out of view on narrow screens — that's acceptable as long as name + total stay visible

### 3. Password Change UI

Owner and admin accounts currently have no way to change their own password — passwords are set at creation by whoever created the account (the owner via env vars, admins via the user management UI). Before going live with real users this needs to exist so admins aren't dependent on the owner for password resets.

**Scope:**
- Add `PUT /api/auth/me/password` — accepts `{ currentPassword, newPassword }`, verifies current via bcrypt, updates `password_hash`
- Add a "Profile" or "Account Settings" page (e.g. `/admin/account`) accessible from the nav when logged in
- Form: current password, new password, confirm new password
- Same password strength rules as account creation
- Apply to all roles (`owner`, `admin`)

No password reset flow (email-based "I forgot my password") for MVP — owner can reset an admin's password manually via `/admin/users`. Self-service reset is a post-MVP item if/when needed.

### 4. Hide Login from Public Leaderboard

The public leaderboard currently has a visible "Login" button in the nav. Most visitors can't create an account, so it's confusing. Need to make the login path discoverable to admins but not surfaced on the public page.

**Approach:**
- Remove the login link from the public nav
- Keep `/login` as the route (or move to a slightly less obvious path like `/admin-login`)
- Admins bookmark the URL
- Optional: small "Staff" link in the footer if total invisibility feels too aggressive

This is "security through obscurity" only at the URL level — actual security is the JWT auth. The point is UX, not access control.

### 5. Custom Domain

Move from `nsl-rankings.onrender.com` to a real domain (e.g. `rankings.nationalslingshotleague.org` or whatever the org chooses).

**Scope:**
- Buy domain (or use a subdomain of an existing org domain)
- Render Settings → Custom Domains → add domain → add the CNAME record at the registrar
- Render auto-provisions a free Let's Encrypt TLS cert
- Update the `CLIENT_URL` env var in Render to the new domain (otherwise CORS will reject requests)
- Update the WordPress embed snippet to point at the new domain

The `.onrender.com` URL keeps working in parallel unless explicitly disabled — useful as a fallback during the cutover.

### 6. Outstanding Bugs / Cleanup

From the integration test review (CODE_REVIEW.md, items not yet applied):

- **Fix integration test ESM/CommonJS mixing** — `server/integration.test.js` uses `import` at the top but `require()` for route files. Violates the rule documented in AGENTS.md.
- **Fix multi-tournament test assertions** — the test uses `expect(total).toBeGreaterThan(0)` instead of verifying the actual computed score values. This is the most important test in the file (proves averaging logic) and currently doesn't actually prove anything.
- **Delete the "Integration Test Coverage Summary" block** — fake test that always passes regardless of actual results.

### 7. Pre-Launch Smoke Test

Before declaring MVP, run through the full demo script in production:

1. Open the Render URL in incognito → public leaderboard renders
2. Open the WordPress page → embedded leaderboard renders, matches the app
3. Log in as owner → create an admin account
4. Log in as that admin in another browser → upload a real CSV from a past tournament
5. Edit a result → verify rankings update on both the app and the WordPress embed (after cache window)
6. Delete a result → same verification
7. Verify the owner can't be deleted, admins can't access `/admin/users`

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
- **Password change UI** — self-service for all roles.
- **Advanced reporting / data export** — CSV/PDF export of rankings or results.

### ⏸️ Out of Scope (For Now)

Real ideas, but require significant additional infrastructure or planning:

- **LLM-assisted CSV parsing** — pass messy spreadsheets to an AI agent for extraction
- **Handwriting recognition / OCR** — scan paper score sheets (Google Document AI or AWS Textract)
- **Agent automation layer** — automate the full import pipeline end-to-end
- **TypeScript + GraphQL migration** — worthwhile if the codebase grows substantially
- **Automated accessibility audit** — full WCAG audit once feature set stabilizes
- **Kids ranking** — long-term, would use the division system above
