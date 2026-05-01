import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api.js';
import PageHeader from '../../components/shared/PageHeader/PageHeader.jsx';
import EmptyState from '../../components/shared/EmptyState/EmptyState.jsx';
import ConfirmDialog from '../../components/shared/ConfirmDialog/ConfirmDialog.jsx';
import EditResultModal from '../../components/shared/EditResultModal/EditResultModal.jsx';
import EditableField from '../../components/shared/EditableField/EditableField.jsx';
import ResultsUploadForm from '../../components/shared/ResultsUploadForm/ResultsUploadForm.jsx';
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
	const [editingEvents, setEditingEvents] = useState(false);
	const [eventDraft, setEventDraft] = useState(null);
	const [eventSaving, setEventSaving] = useState(false);
	const [eventError, setEventError] = useState('');
	const [sortKey, setSortKey] = useState('competitor_name');
	const [sortDir, setSortDir] = useState('asc');
	const [showUploadForm, setShowUploadForm] = useState(false);

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

	const handleSaveName = async (newName) => {
		await api.put(`/rankings/tournaments/${id}`, { name: newName });
		setTournament((t) => ({ ...t, name: newName }));
	};

	const handleSaveDate = async (newDate) => {
		await api.put(`/rankings/tournaments/${id}`, { date: newDate });
		setTournament((t) => ({ ...t, date: newDate }));
	};

	const handleEditEvents = () => {
		setEventDraft({
			knockdowns: {
				enabled: Boolean(tournament.has_knockdowns),
				total: tournament.total_points_knockdowns,
			},
			distance: {
				enabled: Boolean(tournament.has_distance),
				total: tournament.total_points_distance,
			},
			speed: {
				enabled: Boolean(tournament.has_speed),
				total: tournament.total_points_speed,
			},
			woods: {
				enabled: Boolean(tournament.has_woods),
				total: tournament.total_points_woods,
			},
		});
		setEventError('');
		setEditingEvents(true);
	};

	const handleCancelEvents = () => {
		setEditingEvents(false);
		setEventDraft(null);
		setEventError('');
	};

	const handleSaveEvents = async () => {
		const enabledCount = EVENTS.filter((e) => eventDraft[e.key].enabled).length;
		if (enabledCount === 0) {
			setEventError('At least one event must be enabled');
			return;
		}
		for (const { key, label } of EVENTS) {
			if (eventDraft[key].enabled) {
				const total = Number(eventDraft[key].total);
				if (!total || total <= 0) {
					setEventError(`${label} total points must be greater than 0`);
					return;
				}
			}
		}
		setEventSaving(true);
		setEventError('');
		try {
			const payload = {};
			for (const { key } of EVENTS) {
				payload[`has_${key}`] = eventDraft[key].enabled ? 1 : 0;
				payload[`total_points_${key}`] = Number(eventDraft[key].total);
			}
			const res = await api.put(`/rankings/tournaments/${id}`, payload);
			setTournament((t) => ({ ...t, ...res.data }));
			setEditingEvents(false);
			setEventDraft(null);
		} catch (err) {
			setEventError(err.response?.data?.error || 'Failed to save events');
		} finally {
			setEventSaving(false);
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
		knockdowns: 'blue',
		distance: 'teal',
		speed: 'indigo',
		woods: 'green',
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
				title={tournament.name}
				subtitle={tournament.date}
				action={
					<button
						className="btn btn-danger"
						onClick={() => setDeleteTournamentOpen(true)}
					>
						Delete Tournament
					</button>
				}
			/>

			{/* Details */}
			<section className="card tournament-detail__meta">
				<h2 className="section-title">Details</h2>
				<EditableField
					label="Name"
					value={tournament.name}
					onSave={handleSaveName}
				/>
				<EditableField
					label="Date"
					value={tournament.date}
					onSave={handleSaveDate}
					type="date"
				/>
			</section>

			{/* Events */}
			<section className="card tournament-detail__events">
				<div className="section-title-row">
					<h2 className="section-title">Events</h2>
					{!editingEvents && (
						<button
							className="btn btn-sm btn-secondary"
							onClick={handleEditEvents}
						>
							Edit Events
						</button>
					)}
				</div>
				{editingEvents && eventDraft ? (
					<>
						<div className="events-edit-actions">
							<button
								className="btn btn-sm btn-primary"
								onClick={handleSaveEvents}
								disabled={eventSaving}
							>
								{eventSaving ? 'Saving…' : 'Save'}
							</button>
							<button
								className="btn btn-sm btn-secondary"
								onClick={handleCancelEvents}
								disabled={eventSaving}
							>
								Cancel
							</button>
						</div>
						{EVENTS.map(({ key, label }) => (
							<div key={key} className="event-edit-row">
								<label className="event-edit-toggle">
									<input
										type="checkbox"
										checked={eventDraft[key].enabled}
										onChange={(e) =>
											setEventDraft((d) => ({
												...d,
												[key]: { ...d[key], enabled: e.target.checked },
											}))
										}
									/>
									<span>{label}</span>
								</label>
								{eventDraft[key].enabled && (
									<label className="event-edit-points">
										<span>Total points</span>
										<input
											type="number"
											min="1"
											className="event-points-input"
											value={eventDraft[key].total}
											onChange={(e) =>
												setEventDraft((d) => ({
													...d,
													[key]: { ...d[key], total: e.target.value },
												}))
											}
										/>
									</label>
								)}
							</div>
						))}
						{eventError && <p className="events-edit-error">{eventError}</p>}
					</>
				) : activeEvents.length === 0 ? (
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
					Results <span className="section-count">({participants.length})</span>
				</h2>
				{participants.length > 0 && !showUploadForm && (
					<button
						className="btn btn-sm btn-secondary"
						onClick={() => setShowUploadForm(true)}
					>
						Upload Results
					</button>
				)}
			</div>
			{participants.length === 0 ? (
				<>
					<p className="section-empty-hint">
						No results yet. Upload a results file to get started.
					</p>
					<ResultsUploadForm
						activeEvents={activeEvents.map((e) => e.key)}
						totalPoints={{
							knockdowns: tournament.total_points_knockdowns,
							distance: tournament.total_points_distance,
							speed: tournament.total_points_speed,
							woods: tournament.total_points_woods,
						}}
						tournamentId={tournament.id}
						tournamentName={tournament.name}
						tournamentDate={tournament.date}
						onSuccess={() => load()}
					/>
				</>
			) : showUploadForm ? (
				<>
					<div style={{ marginBottom: 20 }}>
						<ResultsUploadForm
							activeEvents={activeEvents.map((e) => e.key)}
							totalPoints={{
								knockdowns: tournament.total_points_knockdowns,
								distance: tournament.total_points_distance,
								speed: tournament.total_points_speed,
								woods: tournament.total_points_woods,
							}}
							tournamentId={tournament.id}
							tournamentName={tournament.name}
							tournamentDate={tournament.date}
							onSuccess={() => { load(); setShowUploadForm(false); }}
							onBack={() => setShowUploadForm(false)}
							onBackLabel="Cancel"
						/>
					</div>
					<hr style={{ border: 'none', borderTop: '1px solid var(--border)', marginBottom: 20 }} />
				</>
			) : null}
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
		</div>
	);
}
