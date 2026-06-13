# Runbook

Operational procedures for the NSL Rankings production deployment. This file
is committed to git and deliberately contains no secrets — only navigation
steps, env var **names** (not values), and procedures.

For credentials, account emails, personal contacts, and other sensitive
operational context, see `notes/RUNBOOK.md` (gitignored, maintainer-local).

---

## Production at a glance

- **URL:** https://nsl-rankings.onrender.com
- **Host:** Render web service (Starter plan)
- **Persistent disk:** 1 GB, mounted at `/data`, contains `rankings.db`
- **Database:** SQLite (`better-sqlite3`) — single file, single server
- **Auto-deploy:** push to `main` → Render rebuilds via the GitHub App
  integration → service restarts on success
- **Snapshots:** Render automatically snapshots the persistent disk every
  24 hours; snapshots are retained for at least 7 days

---

## Required environment variables (Render dashboard)

Set in **Render Dashboard → nsl-rankings service → Environment**.

| Variable | Required? | Notes |
|---|---|---|
| `NODE_ENV` | yes | Must be `production`. Triggers fail-fast checks for the secrets below. |
| `JWT_SECRET` | yes | Long random string. Service refuses to start if missing or set to the dev fallback. Rotating invalidates all existing JWTs (everyone gets logged out). |
| `CLIENT_URL` | yes | CORS allowlist origin(s). Accepts a single URL or a comma-separated list (e.g. `https://admin.example.com,https://www.example.com`). Whitespace around commas is trimmed. Update when moving to a custom domain or when adding the WordPress embed — see `docs/WORDPRESS_EMBED.md`. |
| `OWNER_USERNAME` | first boot only | Seeds the owner account on first boot if no owner exists. Safe to remove from the dashboard after the owner is created — seed only runs when the `users` table has no owner row. |
| `OWNER_PASSWORD` | first boot only | Required alongside `OWNER_USERNAME`. Same removal note. |
| `ADMIN_USERNAME` | optional | Seeds one admin on first boot if explicitly set. No env var = no admin seeded. |
| `ADMIN_PASSWORD` | optional | Required alongside `ADMIN_USERNAME`. |
| `PORT` | no | Render injects this automatically. Don't override. |

The fail-fast logic in `server/index.js` and `server/db/database.js` will
`process.exit(1)` with a clear `FATAL:` message in the Render logs if any
required production variable is missing or insecure.

---

## Restoring the database from a snapshot

Render snapshots the persistent disk every 24 hours, retained for ≥7 days.
This is the primary disaster-recovery path.

1. Open the [Render Dashboard](https://dashboard.render.com/)
2. Navigate to the **nsl-rankings** service
3. Click the **Disks** tab
4. Find the snapshot you want to restore from (sorted newest first)
5. Click **Restore** on that row, confirm
6. Render redeploys the service automatically (~2 min downtime — service is
   stopped, disk swapped, service restarted)
7. Verify by visiting https://nsl-rankings.onrender.com/api/health (should
   return `{"status":"ok"}`) and the public leaderboard at `/`

**Important caveats:**

- Restoring rolls the **entire disk** back to the snapshot point. Any
  changes made after the snapshot are lost.
- After a restore, notify any active beta admins that data they entered
  after the snapshot timestamp is gone.
- Append a one-line entry in `notes/RUNBOOK.md` → "Restore log" with the
  date, snapshot timestamp restored to, and reason.

**When to use snapshot restore vs. surgical SQL:**

- Use **snapshot restore** for catastrophic events (table dropped, mass
  delete, corrupt DB).
- Use **surgical SQL via SSH** (below) for "fix this one record" requests.

---

## Rolling back a bad deploy

If a deploy ships a bug that breaks production:

1. Render Dashboard → nsl-rankings service → **Deploys** tab
2. Find the last known-good deploy (the one before the broken one)
3. Click the **⋯** menu on that row → **Redeploy** (or "Rollback" if shown)
4. Render rebuilds the service from that commit's code
5. Verify `/api/health` and the public leaderboard

A rollback restarts the service but does **not** touch the persistent disk.
Data written by the broken version stays on disk.

If the broken version wrote bad data, you may need to restore the disk
snapshot taken just before the broken deploy went live (see above).

---

## SSH into production

Render supports SSH access for inspection and emergency manual fixes.

1. Render Dashboard → nsl-rankings service → top-right area shows the SSH
   command (something like `ssh srv-XXXX@ssh.oregon.render.com`)
2. SSH key must be added to your Render account first
   (Account Settings → SSH Public Keys)
3. Once connected, you're in the running service container with `/data`
   mounted

Common operations once connected:

```sh
# Inspect the live database
sqlite3 /data/rankings.db
> .tables
> .schema users
> SELECT id, username, role FROM users;
> .exit

# Check disk usage
df -h /data
du -sh /data/rankings.db

# Tail the service logs (alternative: Render dashboard → Logs)
# (logs go to stdout/stderr, captured by Render)
```

**Be careful:** anything you write to `/data` is permanent. There is no
"undo" button. Always `.backup` before mutating SQL:

```sh
sqlite3 /data/rankings.db ".backup '/data/pre-fix-$(date +%Y%m%d-%H%M%S).db'"
```

---

