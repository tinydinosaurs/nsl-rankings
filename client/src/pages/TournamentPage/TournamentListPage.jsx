import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../utils/api.js';
import PageHeader from '../../components/shared/PageHeader/PageHeader.jsx';
import EmptyState from '../../components/shared/EmptyState/EmptyState.jsx';
import Modal from '../../components/shared/Modal/Modal.jsx';
import ConfirmDialog from '../../components/shared/ConfirmDialog/ConfirmDialog.jsx';
import Badge from '../../components/shared/Badge/Badge.jsx';
import './TournamentListPage.css';

const EVENTS = [
	{ key: 'knockdowns', label: 'Knockdowns' },
	{ key: 'distance', label: 'Distance' },
	{ key: 'speed', label: 'Speed' },
	{ key: 'woods', label: 'Woods' },
];

function AddTournamentModal({ isOpen, onClose, onAdd }) {
	const [name, setName] = useState('');
	const [date, setDate] = useState('');
	const [events, setEvents] = useState({
		has_knockdowns: true,
		has_distance: true,
		has_speed: true,
		has_woods: true,
	});
	const [points, setPoints] = useState({
		total_points_knockdowns: 100,
		total_points_distance: 100,
		total_points_speed: 100,
		total_points_woods: 100,
	});
	const [error, setError] = useState('');
	const [conflictTournamentId, setConflictTournamentId] = useState(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!name.trim()) return setError('Tournament name is required');
		if (!date.trim()) return setError('Date is required');

		setIsSubmitting(true);
		setError('');
		setConflictTournamentId(null);

		try {
			await api.post('/rankings/tournaments', {
				name: name.trim(),
				date: date.trim(),
				...Object.fromEntries(
					Object.entries(events).map(([k, v]) => [k, v ? 1 : 0]),
				),
				...points,
			});
			onAdd();
			setName('');
			setDate('');
			setEvents({
				has_knockdowns: true,
				has_distance: true,
				has_speed: true,
				has_woods: true,
			});
			setPoints({
				total_points_knockdowns: 100,
				total_points_distance: 100,
				total_points_speed: 100,
				total_points_woods: 100,
			});
			onClose();
		} catch (err) {
			const d = err.response?.data;
			if (err.response?.status === 409 && d?.details?.tournament_id) {
				setConflictTournamentId(d.details.tournament_id);
			}
			setError(d?.error || 'Failed to add tournament');
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Add Tournament">
			<form onSubmit={handleSubmit} className="add-tournament-form">
				{error && (
					<div className="alert alert-error">
						{error}
						{conflictTournamentId && (
							<> — <Link to={`/admin/tournaments/${conflictTournamentId}`}>View existing tournament</Link></>
						)}
					</div>
				)}

				<div className="form-group">
					<label className="form-label" htmlFor="tournament-name">
						Name
					</label>
					<input
						id="tournament-name"
						className="form-input"
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="e.g. Spring Championship 2025"
						autoFocus
					/>
				</div>

				<div className="form-group">
					<label className="form-label" htmlFor="tournament-date">
						Date
					</label>
					<input
						id="tournament-date"
						className="form-input"
						type="date"
						value={date}
						onChange={(e) => setDate(e.target.value)}
					/>
				</div>

				<fieldset className="form-fieldset">
					<legend className="form-legend">Active Events</legend>
					<div className="event-grid">
						{EVENTS.map(({ key, label }) => (
							<label key={key} className="event-checkbox">
								<input
									type="checkbox"
									checked={events[`has_${key}`]}
									onChange={(e) =>
										setEvents((prev) => ({
											...prev,
											[`has_${key}`]: e.target.checked,
										}))
									}
								/>
								{label}
							</label>
						))}
					</div>
				</fieldset>

				<fieldset className="form-fieldset">
					<legend className="form-legend">Total Points Per Event</legend>
					<div className="points-grid">
						{EVENTS.map(({ key, label }) =>
							events[`has_${key}`] ? (
								<div key={key} className="form-group">
									<label className="form-label" htmlFor={`points-${key}`}>
										{label}
									</label>
									<input
										id={`points-${key}`}
										className="form-input"
										type="number"
										min="1"
										value={points[`total_points_${key}`]}
										onChange={(e) =>
											setPoints((prev) => ({
												...prev,
												[`total_points_${key}`]: Number(e.target.value),
											}))
										}
									/>
								</div>
							) : null,
						)}
					</div>
				</fieldset>

				<div className="modal-actions">
					<button
						type="button"
						className="btn btn-secondary"
						onClick={onClose}
						disabled={isSubmitting}
					>
						Cancel
					</button>
					<button
						type="submit"
						className="btn btn-primary"
						disabled={isSubmitting}
					>
						{isSubmitting ? 'Adding…' : 'Add Tournament'}
					</button>
				</div>
			</form>
		</Modal>
	);
}

function EventBadges({ tournament }) {
	return (
		<div className="event-badges">
			{EVENTS.map(({ key, label }) =>
				tournament[`has_${key}`] ? (
					<Badge key={key} text={label} variant="info" />
				) : null,
			)}
		</div>
	);
}

export default function TournamentListPage() {
	const [data, setData] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [showAddModal, setShowAddModal] = useState(false);
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
						onClick={() => setShowAddModal(true)}
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
			)}

			<AddTournamentModal
				isOpen={showAddModal}
				onClose={() => setShowAddModal(false)}
				onAdd={load}
			/>

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
