import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import './AdminPage.css';

// ── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, to, accent }) {
	const inner = (
		<div className={`stat-card${accent ? ' stat-card--accent' : ''}`}>
			<div className="stat-value">{value ?? '—'}</div>
			<div className="stat-label">{label}</div>
			{sub && <div className="stat-sub">{sub}</div>}
		</div>
	);
	return to ? (
		<Link to={to} className="stat-card-link">
			{inner}
		</Link>
	) : (
		inner
	);
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export default function AdminPage() {
	const [competitors, setCompetitors] = useState(null);
	const [tournaments, setTournaments] = useState(null);
	const [rankings, setRankings] = useState(null);
	const navigate = useNavigate();

	useEffect(() => {
		api.get('/rankings/competitors').then((r) => setCompetitors(r.data));
		api.get('/rankings/tournaments').then((r) => setTournaments(r.data));
		api.get('/rankings/public').then((r) => setRankings(r.data.rankings));
	}, []);

	const placeholderCount = competitors?.filter((c) => c.has_placeholder_email).length ?? null;

	const recentTournaments = tournaments
		? [...tournaments]
				.sort((a, b) => new Date(b.date) - new Date(a.date))
				.slice(0, 5)
		: [];

	const topFive = rankings ? rankings.slice(0, 5) : [];
	const leader = rankings?.[0];

	return (
		<div className="admin-page">
			<h1 className="dashboard-title">Dashboard</h1>

			{/* ── Stat Cards ── */}
			<div className="stat-grid">
				<StatCard
					label="Competitors"
					value={competitors?.length ?? '—'}
					to="/admin/competitors"
				/>
				<StatCard
					label="Tournaments"
					value={tournaments?.length ?? '—'}
					to="/admin/tournaments"
				/>
				<StatCard
					label="Need real email"
					value={placeholderCount ?? '—'}
					sub={
						placeholderCount === 0
							? 'All emails set'
							: placeholderCount > 0
								? 'Placeholder addresses'
								: null
					}
					accent={placeholderCount > 0}
					to="/admin/competitors?filter=placeholder"
				/>
				<StatCard
					label="Top Ranked"
					value={leader?.name ?? '—'}
					sub={
						leader?.total != null ? `Score: ${leader.total.toFixed(1)}` : null
					}
					to={leader ? `/admin/competitors/${leader.id}` : null}
				/>
			</div>

			{/* ── Quick Actions ── */}
			<section className="dashboard-section">
				<h2 className="section-heading">Quick Actions</h2>
				<div className="action-grid">
					<button className="action-card" onClick={() => navigate('/upload')}>
						<span className="action-label">Upload Tournament Results</span>
					</button>
					<button
						className="action-card"
						onClick={() => navigate('/admin/competitors')}
					>
						<span className="action-label">Manage Competitors</span>
					</button>
					<button
						className="action-card"
						onClick={() => navigate('/admin/tournaments')}
					>
						<span className="action-label">Manage Tournaments</span>
					</button>
					<button className="action-card" onClick={() => navigate('/')}>
						<span className="action-label">View Public Leaderboard</span>
					</button>
				</div>
			</section>

			{/* ── Two-column panel ── */}
			<div className="dashboard-columns">
				{/* Recent Tournaments */}
				<section className="dashboard-section">
					<div className="section-row">
						<h2 className="section-heading">Recent Tournaments</h2>
						<Link to="/admin/tournaments" className="section-link">
							View all
						</Link>
					</div>
					{tournaments !== null && recentTournaments.length === 0 && (
						<p className="empty-state">
							No tournaments yet. <Link to="/admin/upload">Upload a CSV</Link>{' '}
							to get started.
						</p>
					)}
					<div className="panel-list">
						{recentTournaments.map((t) => (
							<Link
								key={t.id}
								to={`/admin/tournaments/${t.id}`}
								className="panel-row"
							>
								<div className="panel-name">{t.name || t.date}</div>
								<div className="panel-meta">
									{t.name && <span className="meta-date">{t.date}</span>}
									<span className="meta-count">
										{t.participant_count ?? 0} competitors
									</span>
								</div>
							</Link>
						))}
					</div>
				</section>

				{/* Top 5 Snapshot */}
				<section className="dashboard-section">
					<div className="section-row">
						<h2 className="section-heading">Top 5</h2>
						<Link to="/" className="section-link">
							Full leaderboard
						</Link>
					</div>
					{rankings !== null && topFive.length === 0 && (
						<p className="empty-state">No rankings yet.</p>
					)}
					<div className="panel-list">
						{topFive.map((c) => (
							<Link
								key={c.id}
								to={`/admin/competitors/${c.id}`}
								className="panel-row"
							>
								<span className="top-rank">#{c.rank}</span>
								<span className="top-name">{c.name}</span>
								<span className="top-score">
									{c.total?.toFixed(1) ?? '0.0'}
								</span>
							</Link>
						))}
					</div>
				</section>
			</div>
		</div>
	);
}