## Common surgical fixes

Recipes for one-off corrections that come up in real use. Always run via
SSH (above) and always take a `.backup` snapshot first.

### Manually create an emergency owner account

If you somehow lose access to the owner account:

```sh
# 1. Generate a bcrypt hash locally on your laptop (do NOT do this on the
#    server — it would expose the plaintext in the shell history):
node -e "console.log(require('bcryptjs').hashSync('YOUR_NEW_PASSWORD', 10))"

# 2. SSH into the service and insert the row:
sqlite3 /data/rankings.db
> INSERT INTO users (username, password_hash, role)
  VALUES ('emergency-owner', 'PASTE_HASH_HERE', 'owner');
> .exit

# 3. Log in via the web UI, then immediately rotate the password through
#    /admin/account and consider deleting the emergency account once a
#    real owner is restored.
```

### Delete a duplicate competitor

```sh
sqlite3 /data/rankings.db
> SELECT id, name, email FROM competitors WHERE name LIKE '%Smith%';
# Note the duplicate IDs.
# Cascade will delete that competitor's tournament_results rows too.
> DELETE FROM competitors WHERE id = <duplicate_id>;
> .exit
```

For non-trivial merges (re-parenting results to a canonical competitor),
prefer a real script over ad-hoc SQL.

### Drop a tournament that was uploaded by mistake

The UI supports this (`/admin/tournaments/:id` → Delete). Use the UI when
possible — it's transactional and audit-friendly. Only fall back to SQL if
the UI is broken:

```sh
sqlite3 /data/rankings.db
> DELETE FROM tournaments WHERE id = <id>;
# Cascades to tournament_results.
> .exit
```

---

## Manual off-Render backup (ad-hoc)

For an extra-paranoid one-off backup beyond Render's daily snapshots
(e.g. before a risky migration):

```sh
# From your local machine, with SSH set up:
ssh srv-XXXX@ssh.YOUR_REGION.render.com \
  "sqlite3 /data/rankings.db '.backup /data/manual-backup.db'"

# Then pull it down with scp (note the -s flag for SFTP):
scp -s srv-XXXX@ssh.YOUR_REGION.render.com:/data/manual-backup.db ./
```

This produces a consistent SQLite snapshot (`.backup` is safe even if the
service is writing concurrently). Keep the file in a secure location off
your laptop too (e.g. encrypted external drive or password-manager
attachment).

A scheduled off-Render backup script is **not** currently in place. See
ROADMAP item #7 for the long-term plan (cron + Backblaze B2).

---

## Disk usage monitoring

Render Dashboard → nsl-rankings service → Disks tab shows usage over time.

Current disk: **1 GB**. SQLite is small; expect the file to be in the
single-digit megabytes range even with hundreds of competitors and
tournaments. If usage starts climbing rapidly, investigate before increasing
disk size — likely indicates runaway logging or an unintended write loop.

You can increase disk size from the dashboard but **cannot decrease it**.

---

## Health check

`GET /api/health` → `{"status":"ok"}` (no auth required).

Render uses this internally for its own health monitoring. UptimeRobot also
hits it; see below.

---

## External uptime monitoring (UptimeRobot)

A UptimeRobot keyword monitor watches the production health endpoint and
emails the maintainer if it fails. Free tier; sufficient for this scale.

- **Monitor name:** `NSL Rankings — health`
- **Type:** Keyword monitor
- **URL:** `https://nsl-rankings.onrender.com/api/health`
- **Keyword:** `ok` (alert if missing)
- **Interval:** 5 minutes
- **Alert channel:** email
- **Public status page:** https://stats.uptimerobot.com/OydHksXG89

**When the production URL changes** (e.g. cutover to the custom domain):

1. UptimeRobot dashboard → edit the monitor → update the URL field to the
   new `/api/health` path. No need to recreate.
2. Confirm the monitor flips back to "Up" within one check interval.
3. The public status page URL stays the same.

---

## Notification settings (Render-native)

Render Dashboard → Account Settings → Notifications. Defaults send email
on:

- Deploy failure
- Service crash / out-of-memory restart
- Plan billing issues

Confirm these are enabled. They are the **only** Render-native alerting;
external uptime monitoring still requires a third party.

---

## Rotating credentials

### Owner password

Use `/admin/account` → Change password. Done.

### JWT_SECRET

Rotating invalidates all current sessions (everyone gets logged back to
`/login`).

1. Generate a new long random string locally:
   `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
2. Render Dashboard → nsl-rankings → Environment → update `JWT_SECRET`
3. Save → Render redeploys automatically (~1 min)
4. All existing JWTs become invalid; users log in again

### Admin password (when an admin can't change it themselves)

Owner logs into `/admin/users`, edits the row, sets a new password, shares
it via a secure channel. Admin should change it again on first login.

---

## What's NOT covered here yet

- **WordPress embed integration** — not built yet. See ROADMAP #1.
- **Off-Render scheduled backups** — not built yet. See ROADMAP #7.
- **External uptime monitoring** — not set up yet. See ROADMAP #8.
- **Error tracking (Sentry / equivalent)** — deferred until error volume
  warrants it.
- **Custom domain procedures** — pending org decision. See ROADMAP #14.

When any of the above ship, add their operational procedures here.
