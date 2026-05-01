# Contributing to NSL Rankings

Thanks for taking the time to help out! This is a small internal tool, but
contributions of any size are welcome — bug reports, fixes, docs, features.

## Quick start

```bash
git clone https://github.com/<your-fork>/nsl-rankings.git
cd nsl-rankings
npm install
npm run dev
```

You'll need Node 20+ and npm 10+. The app runs on http://localhost:5173 and
the API on http://localhost:3001. See [README.md](README.md) for credentials
setup and the full dev environment overview.

## Before you push

Run these locally so CI doesn't fail on your PR:

```bash
npm test     # runs server + client test suites
npm run lint # eslint across both workspaces
```

If you're touching the scoring logic in `server/db/rankings.js`, please add or
update a test in `server/db/rankings.test.js`. That file is the safety net for
the most important business logic in the app.

## Branch naming

Use a short topic prefix and hyphenated description:

| Prefix       | When to use                                |
| ------------ | ------------------------------------------ |
| `feature/`   | New functionality                          |
| `fix/`       | Bug fixes                                  |
| `chore/`     | Tooling, deps, refactors, non-user changes |
| `docs/`      | Docs-only changes                          |
| `experiment/`| Spike work that may not ship               |

Examples: `feature/member-only-rankings`, `fix/duplicate-email-on-upload`,
`chore/upgrade-vitest`.

## Commit messages

Imperative mood, present tense ("Add member badge", not "Added member badge").
Keep the subject line under ~70 characters. Add a body if the *why* isn't
obvious from the diff.

## Pull requests

Open PRs against `main`. The PR template
([.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md)) has the
checklist we expect filled out. The short version:

- Describe **what** changed and **why**
- Link any related issue
- Confirm tests + lint pass locally
- Add a screenshot for any visible UI change
- Call out anything that needs manual smoke-testing or migration

PRs need 1 approval and passing CI before they can merge. Squash-merge is the
default; the PR title becomes the squash commit message, so make it good.

## Code style

- **Server:** CommonJS (`require`/`module.exports`), Node-style errors via
  the classes in `server/middleware/errors.js`
- **Client:** ESM, React function components, hooks, no class components
- Follow the existing patterns — especially the database injection pattern
  documented in [AGENTS.md](AGENTS.md). Routes accept `db` as a parameter; they
  never `require('./db/database')` directly.
- ESLint enforces formatting; run `npm run lint -- --fix` if it complains

## Reporting bugs

Use the **Bug report** issue template. Include:

- What you did
- What you expected
- What actually happened
- Browser + OS if it's a frontend issue
- Any relevant CSV file (sanitized) if it's an upload issue

## Reporting security issues

Don't open a public issue. See [SECURITY.md](SECURITY.md) for how to report
privately.

## Questions?

Open a Discussion or ping the maintainer in an issue. There's no Slack/Discord
yet — keep conversation in the repo so it's searchable.
