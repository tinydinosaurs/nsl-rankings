import { useState, useEffect, useMemo } from 'react';
import api from '../../../utils/api.js';
import {
	EVENT_LABELS,
	EVENTS as ALL_EVENTS,
} from '../../../constants/events.js';
import Modal from '../Modal/Modal.jsx';
import './AddResultModal.css';

/**
 * AddResultModal — lets an admin add a single tournament result.
 *
 * Two modes, inferred from which id prop is provided:
 *
 * 1. Competitor mode — pass `competitorId` (+ optional `existingTournamentIds`).
 *    The picker lists tournaments the competitor isn't yet enrolled in.
 *
 * 2. Tournament mode — pass `tournamentId` (+ optional `existingCompetitorIds`).
 *    The picker lists competitors who don't yet have a result in this
 *    tournament.
 *
 * Common props:
 *   onClose — called when the modal should close
 *   onSaved — called after a successful save (parent should reload)
 *   helperText — optional string shown below the title; useful for telling
 *     callers where to go when the option they want isn't in the picker
 */
export default function AddResultModal({
	competitorId,
	tournamentId,
	existingTournamentIds = [],
	existingCompetitorIds = [],
	helperText,
	onClose,
	onSaved,
}) {
	const mode = tournamentId ? 'tournament' : 'competitor';

	const [tournaments, setTournaments] = useState([]);
	const [competitors, setCompetitors] = useState([]);
	const [loadingPicker, setLoadingPicker] = useState(true);

	const [selectedTournament, setSelectedTournament] = useState(null);
	const [selectedCompetitorId, setSelectedCompetitorId] = useState('');
	const [form, setForm] = useState({});
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	const existingTournamentIdSet = useMemo(
		() => new Set(existingTournamentIds),
		[existingTournamentIds],
	);
	const existingCompetitorIdSet = useMemo(
		() => new Set(existingCompetitorIds),
		[existingCompetitorIds],
	);

	useEffect(() => {
		let cancelled = false;
		setLoadingPicker(true);

		const load = async () => {
			try {
				if (mode === 'competitor') {
					const res = await api.get('/rankings/tournaments');
					if (cancelled) return;
					setTournaments(
						res.data.filter((t) => !existingTournamentIdSet.has(t.id)),
					);
				} else {
					// Tournament mode — fetch the tournament (for active events) and
					// the competitor list (filtered to those without a result here).
					const [tRes, cRes] = await Promise.all([
						api.get(`/rankings/tournaments/${tournamentId}`),
						api.get('/rankings/competitors'),
					]);
					if (cancelled) return;
					const t = tRes.data.tournament ?? tRes.data;
					// /rankings/tournaments/:id doesn't include active_events on the
					// tournament row — derive it from has_* flags so the rest of the
					// form logic is the same in both modes.
					const activeEvents = ALL_EVENTS.filter((key) => t[`has_${key}`]);
					const tournamentWithEvents = { ...t, active_events: activeEvents };
					setSelectedTournament(tournamentWithEvents);
					const init = {};
					activeEvents.forEach((key) => {
						init[key] = '';
					});
					setForm(init);

					setCompetitors(
						cRes.data.filter((c) => !existingCompetitorIdSet.has(c.id)),
					);
				}
			} catch {
				if (!cancelled) setError('Failed to load options');
			} finally {
				if (!cancelled) setLoadingPicker(false);
			}
		};

		load();
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [mode, tournamentId]);

	const handleSelectTournament = (e) => {
		const t = tournaments.find((t) => t.id === Number(e.target.value));
		setSelectedTournament(t ?? null);
		if (t) {
			const init = {};
			t.active_events.forEach((key) => {
				init[key] = '';
			});
			setForm(init);
		}
		setError('');
	};

	const handleSelectCompetitor = (e) => {
		setSelectedCompetitorId(e.target.value);
		setError('');
	};

	const handleSubmit = async (e) => {
		e.preventDefault();

		if (!selectedTournament) {
			setError('Please select a tournament');
			return;
		}
		const competitorIdForSave =
			mode === 'tournament' ? Number(selectedCompetitorId) : competitorId;
		if (!competitorIdForSave) {
			setError('Please select a competitor');
			return;
		}

		setSaving(true);
		setError('');

		const payload = {
			competitor_id: competitorIdForSave,
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

	const tournamentLabel = (t) => (t.name ? `${t.name} — ${t.date}` : t.date);
	const competitorLabel = (c) =>
		c.email && !c.email.endsWith('.nsl@placeholder.local')
			? `${c.name} — ${c.email}`
			: c.name;

	const emptyMessage =
		mode === 'tournament'
			? 'Every competitor already has a result in this tournament.'
			: 'This competitor is already enrolled in all tournaments.';

	const noOptions =
		mode === 'tournament' ? competitors.length === 0 : tournaments.length === 0;

	return (
		<Modal
			isOpen
			title={mode === 'tournament' ? 'Add Competitor' : 'Add Tournament Result'}
			onClose={onClose}
		>
			{error && <div className="alert alert-error">{error}</div>}

			{helperText && <p className="add-result-helper">{helperText}</p>}

			{loadingPicker ? (
				<p className="add-result-loading">Loading…</p>
			) : noOptions ? (
				<p className="add-result-empty">{emptyMessage}</p>
			) : (
				<form onSubmit={handleSubmit} className="edit-result-form">
					{mode === 'competitor' ? (
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
					) : (
						<div className="form-group">
							<label>Competitor</label>
							<select
								value={selectedCompetitorId}
								onChange={handleSelectCompetitor}
							>
								<option value="">— Select a competitor —</option>
								{competitors.map((c) => (
									<option key={c.id} value={c.id}>
										{competitorLabel(c)}
									</option>
								))}
							</select>
						</div>
					)}

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
										autoFocus={i === 0 && mode === 'competitor'}
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
							disabled={
								saving ||
								!selectedTournament ||
								(mode === 'tournament' && !selectedCompetitorId)
							}
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
