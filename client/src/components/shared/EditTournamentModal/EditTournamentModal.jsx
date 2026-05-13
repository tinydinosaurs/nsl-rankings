import { useState, useEffect } from 'react';
import api from '../../../utils/api.js';
import Modal from '../Modal/Modal.jsx';
import Checkbox from '../Checkbox/Checkbox.jsx';
import { EVENT_LIST as EVENTS } from '../../../constants/events.js';
import './EditTournamentModal.css';

/**
 * Edit a tournament's name, date, and per-event configuration in a single
 * modal. Replaces the old split affordance (EditableField rows for name/date
 * + a separate inline "Edit Events" form) so all metadata lives behind one
 * Save button.
 *
 * Props:
 *   isOpen       boolean
 *   onClose      () => void
 *   tournament   { id, name, date, has_*, total_points_* } — required when open
 *   onSaved      (updatedTournament) => void  — called after a successful PUT
 */
export default function EditTournamentModal({
	isOpen,
	onClose,
	tournament,
	onSaved,
}) {
	const [name, setName] = useState('');
	const [date, setDate] = useState('');
	const [eventDraft, setEventDraft] = useState(null);
	const [error, setError] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (!isOpen || !tournament) return;
		setName(tournament.name ?? '');
		setDate(tournament.date ?? '');
		setEventDraft({
			knockdowns: {
				enabled: Boolean(tournament.has_knockdowns),
				total: tournament.total_points_knockdowns ?? '',
			},
			distance: {
				enabled: Boolean(tournament.has_distance),
				total: tournament.total_points_distance ?? '',
			},
			speed: {
				enabled: Boolean(tournament.has_speed),
				total: tournament.total_points_speed ?? '',
			},
			woods: {
				enabled: Boolean(tournament.has_woods),
				total: tournament.total_points_woods ?? '',
			},
		});
		setError('');
	}, [isOpen, tournament]);

	if (!tournament || !eventDraft) return null;

	const handleSubmit = async (e) => {
		e.preventDefault();

		const trimmedName = name.trim();
		const trimmedDate = date.trim();

		if (!trimmedDate) {
			setError('Date is required');
			return;
		}
		const enabled = EVENTS.filter((ev) => eventDraft[ev.key].enabled);
		if (enabled.length === 0) {
			setError('At least one event must be enabled');
			return;
		}
		for (const { key, label } of enabled) {
			const total = Number(eventDraft[key].total);
			if (!total || total <= 0) {
				setError(`${label} total points must be greater than 0`);
				return;
			}
		}

		setIsSubmitting(true);
		setError('');

		const payload = {
			name: trimmedName || null,
			date: trimmedDate,
		};
		for (const { key } of EVENTS) {
			payload[`has_${key}`] = eventDraft[key].enabled ? 1 : 0;
			payload[`total_points_${key}`] = Number(eventDraft[key].total);
		}

		try {
			const { data } = await api.put(
				`/rankings/tournaments/${tournament.id}`,
				payload,
			);
			onSaved?.(data);
			onClose();
		} catch (err) {
			setError(err.response?.data?.error || 'Failed to save tournament');
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Edit Tournament">
			<form onSubmit={handleSubmit}>
				{error && <div className="alert alert-error">{error}</div>}

				<div className="form-group">
					<label htmlFor="edit-tournament-name">Name</label>
					<input
						id="edit-tournament-name"
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="e.g. Spring National Championship"
					/>
				</div>

				<div className="form-group">
					<label htmlFor="edit-tournament-date">Date *</label>
					<input
						id="edit-tournament-date"
						type="date"
						value={date}
						onChange={(e) => setDate(e.target.value)}
						required
					/>
				</div>

				<fieldset className="edit-tournament-events">
					<legend>Events</legend>
					{EVENTS.map(({ key, label }) => (
						<div key={key} className="edit-tournament-events__row">
							<Checkbox
								label={label}
								className="edit-tournament-events__toggle"
								checked={eventDraft[key].enabled}
								onChange={(e) =>
									setEventDraft((d) => ({
										...d,
										[key]: { ...d[key], enabled: e.target.checked },
									}))
								}
							/>
							{eventDraft[key].enabled && (
								<label className="edit-tournament-events__points">
									<span>Total points</span>
									<input
										type="number"
										min="1"
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
						{isSubmitting ? 'Saving…' : 'Save Changes'}
					</button>
				</div>
			</form>
		</Modal>
	);
}
