import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../utils/api.js';
import { EVENTS, EVENT_LABELS } from '../../../constants/events.js';
import './ResultsUploadForm.css';

/**
 * Handles file selection → preview → commit for a set of tournament results.
 *
 * Props:
 *   activeEvents   string[]          — event keys active for this tournament
 *   totalPoints    object            — { knockdowns, distance, speed, woods }
 *   tournamentId   number | null     — if set, commits to existing tournament; null = create new
 *   tournamentName string            — used in preview display and new-tournament creation
 *   tournamentDate string            — used in preview display and new-tournament creation
 *   onSuccess      (data) => void    — called with commit response after save
 *   onBack         () => void | null — if provided, renders a button on the file step
 *   onBackLabel    string            — label for the onBack button (default: "← Edit Settings")
 *   initialFile    File | null       — if provided, prefills the file picker and
 *                                      auto-triggers preview on mount
 */
export default function ResultsUploadForm({
	activeEvents,
	totalPoints,
	tournamentId = null,
	tournamentName = '',
	tournamentDate = '',
	onSuccess,
	onBack,
	onBackLabel = '← Edit Settings',
	initialFile = null,
}) {
	const [step, setStep] = useState('file'); // 'file' | 'preview'
	const [selectedFile, setSelectedFile] = useState(initialFile);
	const [preview, setPreview] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [conflictTournamentId, setConflictTournamentId] = useState(null);
	const fileRef = useRef();
	const autoPreviewRef = useRef(false);

	const handlePreview = async (e) => {
		e.preventDefault();
		setError('');
		const file = selectedFile || fileRef.current?.files[0];
		if (!file) {
			setError('Please select a file');
			return;
		}

		const formData = new FormData();
		formData.append('csv', file);
		formData.append('tournament_name', tournamentName);
		formData.append('tournament_date', tournamentDate);
		activeEvents.forEach((ev) => formData.append(`has_${ev}`, 'true'));
		EVENTS.forEach((ev) =>
			formData.append(`total_points_${ev}`, totalPoints[ev] ?? 120),
		);

		setLoading(true);
		try {
			const { data } = await api.post('/upload/preview', formData, {
				headers: { 'Content-Type': 'multipart/form-data' },
			});
			setPreview(data);
			setStep('preview');
		} catch (err) {
			const d = err.response?.data;
			setError(
				d?.details?.errors?.join(' • ') ||
					d?.errors?.join(' • ') ||
					d?.error ||
					'Preview failed',
			);
		} finally {
			setLoading(false);
		}
	};

	// Auto-trigger preview if an initialFile was supplied (e.g. carried over
	// from the tournament-creation page).
	useEffect(() => {
		if (initialFile && !autoPreviewRef.current) {
			autoPreviewRef.current = true;
			handlePreview({ preventDefault: () => {} });
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [initialFile]);

	const handleCommit = async () => {
		setError('');
		setConflictTournamentId(null);
		setLoading(true);
		try {
			const body = {
				tournament_name: tournamentName || null,
				tournament_date: tournamentDate,
				activeEvents,
				totalPoints,
				competitors: preview.competitors,
			};
			if (tournamentId != null) {
				body.tournament_id = tournamentId;
			}
			const { data } = await api.post('/upload/commit', body);
			onSuccess(data);
		} catch (err) {
			const d = err.response?.data;
			if (err.response?.status === 409 && d?.details?.tournament_id) {
				setConflictTournamentId(d.details.tournament_id);
			} else {
				setError(
					d?.details?.errors?.join(' • ') ||
						d?.errors?.join(' • ') ||
						d?.error ||
						'Save failed — the data was not changed. You can try again.',
				);
			}
		} finally {
			setLoading(false);
		}
	};

	const handleBackToFile = () => {
		setStep('file');
		setPreview(null);
		setError('');
		setConflictTournamentId(null);
	};

	const clearFile = () => {
		setSelectedFile(null);
		if (fileRef.current) fileRef.current.value = '';
	};

	if (step === 'file') {
		return (
			<form onSubmit={handlePreview} className="ruf-form">
				{error && <div className="alert alert-error">{error}</div>}
				<p className="ruf-hint">
					Accepts Excel (.xlsx, .xls) and CSV (.csv, .tsv) files. Columns can be
					in any order and various spellings are recognized. Blank cells in
					active events will be treated as 0.
				</p>
				{!selectedFile ? (
					<>
						<label htmlFor="ruf-file-input" className="visually-hidden">
							Results file
						</label>
						<input
							id="ruf-file-input"
							type="file"
							accept=".csv,.tsv,.txt,.xlsx,.xls,.ods"
							ref={fileRef}
							onChange={(e) => setSelectedFile(e.target.files[0] || null)}
						/>
					</>
				) : (
					<p className="ruf-hint ruf-selected-file">
						Selected: <strong>{selectedFile.name}</strong>{' '}
						<button type="button" className="ruf-clear-btn" onClick={clearFile}>
							✕
						</button>
					</p>
				)}
				<div className="ruf-actions">
					<button type="submit" className="btn btn-primary" disabled={loading}>
						{loading ? 'Parsing…' : 'Preview Import'}
					</button>
					{onBack && (
						<button type="button" className="btn btn-ghost" onClick={onBack}>
							{onBackLabel}
						</button>
					)}
				</div>
			</form>
		);
	}

	// step === 'preview'
	return (
		<div className="ruf-preview">
			{error && <div className="alert alert-error">{error}</div>}
			{conflictTournamentId && (
				<div className="alert alert-error">
					A tournament with this name and date already exists.{' '}
					<Link to={`/admin/tournaments/${conflictTournamentId}`}>
						View existing tournament
					</Link>{' '}
					or go back and change the name or date.
				</div>
			)}
			{preview.warnings?.length > 0 && (
				<div className="alert alert-warn">
					<strong>Warnings ({preview.warnings.length})</strong>
					<ul style={{ marginTop: 8, paddingLeft: 16 }}>
						{preview.warnings.map((w, i) => (
							<li key={i}>{w}</li>
						))}
					</ul>
				</div>
			)}

			<div className="ruf-preview-header">
				<h3>{preview.competitors.length} competitors found</h3>
				<button className="btn btn-ghost" onClick={handleBackToFile}>
					← Edit
				</button>
			</div>

			{(tournamentName || tournamentDate) && (
				<div className="ruf-meta">
					{tournamentName && (
						<div className="ruf-meta-row">
							<span className="ruf-meta-label">Name</span>
							<span>{tournamentName}</span>
						</div>
					)}
					{tournamentDate && (
						<div className="ruf-meta-row">
							<span className="ruf-meta-label">Date</span>
							<span>{tournamentDate}</span>
						</div>
					)}
					<div className="ruf-meta-row">
						<span className="ruf-meta-label">Events</span>
						<span>
							{activeEvents
								.map((e) => `${EVENT_LABELS[e]} (${totalPoints[e]} pts)`)
								.join(' • ')}
						</span>
					</div>
				</div>
			)}

			<div className="ruf-table-wrapper">
				<table className="ruf-table">
					<thead>
						<tr>
							<th>Status</th>
							<th>Name</th>
							{activeEvents.map((e) => (
								<th key={e}>{EVENT_LABELS[e]}</th>
							))}
						</tr>
					</thead>
					<tbody>
						{preview.competitors.map((c, i) => (
							<tr key={i}>
								<td>
									<span
										className={`badge ${c.is_new ? 'ruf-badge-new' : 'ruf-badge-update'}`}
									>
										{c.is_new ? 'New' : 'Update'}
									</span>
								</td>
								<td>{c.name}</td>
								{activeEvents.map((e) => (
									<td key={e}>{c[`${e}_earned`] ?? '—'}</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className="ruf-actions">
				<button
					className="btn btn-primary"
					onClick={handleCommit}
					disabled={loading}
				>
					{loading
						? 'Saving…'
						: `Confirm & Save ${preview.competitors.length} Results`}
				</button>
				<button className="btn btn-ghost" onClick={handleBackToFile}>
					Cancel
				</button>
			</div>
		</div>
	);
}
