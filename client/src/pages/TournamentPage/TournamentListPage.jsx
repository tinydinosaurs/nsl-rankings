import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api.js';
import PageHeader from '../../components/shared/PageHeader/PageHeader.jsx';
import EmptyState from '../../components/shared/EmptyState/EmptyState.jsx';
import ConfirmDialog from '../../components/shared/ConfirmDialog/ConfirmDialog.jsx';
import Badge from '../../components/shared/Badge/Badge.jsx';
import { EVENT_LIST as EVENTS } from '../../constants/events.js';
import './TournamentListPage.css';

function EventBadges({ tournament }) {
	return (
		<div className="event-badges">
			{EVENTS.map(({ key, label }) =>
				tournament[`has_${key}`] ? (
					<Badge key={key} text={label} variant={key} />
				) : null,
			)}
		</div>
	);
}

export default function TournamentListPage() {
	const [data, setData] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [deleteTarget, setDeleteTarget] = useState(null);
	const navigate = useNavigate();

	const load = async () => {
		setLoading(true);
		setError('');
		try {
			const res = await api.get('/rankings/tournaments');
			setData(res.data);
		} catch {
			setError('Failed to load tournaments');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, []);

	const handleDelete = async () => {
		try {
			await api.delete(`/rankings/tournaments/${deleteTarget.id}`);
			setDeleteTarget(null);
			load();
		} catch (err) {
			setError(err.response?.data?.error || 'Failed to delete tournament');
			setDeleteTarget(null);
		}
	};

	if (loading) return <div className="page-loading">Loading tournaments…</div>;

	return (
		<div className="tournament-list-page">
			<PageHeader
				title="Tournaments"
				subtitle={
					data.length > 0
						? `${data.length} tournament${data.length === 1 ? '' : 's'}`
						: null
				}
				action={
					<button
						className="btn btn-primary"
						onClick={() => navigate('/admin/tournaments/new')}
					>
						Add Tournament
					</button>
				}
			/>

			{error && <div className="alert alert-error">{error}</div>}

			{data.length === 0 ? (
				<EmptyState message="No tournaments yet. Add one to get started." />
			) : (
				<div className="card">
					<div className="table-wrapper">
						<table className="data-table">
							<thead>
								<tr>
									<th>Name</th>
									<th>Date</th>
									<th>Events</th>
									<th>Results</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{data.map((tournament) => (
									<tr key={tournament.id}>
										<td>
											<button
												className="competitor-link"
												onClick={() =>
													navigate(`/admin/tournaments/${tournament.id}`)
												}
											>
												{tournament.name}
											</button>
										</td>
										<td>{tournament.date}</td>
										<td>
											<EventBadges tournament={tournament} />
										</td>
										<td>{tournament.participant_count}</td>
										<td>
											<button
												className="btn btn-sm btn-danger"
												onClick={() => setDeleteTarget(tournament)}
											>
												Delete
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			<ConfirmDialog
				isOpen={!!deleteTarget}
				title="Delete Tournament"
				message={
					deleteTarget?.participant_count > 0
						? `Delete "${deleteTarget?.name}" and its ${deleteTarget?.participant_count} result(s)? This cannot be undone.`
						: `Delete "${deleteTarget?.name}"? This cannot be undone.`
				}
				confirmLabel="Delete Tournament"
				variant="danger"
				onConfirm={handleDelete}
				onCancel={() => setDeleteTarget(null)}
			/>
		</div>
	);
}
