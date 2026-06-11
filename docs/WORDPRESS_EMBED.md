# Embedding the NSL Leaderboard on WordPress

This guide shows how to drop the public NSL leaderboard onto any WordPress
page. The widget fetches the latest rankings from the NSL Rankings server
each time the page loads and renders them as a styled HTML table.

## What you need

- The URL of the NSL Rankings server (e.g. `https://rankings.example.com`).
  This is the same URL where the admin app lives.
- A WordPress page where you want the leaderboard to appear.
- The WordPress site's own URL added to the server's `CLIENT_URL`
  environment variable (see "Server prerequisites" below).

## Server prerequisites

The server's CORS allowlist must include the WordPress site's origin or the
browser will block the fetch. On Render (or wherever the server is hosted),
edit the `CLIENT_URL` environment variable to a **comma-separated list** of
allowed origins:

```
CLIENT_URL=https://admin.example.com,https://www.example.com
```

No quotes, no trailing slashes, no spaces required (whitespace is trimmed).
Redeploy the server after changing the variable.

The `/api/rankings/public` endpoint already:

- Requires no authentication
- Returns JSON in the shape `{ rankings, tournament_count, last_updated }`
- Sends `Cache-Control: public, max-age=300` so the browser caches it for
  5 minutes (handles traffic spikes without hammering the server)

## Step 1 — Add a Custom HTML block

In the WordPress page editor:

1. Click the `+` button and search for **Custom HTML**
2. Paste the snippet from Step 2 into the block
3. Replace `https://rankings.example.com` near the top of the snippet
   with your actual NSL Rankings server URL
4. Publish (or update) the page

## Step 2 — The snippet

```html
<!-- NSL Leaderboard embed — replace RANKINGS_URL with your server URL -->
<div id="nsl-leaderboard" class="nsl-leaderboard">Loading leaderboard…</div>

<style>
	.nsl-leaderboard {
		font-family:
			system-ui,
			-apple-system,
			Segoe UI,
			Roboto,
			sans-serif;
		color: #1a1a1a;
		max-width: 100%;
		overflow-x: auto;
	}
	.nsl-leaderboard table {
		width: 100%;
		border-collapse: collapse;
		min-width: 480px;
	}
	.nsl-leaderboard th,
	.nsl-leaderboard td {
		padding: 0.5rem 0.75rem;
		text-align: left;
		border-bottom: 1px solid #e5e5e5;
	}
	.nsl-leaderboard th {
		font-weight: 600;
		background: #f7f7f7;
		position: sticky;
		top: 0;
	}
	.nsl-leaderboard td.num,
	.nsl-leaderboard th.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.nsl-leaderboard .nsl-rank {
		width: 2.5rem;
		font-weight: 600;
	}
	.nsl-leaderboard .nsl-total {
		font-weight: 600;
	}
	.nsl-leaderboard .nsl-meta {
		font-size: 0.875rem;
		color: #666;
		margin-top: 0.75rem;
	}
	.nsl-leaderboard .nsl-error {
		color: #b00020;
	}
</style>

<script>
	(function () {
		var RANKINGS_URL = 'https://rankings.example.com';
		var container = document.getElementById('nsl-leaderboard');

		function fmt(val) {
			if (val === null || val === undefined) return '—';
			return (Math.round(val * 10) / 10).toFixed(1);
		}

		function escapeHtml(str) {
			return String(str).replace(/[&<>"']/g, function (ch) {
				return {
					'&': '&amp;',
					'<': '&lt;',
					'>': '&gt;',
					'"': '&quot;',
					"'": '&#39;',
				}[ch];
			});
		}

		function render(payload) {
			var rankings = (payload && payload.rankings) || [];
			if (rankings.length === 0) {
				container.innerHTML =
					'<p>No rankings yet — check back after the first tournament.</p>';
				return;
			}

			var rows = rankings
				.map(function (r) {
					return (
						'<tr>' +
						'<td class="nsl-rank num">' +
						r.rank +
						'</td>' +
						'<td>' +
						escapeHtml(r.name) +
						'</td>' +
						'<td class="num">' +
						fmt(r.knockdowns) +
						'</td>' +
						'<td class="num">' +
						fmt(r.distance) +
						'</td>' +
						'<td class="num">' +
						fmt(r.speed) +
						'</td>' +
						'<td class="num">' +
						fmt(r.woods) +
						'</td>' +
						'<td class="num nsl-total">' +
						fmt(r.total) +
						'</td>' +
						'</tr>'
					);
				})
				.join('');

			var meta = '';
			if (payload.tournament_count != null) {
				meta =
					'<p class="nsl-meta">Based on ' +
					payload.tournament_count +
					(payload.tournament_count === 1 ? ' tournament' : ' tournaments');
				if (payload.last_updated) {
					meta += ' · last updated ' + escapeHtml(payload.last_updated);
				}
				meta += '.</p>';
			}

			container.innerHTML =
				'<table>' +
				'<thead><tr>' +
				'<th class="num">#</th>' +
				'<th>Competitor</th>' +
				'<th class="num">Knockdowns</th>' +
				'<th class="num">Distance</th>' +
				'<th class="num">Speed</th>' +
				'<th class="num">Woods Course</th>' +
				'<th class="num">Total Score</th>' +
				'</tr></thead>' +
				'<tbody>' +
				rows +
				'</tbody>' +
				'</table>' +
				meta;
		}

		fetch(RANKINGS_URL + '/api/rankings/public')
			.then(function (res) {
				if (!res.ok) throw new Error('HTTP ' + res.status);
				return res.json();
			})
			.then(render)
			.catch(function (err) {
				container.innerHTML =
					'<p class="nsl-error">Could not load the NSL leaderboard. Please try again later.</p>';
				if (window.console) console.error('NSL leaderboard error:', err);
			});
	})();
</script>
```

## Verifying it works

1. Open the WordPress page in a fresh browser tab (or incognito window)
2. You should see "Loading leaderboard…" briefly, then the ranked table
3. If you see "Could not load the NSL leaderboard", open the browser
   console — the most common causes are:
   - **CORS error** (`Access-Control-Allow-Origin`): the WordPress site's
     origin is not in `CLIENT_URL` on the server
   - **404 / 500**: wrong `RANKINGS_URL`, or the server is down
   - **Mixed content**: the WordPress site is on HTTPS but `RANKINGS_URL`
     is HTTP — both must use HTTPS in production

## Caching behavior

The server sends `Cache-Control: public, max-age=300`, so the browser will
reuse the response for up to 5 minutes before re-fetching. That means:

- After an admin uploads a new tournament, embedded copies may show the old
  data for up to 5 minutes
- Hard-refreshing the WordPress page (Cmd/Ctrl + Shift + R) bypasses the
  cache and forces a fresh fetch

If you ever need a different cache window, change the `max-age` value in
`server/routes/rankings.js` (the `/public` route).

## Customizing the styling

The snippet ships with minimal styling so it can sit on almost any theme
without clashing. To match your WordPress theme:

- Edit the `<style>` block inline (simplest)
- Or move the styles into your theme's stylesheet and remove the inline
  `<style>` block

All selectors are scoped under `.nsl-leaderboard` so they will not leak
into the rest of the page.

## If traffic ever becomes a concern

The endpoint is already light (a few KB of JSON, no images, no auth) and is
cached by the browser for 5 minutes. If the WordPress page ever gets enough
traffic that you see load on the Rankings server, drop a Cloudflare (or
similar) edge cache in front of `rankings.example.com` — no app changes
required.
