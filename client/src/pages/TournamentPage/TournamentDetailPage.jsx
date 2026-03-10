import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api.js';
import PageHeader from '../../components/shared/PageHeader/PageHeader.jsx';
import EmptyState from '../../components/shared/EmptyState/EmptyState.jsx';
import Badge from '../../components/shared/Badge/Badge.jsx';
import ConfirmDialog from '../../components/shared/ConfirmDialog/ConfirmDialog.jsx';
import EditResultModal from '../../components/shared/EditResultModal/EditResultModal.jsx';
import EditableField from '../../components/shared/EditableField/EditableField.jsx';
import { EVENT_LIST as EVENTS } from '../../constants/events.js';
import { formatScore as fmt } from '../../utils/formatScore.js';
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
			knockdowns: { enabled: Boolean(tournament.has_knockdowns), total: tournament.total_points_knockdowns },
			distance: { enabled: Boolean(tournament.has_distance), total: tournament.total_points_distance },
			speed: { enabled: Boolean(tournament.has_speed), total: tournament.total_points_speed },
			woods: { enabled: Boolean(tournament.has_woods), total: tournament.total_points_woods },
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

	const sortedParticipants = [...participants].sort((a, b) => {
		const aVal = a[sortKey];
		const bVal = b[sortKey];
		// nulls always sort to the bottom regardless of direction
		if (aVal === null && bVal === null) return 0;
		if (aVal === null) return 1;
		if (bVal === null) return -1;
		const cmp = typeof aVal === 'string'
			? aVal.localeCompare(bVal)
			: aVal - bVal;
		return sortDir === 'asc' ? cmp : -cmp;
	});

	if (loading) return <div className="page-loading">Loading tournament…</div>;
	if (error) return <div className="alert alert-error">{error}</div>;
	if (!tournament) return <EmptyState message="Tournament not found." />;

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

			{/* Metadata */}
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
				{editingEvents && eventDraft ? (
					<>
						<div className="meta-row">
							<span className="meta-label">Events</span>
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
				) : (
					<>
						<div className="meta-row">
							<span className="meta-label">Events</span>
							<div className="meta-value event-badges">
								{activeEvents.map(({ key, label }) => (
									<Badge key={key} text={label} variant="info" />
								))}
								{activeEvents.length === 0 && (
									<em className="muted">No events configured</em>
								)}
							</div>
							<button
								className="btn btn-sm btn-secondary"
								onClick={handleEditEvents}
							>
								Edit Events
							</button>
						</div>
						{activeEvents.map(({ key, label }) => (
							<div key={key} className="meta-row">
								<span className="meta-label">{label} — Total Points</span>
								<span className="meta-value">
									{tournament[`total_points_${key}`]}
								</span>
							</div>
						))}
					</>
				)}
			</section>

			{/* Participants */}
			<section className="card tournament-detail__participants">
				<h2 className="section-title">
					Results{' '}
					<span className="section-count">({participants.length})</span>
				</h2>
				{participants.length === 0 ? (
					<EmptyState message="No results recorded for this tournament." />
				) : (
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
											<span className="sort-indicator">{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>
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
												<span className="sort-indicator">{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>
											)}
										</th>
									))}
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
													navigate(
														`/admin/competitors/${p.competitor_id}`,
													)
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
