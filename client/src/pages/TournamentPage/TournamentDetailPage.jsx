import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../utils/api.js';
import PageHeader from '../../components/shared/PageHeader/PageHeader.jsx';
import EmptyState from '../../components/shared/EmptyState/EmptyState.jsx';
import ConfirmDialog from '../../components/shared/ConfirmDialog/ConfirmDialog.jsx';
import EditResultModal from '../../components/shared/EditResultModal/EditResultModal.jsx';
import EditTournamentModal from '../../components/shared/EditTournamentModal/EditTournamentModal.jsx';
import AddResultModal from '../../components/shared/AddResultModal/AddResultModal.jsx';
import Badge from '../../components/shared/Badge/Badge.jsx';
import { EVENT_LIST as EVENTS } from '../../constants/events.js';
import { formatScore as fmt } from '../../utils/formatScore.js';
import '../../styles/podium.css';
import './TournamentDetailPage.css';

export default function TournamentDetailPage() {
	const { id } = useParams();
	const navigate = useNavigate();

	const [tournament, setTournament] = useState(null);
	const [participants, setParticipants] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [deleteResultTarget, setDeleteResultTarget] = useState(null);
	const [editResultTarget, setEditResultTarget] = useState(null);
	const [deleteTournamentOpen, setDeleteTournamentOpen] = useState(false);
	const [editTournamentOpen, setEditTournamentOpen] = useState(false);
	const [addResultOpen, setAddResultOpen] = useState(false);
	const [removeResultsOpen, setRemoveResultsOpen] = useState(false);
	const [sortKey, setSortKey] = useState('competitor_name');
	const [sortDir, setSortDir] = useState('asc');

	const load = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const res = await api.get(`/rankings/tournaments/${id}`);
			setTournament(res.data.tournament);
			setParticipants(res.data.participants ?? []);
		} catch {
			setError('Failed to load tournament');
		} finally {
			setLoading(false);
		}
	}, [id]);

	useEffect(() => {
		load();
	}, [load]);

	const handleDeleteResult = async () => {
		try {
			await api.delete(`/rankings/results/${deleteResultTarget.result_id}`);
			setDeleteResultTarget(null);
			load();
		} catch (err) {
			setError(err.response?.data?.error || 'Failed to delete result');
			setDeleteResultTarget(null);
		}
	};

	const handleDeleteTournament = async () => {
		try {
			await api.delete(`/rankings/tournaments/${id}`);
			navigate('/admin/tournaments');
		} catch (err) {
			setError(err.response?.data?.error || 'Failed to delete tournament');
			setDeleteTournamentOpen(false);
		}
	};

	const handleRemoveAllResults = async () => {
		try {
			await api.delete(`/rankings/tournaments/${id}/results`);
			setRemoveResultsOpen(false);
			load();
		} catch (err) {
			setError(err.response?.data?.error || 'Failed to remove results');
			setRemoveResultsOpen(false);
		}
	};

	const activeEvents = tournament
		? EVENTS.filter((e) => tournament[`has_${e.key}`])
		: [];

	const handleSort = (key) => {
		if (key === sortKey) {
			setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		} else {
			setSortKey(key);
			setSortDir(key === 'competitor_name' ? 'asc' : 'desc');
		}
	};

	if (loading) return <div className="page-loading">Loading tournament…</div>;
	if (error) return <div className="alert alert-error">{error}</div>;
	if (!tournament) return <EmptyState message="Tournament not found." />;

	const EVENT_VARIANTS = {
		knockdowns: 'knockdowns',
		distance: 'distance',
		speed: 'speed',
		woods: 'woods',
	};

	const participantsWithTotal = participants.map((p) => ({
		...p,
		totalEarned: activeEvents.reduce(
			(sum, { key }) => sum + (p[`${key}_earned`] ?? 0),
			0,
		),
	}));

	const topFinishers = [...participantsWithTotal]
		.sort((a, b) => b.totalEarned - a.totalEarned)
		.slice(0, 3);

	const sortedParticipants = [...participantsWithTotal].sort((a, b) => {
		const aVal = a[sortKey];
		const bVal = b[sortKey];
		if (aVal === null && bVal === null) return 0;
		if (aVal === null) return 1;
		if (bVal === null) return -1;
		const cmp =
			typeof aVal === 'string' ? aVal.localeCompare(bVal) : aVal - bVal;
		return sortDir === 'asc' ? cmp : -cmp;
	});

	return (
		<div className="tournament-detail-page">
			<PageHeader
				title={tournament.name || 'Untitled tournament'}
				subtitle={tournament.date}
				action={
					<>
						<button
							className="btn btn-secondary"
							onClick={() => setEditTournamentOpen(true)}
						>
							Edit Tournament
						</button>
						<button
							className="btn btn-danger"
							onClick={() => setDeleteTournamentOpen(true)}
						>
							Delete Tournament
						</button>
					</>
				}
			/>

			{/* Events */}
			<section className="card tournament-detail__events">
				<h2 className="section-title">Events</h2>
				{activeEvents.length === 0 ? (
					<em className="muted">No events configured</em>
				) : (
					<div className="score-cards">
						{activeEvents.map(({ key, label }) => (
							<div
								key={key}
								className={`score-card score-card--${EVENT_VARIANTS[key] ?? 'blue'}`}
							>
								<span className="score-card__label">{label}</span>
								<span className="score-card__value">
									{tournament[`total_points_${key}`]}
								</span>
								<span className="score-card__sublabel">pts available</span>
							</div>
						))}
					</div>
				)}
			</section>

			{/* Top Finishers */}
			{topFinishers.length > 0 && (
				<section className="card tournament-detail__podium">
					<h2 className="section-title">Top Finishers</h2>
					<table className="data-table">
						<thead>
							<tr>
								<th>#</th>
								<th>Competitor</th>
								{activeEvents.map(({ key, label }) => (
									<th key={key}>{label}</th>
								))}
								<th>Total</th>
							</tr>
						</thead>
						<tbody>
							{topFinishers.map((p, i) => {
								const rank = i + 1;
								return (
									<tr
										key={p.result_id}
										data-rank={rank <= 3 ? rank : undefined}
									>
										<td className="rank-num">{rank}</td>
										<td>
											<button
												className="competitor-link"
												onClick={() =>
													navigate(`/admin/competitors/${p.competitor_id}`)
												}
											>
												{p.competitor_name}
											</button>
										</td>
										{activeEvents.map(({ key }) => (
											<td
												key={key}
												className={
													p[`${key}_earned`] === null
														? 'score-cell null-score'
														: 'score-cell'
												}
											>
												{fmt(p[`${key}_earned`])}
											</td>
										))}
										<td className="score-cell total-earned">{p.totalEarned}</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</section>
			)}

			{/* Participants */}
			<section className="card tournament-detail__participants">
				<div className="section-title-row">
					<h2 className="section-title">
						Results{' '}
						<span className="section-count">({participants.length})</span>
					</h2>
					{participants.length > 0 && (
						<div className="results-actions">
							<button
								className="btn btn-sm btn-secondary"
								onClick={() =>
									navigate(`/admin/tournaments/${tournament.id}/upload`)
								}
							>
								Upload Results
							</button>
							<button
								className="btn btn-sm btn-secondary"
								onClick={() => setAddResultOpen(true)}
							>
								Add Competitor
							</button>
							<button
								className="btn btn-sm btn-danger"
								onClick={() => setRemoveResultsOpen(true)}
							>
								Remove All Results
							</button>
						</div>
					)}
				</div>
				{participants.length === 0 && (
					<div
						className="section-empty-hint"
						style={{
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'flex-start',
							gap: '0.75rem',
						}}
					>
						<span>
							No results yet. Upload a results file or add one manually to get
							started.
						</span>
						<div className="results-actions">
							<button
								className="btn btn-primary"
								onClick={() =>
									navigate(`/admin/tournaments/${tournament.id}/upload`)
								}
							>
								Upload Results
							</button>
							<button
								className="btn btn-secondary"
								onClick={() => setAddResultOpen(true)}
							>
								Add Competitor
							</button>
						</div>
					</div>
				)}
				{participants.length > 0 && (
					<div className="table-wrapper">
						<table className="data-table">
							<thead>
								<tr>
									<th
										className="sortable-th"
										onClick={() => handleSort('competitor_name')}
									>
										Competitor
										{sortKey === 'competitor_name' && (
											<span className="sort-indicator">
												{sortDir === 'asc' ? ' ▲' : ' ▼'}
											</span>
										)}
									</th>
									{activeEvents.map(({ key, label }) => (
										<th
											key={label}
											className="sortable-th"
											onClick={() => handleSort(`${key}_earned`)}
										>
											{label}
											{sortKey === `${key}_earned` && (
												<span className="sort-indicator">
													{sortDir === 'asc' ? ' ▲' : ' ▼'}
												</span>
											)}
										</th>
									))}
									<th
										className="sortable-th"
										onClick={() => handleSort('totalEarned')}
									>
										Total
										{sortKey === 'totalEarned' && (
											<span className="sort-indicator">
												{sortDir === 'asc' ? ' ▲' : ' ▼'}
											</span>
										)}
									</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{sortedParticipants.map((p) => (
									<tr key={p.result_id}>
										<td>
											<button
												className="competitor-link"
												onClick={() =>
													navigate(`/admin/competitors/${p.competitor_id}`)
												}
											>
												{p.competitor_name}
											</button>
											{p.competitor_is_member === 0 && (
												<>
													{' '}
													<Badge text="Non-member" variant="neutral" />
												</>
											)}
										</td>
										{activeEvents.map(({ key }) => (
											<td
												key={key}
												className={
													p[`${key}_earned`] === null
														? 'score-cell null-score'
														: 'score-cell'
												}
											>
												{fmt(p[`${key}_earned`])}
											</td>
										))}
										<td className="score-cell total-earned">{p.totalEarned}</td>
										<td className="row-actions">
											<button
												className="btn btn-sm btn-secondary"
												onClick={() => setEditResultTarget(p)}
											>
												Edit
											</button>
											<button
												className="btn btn-sm btn-danger"
												onClick={() => setDeleteResultTarget(p)}
											>
												Delete
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>
			{editResultTarget && (
				<EditResultModal
					key={editResultTarget.result_id}
					result={editResultTarget}
					title={`Edit Result — ${editResultTarget.competitor_name}`}
					onClose={() => setEditResultTarget(null)}
					onSaved={load}
				/>
			)}
			<ConfirmDialog
				isOpen={!!deleteResultTarget}
				title="Delete Result"
				message={`Remove ${deleteResultTarget?.competitor_name}'s result from this tournament? This cannot be undone.`}
				confirmLabel="Delete Result"
				variant="danger"
				onConfirm={handleDeleteResult}
				onCancel={() => setDeleteResultTarget(null)}
			/>

			<ConfirmDialog
				isOpen={deleteTournamentOpen}
				title="Delete Tournament"
				message={
					participants.length > 0
						? `Permanently delete "${tournament.name}" and all ${participants.length} result(s)? This cannot be undone.`
						: `Permanently delete "${tournament.name}"? This cannot be undone.`
				}
				confirmLabel="Delete Tournament"
				variant="danger"
				onConfirm={handleDeleteTournament}
				onCancel={() => setDeleteTournamentOpen(false)}
			/>

			<ConfirmDialog
				isOpen={removeResultsOpen}
				title="Remove All Results"
				message={`Remove all ${participants.length} result(s) from "${tournament.name || 'this tournament'}"? The tournament itself will remain so you can upload a new file or add competitors individually. This cannot be undone.`}
				confirmLabel="Remove All Results"
				variant="danger"
				onConfirm={handleRemoveAllResults}
				onCancel={() => setRemoveResultsOpen(false)}
			/>

			<EditTournamentModal
				isOpen={editTournamentOpen}
				tournament={tournament}
				onClose={() => setEditTournamentOpen(false)}
				onSaved={(updated) => setTournament((t) => ({ ...t, ...updated }))}
			/>

			{addResultOpen && (
				<AddResultModal
					tournamentId={tournament.id}
					existingCompetitorIds={participants.map((p) => p.competitor_id)}
					helperText={
						<>
							Select an existing competitor from the list. To add a brand-new
							competitor to the system, head to the{' '}
							<Link to="/admin/competitors">Competitors page</Link> first.
						</>
					}
					onClose={() => setAddResultOpen(false)}
					onSaved={load}
				/>
			)}
		</div>
	);
}
