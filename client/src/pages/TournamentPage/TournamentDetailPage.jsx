import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api.js';
import PageHeader from '../../components/shared/PageHeader/PageHeader.jsx';
import EmptyState from '../../components/shared/EmptyState/EmptyState.jsx';
import Badge from '../../components/shared/Badge/Badge.jsx';
import ConfirmDialog from '../../components/shared/ConfirmDialog/ConfirmDialog.jsx';
import EditResultModal from '../../components/shared/EditResultModal/EditResultModal.jsx';
import './TournamentDetailPage.css';

const EVENTS = [
	{ key: 'knockdowns', label: 'Knockdowns' },
	{ key: 'distance', label: 'Distance' },
	{ key: 'speed', label: 'Speed' },
	{ key: 'woods', label: 'Woods' },
];

function fmt(val) {
	if (val === null || val === undefined) return '—';
	return (Math.round(val * 10) / 10).toFixed(1);
}

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

	const load = async () => {
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
	};

	useEffect(() => {
		load();
	}, [id]);

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

	const activeEvents = tournament
		? EVENTS.filter((e) => tournament[`has_${e.key}`])
		: [];

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
				<div className="meta-row">
					<span className="meta-label">Events</span>
					<div className="meta-value event-badges">
						{activeEvents.map(({ key, label }) => (
							<Badge key={key} text={label} variant="info" />
						))}
					</div>
				</div>
				{activeEvents.map(({ key, label }) => (
					<div key={key} className="meta-row">
						<span className="meta-label">{label} — Total Points</span>
						<span className="meta-value">
							{tournament[`total_points_${key}`]}
						</span>
					</div>
				))}
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
									<th>Competitor</th>
									{activeEvents.map(({ label }) => (
										<th key={label}>{label}</th>
									))}
									<th></th>
								</tr>
							</thead>
							<tbody>
								{participants.map((p) => (
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
