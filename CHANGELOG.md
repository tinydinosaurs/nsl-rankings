# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

For the version this app is built around, "users" means admins and the public
visiting the leaderboard — so user-facing changes are anything those folks
would notice. Internal refactors, test changes, and tooling updates can be
noted under `Changed` only when they meaningfully affect contributors.

## [0.4.0](https://github.com/tinydinosaurs/nsl-rankings/compare/v0.3.1...v0.4.0) (2026-06-11)


### Added

* **server:** CORS allowlist + cache header for WordPress embed ([#32](https://github.com/tinydinosaurs/nsl-rankings/issues/32)) ([19fd4ce](https://github.com/tinydinosaurs/nsl-rankings/commit/19fd4cea62c4bc23e1573b839e4aa641da45086a))
* **upload:** add replace-mode for re-uploading to a tournament ([#28](https://github.com/tinydinosaurs/nsl-rankings/issues/28)) ([65f89f9](https://github.com/tinydinosaurs/nsl-rankings/commit/65f89f9282c88266252d2fa5d769f9025c954482))
* **upload:** server-side groundwork for draft-until-commit upload flow ([#21](https://github.com/tinydinosaurs/nsl-rankings/issues/21)) ([58b201d](https://github.com/tinydinosaurs/nsl-rankings/commit/58b201d5c62431485b5449424e611ceb960505e4))
* **upload:** warn-and-remediate banner for missing required CSV columns ([#30](https://github.com/tinydinosaurs/nsl-rankings/issues/30)) ([208aa79](https://github.com/tinydinosaurs/nsl-rankings/commit/208aa793d9fdf18ddb7e1ca53ce45de15f3f6545))

## [0.3.1](https://github.com/tinydinosaurs/nsl-rankings/compare/v0.3.0...v0.3.1) (2026-05-20)


### Fixed

* csv preview error handling ([#17](https://github.com/tinydinosaurs/nsl-rankings/issues/17)) ([b62ed1a](https://github.com/tinydinosaurs/nsl-rankings/commit/b62ed1aca1a40286eb99f5174dde5f3077238b14))
* rankings empty state + require CSV membership column ([#14](https://github.com/tinydinosaurs/nsl-rankings/issues/14)) ([d3d2bf0](https://github.com/tinydinosaurs/nsl-rankings/commit/d3d2bf0e7a8e94c71314657f72b9a0be9fc5c2fe))
* surface CSV parser errors and prevent orphaned tournaments ([#16](https://github.com/tinydinosaurs/nsl-rankings/issues/16)) ([918c854](https://github.com/tinydinosaurs/nsl-rankings/commit/918c8545c34f3620e783d566cd41a394fa3b42d5))

## [0.3.0](https://github.com/tinydinosaurs/nsl-rankings/compare/v0.2.0...v0.3.0) (2026-05-20)


### Added

* **admin:** add help page ([#12](https://github.com/tinydinosaurs/nsl-rankings/issues/12)) ([d73183e](https://github.com/tinydinosaurs/nsl-rankings/commit/d73183e8ed10063a037407659c68947387036314))

## [0.2.0](https://github.com/tinydinosaurs/nsl-rankings/compare/v0.1.0...v0.2.0) (2026-05-14)


### Added

* add shared Checkbox component and migrate 6 call sites ([ba0abdd](https://github.com/tinydinosaurs/nsl-rankings/commit/ba0abdd42fe979c709d7459cc4a7a6062747e276))
* **auth:** add Account page and self-service password change ([#10](https://github.com/tinydinosaurs/nsl-rankings/issues/10)) ([5db06d7](https://github.com/tinydinosaurs/nsl-rankings/commit/5db06d78b3df04924d2588a12282773bdb9be36f))
* **upload:** show confirmation summary after committing results ([#9](https://github.com/tinydinosaurs/nsl-rankings/issues/9)) ([2a20177](https://github.com/tinydinosaurs/nsl-rankings/commit/2a201779db619411bbbff3c52e55086085b972e6))


### Changed

* **tournament-detail:** consolidate metadata editing, add per-row Add Competitor and Remove All Results ([#8](https://github.com/tinydinosaurs/nsl-rankings/issues/8)) ([adce1a1](https://github.com/tinydinosaurs/nsl-rankings/commit/adce1a1d48489d891b5b7a8413d34fe4830a0a16))

## [Unreleased]

### Added
- Member-only public leaderboard. Each competitor now has an `is_member` flag;
  only members appear on the public rankings and the admin Rankings view.
  Non-members still show on the admin Competitors and Tournaments pages with
  a "Non-member" badge.
- CSV uploads recognise a `member` / `NSL Member` column. Missing column =
  every row treated as a member (with a warning).
- Admin Competitors page: membership filter (All / Members / Non-members) and
  a Membership column with badges.
- Add Competitor modal: NSL member checkbox.
- Edit Competitor modal: replaces the inline-per-field profile editor on the
  competitor detail page. Name, email, and membership are now saved together.
- Tournament detail page: "Non-member" badge next to competitors who won't
  appear in the rankings.
- Contributor docs: `LICENSE` (MIT), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `SECURITY.md`, PR template, issue templates, GitHub Actions CI.
- This `CHANGELOG.md`.

### Changed
- Tournament/Upload UX refactor. The standalone Upload page is gone; the nav
  no longer has an Upload entry. "Add Tournament" now opens a single page
  (`/admin/tournaments/new`) with metadata and an optional file picker; the
  date defaults to today. If a file is attached, the user is taken to a
  dedicated preview/confirm page (`/admin/tournaments/:id/upload`); the same
  page is used to add results to existing tournaments from their detail view.
- README rewritten to reflect current deployment, env vars, and the membership
  feature.
- Demo seed data and happy-path mock CSVs updated with mixed
  member / non-member rows so the new filter has something to show.

### Removed
- `/admin/upload` page and the "Upload" nav link. Use "Add Tournament" instead.

## [0.1.0] - 2026-04-29

Initial deployment to Render. Marks the end of the local-only POC phase.

### Added
- Public leaderboard with sortable rankings across four events (knockdowns,
  distance, speed, woods course).
- Admin login (JWT, 24h tokens) with three roles: `owner`, `admin`, `user`.
- CSV / Excel / ODS upload flow: file → preview → confirm. Flexible header
  detection and column aliases.
- Admin pages for competitors, tournaments, individual results, and users.
- Live deployment at https://nsl-rankings.onrender.com on Render Starter,
  with SQLite on a 1 GB persistent disk and auto-deploy from `main`.

[Unreleased]: https://github.com/tinydinosaurs/nsl-rankings/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/tinydinosaurs/nsl-rankings/releases/tag/v0.1.0
