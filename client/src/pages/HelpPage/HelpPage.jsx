import PageHeader from '../../components/shared/PageHeader/PageHeader.jsx';
import { Link } from 'react-router-dom';
import './HelpPage.css';

/*
 * Admin Help / Instructions page.
 *
 * Design notes (see notes/ROADMAP.md "5. Admin Instructions Page" for the full
 * rationale):
 * - Single long page with a TOC at the top + section anchors. Picked over an
 *   accordion (breaks Ctrl-F, awkward deep links) and over a sticky sidebar
 *   (deferred until we know admins want it). The markup here is structured so
 *   the sidebar version is a CSS-only upgrade later — every section has an
 *   `id` on its <h2>, and the TOC is a plain <nav> + <ul> of anchor links.
 * - Content is static and hand-authored. Dynamic-from-server (e.g. pulling the
 *   column alias list from csvParser.js) is overkill at this scale. If you
 *   edit server/db/csvParser.js COLUMN_ALIASES, also update the "CSV format"
 *   section below.
 */

const SECTIONS = [
	{ id: 'quick-start', label: 'Quick start' },
	{ id: 'uploading', label: 'Uploading a tournament' },
	{ id: 'csv-format', label: 'CSV format' },
	{ id: 'fixing-mistakes', label: 'Fixing mistakes' },
	{ id: 'editing-tournament', label: 'Editing tournament details' },
	{ id: 'competitors', label: 'Managing competitors' },
	{ id: 'scoring', label: 'How rankings are calculated' },
	{ id: 'account', label: 'Your account' },
	{ id: 'contact', label: 'Something looks wrong' },
];

