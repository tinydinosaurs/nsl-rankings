import { useState, useEffect } from 'react';
import api from '../../../utils/api.js';
import { EVENT_LABELS, EVENTS as ALL_EVENTS } from '../../../constants/events.js';
import Modal from '../Modal/Modal.jsx';
import './AddResultModal.css';

/**
 * AddResultModal — lets an admin add a result for a competitor in a tournament
 * they are not yet enrolled in.
 *
 * Props:
 *   competitorId         — the competitor's id
 *   existingTournamentIds — array of tournament ids already in this competitor's history
 *   onClose              — called when modal should close
 *   onSaved              — called after successful save (trigger a reload in the parent)
 */
export default function AddResultModal({
	competitorId,
	existingTournamentIds,
	onClose,
	onSaved,
}) {
	const [tournaments, setTournaments] = useState([]);
	const [loadingTournaments, setLoadingTournaments] = useState(true);
	const [selectedTournament, setSelectedTournament] = useState(null);
	const [form, setForm] = useState({});
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		api
			.get('/rankings/tournaments')
			.then((res) => {
				const available = res.data.filter(
					(t) => !existingTournamentIds.includes(t.id),
				);
				setTournaments(available);
			})
			.catch(() => setError('Failed to load tournaments'))
			.finally(() => setLoadingTournaments(false));
	}, []);  // eslint-disable-line react-hooks/exhaustive-deps

	const handleSelectTournament = (e) => {
		const t = tournaments.find((t) => t.id === Number(e.target.value));
		setSelectedTournament(t ?? null);
		// Pre-fill form with empty strings for active events only
		if (t) {
			const init = {};
			t.active_events.forEach((key) => { init[key] = ''; });
			setForm(init);
		}
		setError('');
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!selectedTournament) {
			setError('Please select a tournament');
			return;
		}
		setSaving(true);
		setError('');

		const payload = {
			competitor_id: competitorId,
			tournament_id: selectedTournament.id,
		};

		for (const key of ALL_EVENTS) {
			if (selectedTournament.active_events.includes(key)) {
				const raw = (form[key] ?? '').toString().trim();
				const val = raw === '' ? 0 : parseFloat(raw);
				if (isNaN(val) || val < 0) {
					setError(`Invalid value for ${EVENT_LABELS[key]}`);
					setSaving(false);
					return;
				}
				payload[`${key}_earned`] = val;
			} else {
				payload[`${key}_earned`] = null;
			}
		}

		try {
			await api.post('/rankings/results', payload);
			onSaved();
			onClose();
		} catch (err) {
			setError(err.response?.data?.error || 'Failed to save result');
			setSaving(false);
		}
	};

	const tournamentLabel = (t) =>
		t.name ? `${t.name} — ${t.date}` : t.date;

	return (
		<Modal isOpen title="Add Tournament Result" onClose={onClose}>
			{error && <div className="alert alert-error">{error}</div>}

			{loadingTournaments ? (
				<p className="add-result-loading">Loading tournaments…</p>
			) : tournaments.length === 0 ? (
				<p className="add-result-empty">
					This competitor is already enrolled in all tournaments.
				</p>
			) : (
				<form onSubmit={handleSubmit} className="edit-result-form">
					<div className="form-group">
						<label>Tournament</label>
						<select
							value={selectedTournament?.id ?? ''}
							onChange={handleSelectTournament}
						>
							<option value="">— Select a tournament —</option>
							{tournaments.map((t) => (
								<option key={t.id} value={t.id}>
									{tournamentLabel(t)}
								</option>
							))}
						</select>
					</div>

					{selectedTournament && (
						<>
							{selectedTournament.active_events.map((key, i) => (
								<div className="form-group" key={key}>
									<label>{EVENT_LABELS[key]} earned</label>
									<input
										type="number"
										min="0"
										step="0.1"
										placeholder="0"
										autoFocus={i === 0}
										value={form[key] ?? ''}
										onChange={(e) =>
											setForm((f) => ({ ...f, [key]: e.target.value }))
										}
									/>
								</div>
							))}
							{selectedTournament.active_events.length === 0 && (
								<p className="add-result-empty">
									This tournament has no active events configured.
								</p>
							)}
						</>
					)}

					<div className="edit-result-form__actions">
						<button
							type="submit"
							className="btn btn-primary"
							disabled={saving || !selectedTournament}
						>
							{saving ? 'Saving…' : 'Save Result'}
						</button>
						<button
							type="button"
							className="btn btn-secondary"
							onClick={onClose}
							disabled={saving}
						>
							Cancel
						</button>
					</div>
				</form>
			)}
		</Modal>
	);
}
