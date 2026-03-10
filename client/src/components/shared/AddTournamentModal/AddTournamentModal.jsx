import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../utils/api.js';
import { EVENT_LIST as EVENTS } from '../../../constants/events.js';
import Modal from '../Modal/Modal.jsx';
import './AddTournamentModal.css';

export default function AddTournamentModal({ isOpen, onClose, onAdd }) {
	const [name, setName] = useState('');
	const [date, setDate] = useState('');
	const [events, setEvents] = useState({
		has_knockdowns: true,
		has_distance: true,
		has_speed: true,
		has_woods: true,
	});
	const [points, setPoints] = useState({
		total_points_knockdowns: 120,
		total_points_distance: 120,
		total_points_speed: 120,
		total_points_woods: 120,
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
				total_points_knockdowns: 120,
				total_points_distance: 120,
				total_points_speed: 120,
				total_points_woods: 120,
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
							<>
								{' '}
								—{' '}
								<Link to={`/admin/tournaments/${conflictTournamentId}`}>
									View existing tournament
								</Link>
							</>
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