export default function HelpPage() {
	return (
		<div className="help-page">
			<PageHeader
				title="Help"
				subtitle="Plain-English answers to the things admins ask most. Skim the table of contents, or read top-to-bottom on your first pass."
			/>

			<nav className="help-toc card" aria-label="On this page">
				<h2 className="section-title">On this page</h2>
				<ul>
					{SECTIONS.map((s) => (
						<li key={s.id}>
							<a href={`#${s.id}`}>{s.label}</a>
						</li>
					))}
				</ul>
			</nav>

			<section className="card help-section" aria-labelledby="quick-start">
				<h2 id="quick-start" className="section-title">
					Quick start
				</h2>
				<p>
					You just want to upload a tournament. Here's the whole flow in three
					steps:
				</p>
				<ol>
					<li>
						Go to <Link to="/admin/tournaments">Tournaments</Link> and click{' '}
						<strong>Add Tournament</strong>.
					</li>
					<li>
						Fill in the tournament name and date, attach the results file
						(CSV, XLSX, XLS, or ODS), and click <strong>Save</strong>.
					</li>
					<li>
						You'll be taken to a preview page. Look it over — every row, every
						score. If everything looks right, click <strong>Commit</strong>.
						Done.
					</li>
				</ol>
				<p>
					If you don't have the file ready yet, save the tournament without a
					file and add results later from the tournament's detail page.
				</p>
			</section>

			<section className="card help-section" aria-labelledby="uploading">
				<h2 id="uploading" className="section-title">
					Uploading a tournament
				</h2>
				<p>
					The upload flow has a deliberate two-step shape:{' '}
					<strong>preview first, commit second</strong>. The preview never
					writes anything to the database — it parses your file, matches
					competitors by email, and shows you exactly what would change. Use it
					to catch mistakes (missing rows, wrong columns, typos in names)
					before they land.
				</p>
				<p>
					The preview also surfaces <strong>warnings</strong>: blank cells
					treated as zero, generated placeholder emails, values that exceed
					the event's total points, duplicate emails in the same file, and
					columns the parser didn't recognize. Read them. A warning isn't a
					blocker, but it usually means something needs a second look.
				</p>
				<p>
					Once you commit, the results are saved. If something turns out wrong
					afterward, see <a href="#fixing-mistakes">Fixing mistakes</a>.
				</p>
			</section>

			<section className="card help-section" aria-labelledby="csv-format">
				<h2 id="csv-format" className="section-title">
					CSV format
				</h2>
				<p>
					The parser is flexible. Column order doesn't matter, headers are
					case-insensitive, and the first few rows can be junk (the parser
					scans the first 5 rows looking for the header row). Accepted file
					types: <code>.csv</code>, <code>.xlsx</code>, <code>.xls</code>,
					<code>.ods</code>.
				</p>

				<h3>Required columns</h3>
				<ul>
					<li>
						<strong>Name</strong> — also recognized as: <code>competitor</code>
						, <code>athlete</code>, <code>player</code>,{' '}
						<code>participant</code>, <code>full name</code>.
					</li>
					<li>
						<strong>Email</strong> — also recognized as: <code>e-mail</code>,
						<code>email address</code>. Email is the unique identifier for a
						competitor — see <a href="#competitors">Managing competitors</a>.
					</li>
				</ul>
				<p className="help-note">
					A row without an email still gets saved — the app generates a
					placeholder like <code>firstname.lastname.nsl@placeholder.local</code>{' '}
					and warns you. Replace it with the real email later from the
					competitor's detail page.
				</p>

				<h3>Event columns</h3>
				<p>
					Include a column for each event the tournament held. Only the events
					you mark as active on the tournament are required.
				</p>
				<ul>
					<li>
						<strong>Knockdowns</strong>: <code>knockdowns</code>,{' '}
						<code>knockdown</code>, <code>knock</code>, <code>kd</code>,{' '}
						<code>knock downs</code>.
					</li>
					<li>
						<strong>Distance</strong>: <code>distance</code>, <code>dist</code>
						, <code>dst</code>.
					</li>
					<li>
						<strong>Speed</strong>: <code>speed</code>, <code>spd</code>,{' '}
						<code>sp</code>, <code>velocity</code>.
					</li>
					<li>
						<strong>Woods course</strong>: <code>woods</code>,{' '}
						<code>wood</code>, <code>woods course</code>, <code>forest</code>,{' '}
						<code>wc</code>.
					</li>
				</ul>

				<h3>Optional columns</h3>
				<ul>
					<li>
						<strong>Membership</strong>: <code>member</code>,{' '}
						<code>nsl member</code>, <code>membership</code>. Accepts yes/no,
						true/false, 1/0. Missing column = everyone treated as a member
						(with a warning).
					</li>
				</ul>

				<h3>What blank cells mean</h3>
				<ul>
					<li>
						<strong>Blank in an active event column</strong> = the competitor
						participated and scored zero. Counted in their average.
					</li>
					<li>
						<strong>Missing event column entirely</strong> (for an active
						event) = treated as zero with a warning. If the event wasn't held,
						mark the event inactive on the tournament instead.
					</li>
					<li>
						<strong>Non-score values</strong> like <code>DNS</code>,{' '}
						<code>DQ</code>, <code>DNF</code>, <code>scratch</code>,{' '}
						<code>WD</code>, <code>n/a</code>, <code>-</code> = the competitor
						did not participate in that event. Excluded from their average
						for that event (neither helps nor hurts the score).
					</li>
				</ul>
			</section>

			<section className="card help-section" aria-labelledby="fixing-mistakes">
				<h2 id="fixing-mistakes" className="section-title">
					Fixing mistakes
				</h2>

				<h3>Wrong score on one row</h3>
				<p>
					Open the tournament from <Link to="/admin/tournaments">Tournaments</Link>
					. Each result row has edit and delete controls. Edit fixes the score
					inline; delete removes that competitor's result for that tournament
					only.
				</p>

				<h3>Missed one competitor</h3>
				<p>
					On the tournament detail page, use <strong>Add Competitor</strong>.
					You can either pick an existing competitor or create a new one
					inline. Faster than re-uploading the whole file.
				</p>

				<h3>The whole file was wrong</h3>
				<p>
					On the tournament detail page, click <strong>Remove All Results</strong>{' '}
					to clear every result for that tournament (the tournament itself
					stays). Then re-upload the corrected file via{' '}
					<strong>Upload Results</strong>. This is the safest path when the
					mistake is widespread (wrong totals, swapped events, etc.).
				</p>

				<h3>Delete an entire tournament</h3>
				<p>
					On the tournament detail page, click <strong>Delete Tournament</strong>
					. This removes the tournament and all of its results. It cannot be
					undone — the confirmation dialog will ask you to type the tournament
					name first.
				</p>
			</section>

			<section
				className="card help-section"
				aria-labelledby="editing-tournament"
			>
				<h2 id="editing-tournament" className="section-title">
					Editing tournament details
				</h2>
				<p>
					On the tournament detail page, the <strong>Edit Tournament</strong>{' '}
					button covers everything about the tournament itself: name, date,
					which events were held (active/inactive toggles), and the total
					possible points for each event.
				</p>
				<p>
					Changing event totals re-scales the percentages on existing results
					automatically — you don't need to re-enter scores. Toggling an event
					off removes it from the average for every competitor in that
					tournament; toggling it back on restores it.
				</p>
			</section>

			<section className="card help-section" aria-labelledby="competitors">
				<h2 id="competitors" className="section-title">
					Managing competitors
				</h2>
				<p>
					The competitor list lives at{' '}
					<Link to="/admin/competitors">Competitors</Link>. Search by name,
					filter by membership, add new competitors, or click any row to see
					that person's full history.
				</p>

				<h3>Email is the unique key</h3>
				<p>
					Behind the scenes, competitors are matched by{' '}
					<strong>email</strong>, not name. This is why "Bob Smith" and "Robert
					Smith" can show up as the same competitor across two tournaments —
					if both files use the same email, they're the same person. It also
					means changing a competitor's name on their profile is safe and
					won't break their history.
				</p>

				<h3>Placeholder emails</h3>
				<p>
					Rows with no email get an auto-generated placeholder ending in{' '}
					<code>@placeholder.local</code>. These work — the competitor still
					gets a record and a ranking — but a "Placeholder email" badge shows
					up on their profile. When you get the real email, open the
					competitor and update it.
				</p>

				<h3>Member vs. non-member</h3>
				<p>
					Only members appear on the public leaderboard. Non-members still
					show up in admin views with a "Non-member" badge, and their results
					are still recorded — they just don't count toward the public
					rankings. Toggle membership on the competitor's profile or via the
					Add/Edit Competitor forms.
				</p>

				<h3>Duplicates</h3>
				<p>
					If you discover the same person was uploaded under two different
					emails, the manual fix today is: pick which email to keep, delete
					the duplicate competitor (this cascades and removes their results),
					and re-upload the affected tournaments with the correct email.
					Better duplicate-merge tooling is on the roadmap.
				</p>
			</section>

			<section className="card help-section" aria-labelledby="scoring">
				<h2 id="scoring" className="section-title">
					How rankings are calculated
				</h2>
				<p>
					The short version, in plain English:
				</p>
				<ul>
					<li>
						For each event, a competitor's score is the{' '}
						<strong>average percentage</strong> they earned across every
						tournament where that event was held. A single tournament's
						contribution is <code>(earned ÷ total points) × 100</code>.
					</li>
					<li>
						Their <strong>total score</strong> is the four event scores added
						together and divided by four. Always divided by four, even if they
						haven't competed in all four events yet.
					</li>
					<li>
						If an event wasn't held in a tournament, that tournament simply
						doesn't count toward the event's average. It neither helps nor
						hurts.
					</li>
					<li>
						If an event was held but the competitor scored zero, that zero{' '}
						<em>does</em> count — they participated and scored nothing, and
						the average reflects that.
					</li>
				</ul>
				<p>
					Scores are never cached. Every time a page loads, the rankings are
					recomputed from the raw results. Edit a result and the new rankings
					are live immediately.
				</p>
			</section>

			<section className="card help-section" aria-labelledby="account">
				<h2 id="account" className="section-title">
					Your account
				</h2>
				<p>
					Click your username in the top-right corner (or under the menu on
					mobile) to open your <Link to="/admin/account">Account page</Link>.
					From there you can change your password.
				</p>
				<p>
					Forgot your password? There's no self-service reset yet — contact
					the owner (see below) and they can set a new one for you.
				</p>
			</section>

			<section className="card help-section" aria-labelledby="contact">
				<h2 id="contact" className="section-title">
					Something looks wrong
				</h2>
				<p>
					If you spot a bug, a confusing flow, or rankings that don't add up,
					contact the league owner or board contact who set up your account.
					Include the tournament name, the competitor name (if relevant), and
					what you expected to see vs. what you actually saw — that's usually
					enough to diagnose.
				</p>
			</section>
		</div>
	);
}
