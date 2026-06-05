import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../utils/api.js';
import PageHeader from '../../components/shared/PageHeader/PageHeader.jsx';
import Checkbox from '../../components/shared/Checkbox/Checkbox.jsx';
import ConfirmDialog from '../../components/shared/ConfirmDialog/ConfirmDialog.jsx';
import { EVENT_LIST, EVENTS, EVENT_LABELS } from '../../constants/events.js';
import {
	defaultMetadata,
	isEmptyMetadata,
	loadDraft,
	saveDraft,
	clearDraft,
} from './draftStorage.js';
import './TournamentDraftPage.css';

const DRAFT_SAVE_DEBOUNCE_MS = 250;
const PREVIEW_DEBOUNCE_MS = 300;

export default function TournamentDraftPage() {
	const navigate = useNavigate();

	// On mount, check for an existing draft. If non-empty, defer rendering the
	// form until the user resolves the resume prompt.
	const initialDraftRef = useRef(null);
	if (initialDraftRef.current === null) {
		const existing = loadDraft();
		initialDraftRef.current = {
			metadata: existing?.metadata ?? defaultMetadata(),
			hasResumePrompt:
				existing !== null && !isEmptyMetadata(existing.metadata),
			wasRehydrated: existing !== null,
			rehydratedHadFile: existing?.hadFile === true,
		};
	}

	const [metadata, setMetadata] = useState(initialDraftRef.current.metadata);
	const [resumePrompt, setResumePrompt] = useState(
		initialDraftRef.current.hasResumePrompt,
	);
	const [wasRehydrated, setWasRehydrated] = useState(
		initialDraftRef.current.wasRehydrated,
	);
	// Tracks whether the prior session had a file attached at the time it was
	// last persisted. Used to decide whether the "re-attach your file" banner
	// is relevant on this load.
	const [rehydratedHadFile, setRehydratedHadFile] = useState(
		initialDraftRef.current.rehydratedHadFile,
	);

	const [file, setFile] = useState(null);
	const [preview, setPreview] = useState(null);
	const [previewing, setPreviewing] = useState(false);
	const [previewError, setPreviewError] = useState('');

	const [committing, setCommitting] = useState(false);
	const [commitError, setCommitError] = useState('');
	const [conflictId, setConflictId] = useState(null);

	const [cancelOpen, setCancelOpen] = useState(false);

	const fileRef = useRef(null);

	// Debounced sessionStorage write on metadata change. Skip while the resume
	// prompt is open so we don't overwrite the pending draft before the user
	// decides. Persist whether a file is currently attached so we can decide
	// whether to show the "re-attach your file" banner after a refresh.
	useEffect(() => {
		if (resumePrompt) return;
		const id = setTimeout(
			() => saveDraft(metadata, { hadFile: file !== null }),
			DRAFT_SAVE_DEBOUNCE_MS,
		);
		return () => clearTimeout(id);
	}, [metadata, file, resumePrompt]);

	// Auto re-preview when (file, metadata) changes. Debounced so toggling
	// events doesn't fire N requests. AbortController cancels in-flight
	// requests when inputs change again.
	useEffect(() => {
		if (!file || resumePrompt) {
			setPreview(null);
			setPreviewError('');
			return;
		}
		const controller = new AbortController();
		const id = setTimeout(() => {
			runPreview(file, metadata, controller.signal);
		}, PREVIEW_DEBOUNCE_MS);
		return () => {
			clearTimeout(id);
			controller.abort();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [file, metadata, resumePrompt]);

	// Warn on unload only if a file is staged (refresh loses it). Metadata
	// alone is safe — sessionStorage covers it.
	useEffect(() => {
		if (!file) return;
		const handler = (e) => {
			e.preventDefault();
			e.returnValue = '';
		};
		window.addEventListener('beforeunload', handler);
		return () => window.removeEventListener('beforeunload', handler);
	}, [file]);

	const activeEventKeys = EVENTS.filter((k) => metadata.events[`has_${k}`]);

	const runPreview = useCallback(async (theFile, theMeta, signal) => {
		setPreviewing(true);
		setPreviewError('');
		try {
			const formData = new FormData();
			formData.append('csv', theFile);
			formData.append('tournament_name', theMeta.name.trim());
			formData.append('tournament_date', theMeta.date);
			EVENTS.forEach((k) => {
				if (theMeta.events[`has_${k}`]) {
					formData.append(`has_${k}`, 'true');
				}
			});
			EVENTS.forEach((k) =>
				formData.append(
					`total_points_${k}`,
					theMeta.points[`total_points_${k}`] ?? 120,
				),
			);
			const { data } = await api.post('/upload/preview', formData, {
				headers: { 'Content-Type': 'multipart/form-data' },
				signal,
			});
			setPreview(data);
		} catch (err) {
			if (err.name === 'CanceledError' || err.name === 'AbortError') return;
			const d = err.response?.data;
			setPreview(null);
			setPreviewError(
				d?.details?.errors?.join(' • ') ||
					d?.errors?.join(' • ') ||
					d?.error ||
					'Could not parse the results file.',
			);
		} finally {
			setPreviewing(false);
		}
	}, []);

	// ─── metadata handlers ──────────────────────────────────
	const setName = (name) => setMetadata((m) => ({ ...m, name }));
	const setDate = (date) => setMetadata((m) => ({ ...m, date }));
	const toggleEvent = (key) =>
		setMetadata((m) => ({
			...m,
			events: { ...m.events, [`has_${key}`]: !m.events[`has_${key}`] },
		}));
	const setEventPoints = (key, value) =>
		setMetadata((m) => ({
			...m,
			points: {
				...m.points,
				[`total_points_${key}`]: Number(value) || 120,
			},
		}));

	// ─── file handlers ──────────────────────────────────────
	const handleFileChange = (e) => {
		setFile(e.target.files?.[0] || null);
		setPreview(null);
		setPreviewError('');
	};
	const handleClearFile = () => {
		setFile(null);
		setPreview(null);
		setPreviewError('');
		if (fileRef.current) fileRef.current.value = '';
	};

	// ─── resume prompt ──────────────────────────────────────
	const handleResume = () => setResumePrompt(false);
	const handleDiscardResume = () => {
		clearDraft();
		const fresh = defaultMetadata();
		setMetadata(fresh);
		setResumePrompt(false);
		setWasRehydrated(false);
		setRehydratedHadFile(false);
	};

	// ─── cancel / commit ────────────────────────────────────
	const draftIsDirty = !isEmptyMetadata(metadata) || file !== null;

	const handleCancelClick = () => {
		if (draftIsDirty) {
			setCancelOpen(true);
		} else {
			clearDraft();
			navigate('/admin/tournaments');
		}
	};
	const handleCancelConfirm = () => {
		clearDraft();
		setCancelOpen(false);
		navigate('/admin/tournaments');
	};

	// Commit is allowed when the form is valid. If a file is staged we wait
	// for a successful preview; if not, we save the tournament metadata only
	// (admins can add results later from the tournament detail page).
	const metadataValid =
		metadata.name.trim() !== '' &&
		!!metadata.date &&
		activeEventKeys.length > 0;
	const canCommit = file
		? metadataValid && !!preview && !previewing && !previewError
		: metadataValid && !previewing;

	const handleCommit = async () => {
		setCommitError('');
		setConflictId(null);
		setCommitting(true);
		try {
			const totalPoints = {};
			EVENTS.forEach((k) => {
				totalPoints[k] = metadata.points[`total_points_${k}`] ?? 120;
			});

			let tournamentId;
			if (file && preview) {
				// File-and-results path — single transaction on the server.
				const { data } = await api.post('/upload/commit', {
					tournament_name: metadata.name.trim(),
					tournament_date: metadata.date,
					activeEvents: activeEventKeys,
					totalPoints,
					competitors: preview.competitors,
				});
				tournamentId = data.tournament_id;
			} else {
				// Metadata-only path — admin will add results later.
				const { data } = await api.post('/rankings/tournaments', {
					name: metadata.name.trim(),
					date: metadata.date,
					has_knockdowns: metadata.events.has_knockdowns ? 1 : 0,
					has_distance: metadata.events.has_distance ? 1 : 0,
					has_speed: metadata.events.has_speed ? 1 : 0,
					has_woods: metadata.events.has_woods ? 1 : 0,
					total_points_knockdowns: metadata.points.total_points_knockdowns,
					total_points_distance: metadata.points.total_points_distance,
					total_points_speed: metadata.points.total_points_speed,
					total_points_woods: metadata.points.total_points_woods,
				});
				tournamentId = data.id;
			}

			clearDraft();
			navigate(`/admin/tournaments/${tournamentId}`);
		} catch (err) {
			const d = err.response?.data;
			if (err.response?.status === 409 && d?.details?.tournament_id) {
				setConflictId(d.details.tournament_id);
			}
			setCommitError(
				d?.details?.errors?.join(' • ') ||
					d?.errors?.join(' • ') ||
					d?.error ||
					'Save failed — the data was not changed. You can try again.',
			);
		} finally {
			setCommitting(false);
		}
	};

	// ─── render ─────────────────────────────────────────────

	if (resumePrompt) {
		return (
			<div className="tournament-draft-page">
				<PageHeader
					title="Add Tournament"
					subtitle="You have an unfinished tournament draft."
				/>
				<div className="card resume-card">
					<h2>Resume your draft?</h2>
					<p>
						You started a tournament draft earlier in this session. Resume where
						you left off, or discard it and start over.
					</p>
					<p className="resume-detail">
						{metadata.name.trim() ? (
							<>
								Name: <strong>{metadata.name}</strong>
							</>
						) : (
							<em>(no name yet)</em>
						)}
						{' • '}
						Date: <strong>{metadata.date || '—'}</strong>
					</p>
					<div className="button-row">
						<button
							type="button"
							className="btn btn-ghost"
							onClick={handleDiscardResume}
						>
							Discard and start over
						</button>
						<button
							type="button"
							className="btn btn-primary"
							onClick={handleResume}
						>
							Resume draft
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="tournament-draft-page">
			<PageHeader
				title="Add Tournament"
				subtitle="Enter tournament details and optionally upload a results file. Nothing is saved until you confirm."
			/>

			{/* ─── Region 1: tournament metadata ──────────── */}
			<section className="card">
				<h2>Tournament information</h2>
				<p className="section-hint">
					Edit any field at any time. If a results file is attached, the
					preview re-runs automatically.
				</p>

				<div className="form-row">
					<div className="form-group">
						<label htmlFor="t-name">
							Name <span className="required">*</span>
						</label>
						<input
							id="t-name"
							type="text"
							value={metadata.name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g. Spring Championship 2026"
							autoFocus
						/>
					</div>
					<div className="form-group">
						<label htmlFor="t-date">Date</label>
						<input
							id="t-date"
							type="date"
							value={metadata.date}
							onChange={(e) => setDate(e.target.value)}
						/>
					</div>
				</div>

				<fieldset className="form-group" style={{ border: 'none', padding: 0 }}>
					<legend>Events held</legend>
					<div className="event-grid">
						{EVENT_LIST.map(({ key, label }) => (
							<Checkbox
								key={key}
								label={label}
								checked={metadata.events[`has_${key}`]}
								onChange={() => toggleEvent(key)}
							/>
						))}
					</div>
				</fieldset>

				<fieldset className="form-group" style={{ border: 'none', padding: 0 }}>
					<legend>Total points per event</legend>
					<div className="points-grid">
						{EVENT_LIST.filter(({ key }) => metadata.events[`has_${key}`]).map(
							({ key, label }) => (
								<div key={key} className="form-group">
									<label htmlFor={`pts-${key}`}>{label}</label>
									<input
										id={`pts-${key}`}
										type="number"
										min="1"
										value={metadata.points[`total_points_${key}`]}
										onChange={(e) => setEventPoints(key, e.target.value)}
									/>
								</div>
							),
						)}
					</div>
				</fieldset>
			</section>

			{/* ─── Region 2: file picker ──────────────────── */}
			{wasRehydrated && rehydratedHadFile && !file && (
				<div className="alert alert-warn rehydrate-banner">
					<strong>Tournament details restored from your previous session.</strong>{' '}
					Re-attach your results file to continue. (Files can&apos;t be saved
					between page refreshes.)
				</div>
			)}
			<section className="card file-section">
				<h2>
					Results <span className="optional">(optional)</span>
				</h2>
				<p className="section-hint">
					Upload a CSV or Excel file. Accepted formats: .csv, .tsv, .xlsx,
					.xls, .ods. You can change the file at any time — the preview will
					re-run.
				</p>
				<div className="file-row">
					{!file ? (
						<>
							<label htmlFor="results-file" className="btn btn-secondary">
								Choose file
							</label>
							<input
								id="results-file"
								type="file"
								accept=".csv,.tsv,.txt,.xlsx,.xls,.ods"
								ref={fileRef}
								onChange={handleFileChange}
								style={{ display: 'none' }}
							/>
						</>
					) : (
						<>
							<label htmlFor="results-file" className="btn btn-secondary">
								Choose different file
							</label>
							<input
								id="results-file"
								type="file"
								accept=".csv,.tsv,.txt,.xlsx,.xls,.ods"
								ref={fileRef}
								onChange={handleFileChange}
								style={{ display: 'none' }}
							/>
							<span className="file-name">
								<strong>{file.name}</strong>
							</span>
							<button
								type="button"
								className="file-clear-btn"
								onClick={handleClearFile}
								aria-label="Remove selected file"
							>
								✕
							</button>
						</>
					)}
				</div>
			</section>

			{/* ─── Region 3: preview ──────────────────────── */}
			{file && (
				<section className="card preview-section">
					{previewing && <p className="muted">Parsing…</p>}
					{previewError && (
						<div className="alert alert-error">{previewError}</div>
					)}
					{preview && (
						<PreviewSection
							preview={preview}
							activeEvents={activeEventKeys}
							totalPoints={metadata.points}
						/>
					)}
				</section>
			)}

			{/* ─── Footer ─────────────────────────────────── */}
			{commitError && (
				<div className="alert alert-error">
					{commitError}
					{conflictId && (
						<>
							{' '}
							—{' '}
							<Link to={`/admin/tournaments/${conflictId}`}>
								View existing tournament
							</Link>
						</>
					)}
				</div>
			)}

			<div className="button-row">
				<button
					type="button"
					className="btn btn-ghost"
					onClick={handleCancelClick}
					disabled={committing}
				>
					Cancel
				</button>
				<button
					type="button"
					className="btn btn-primary"
					onClick={handleCommit}
					disabled={!canCommit || committing}
				>
					{committing
						? 'Saving…'
						: file && preview
							? `Confirm & Save ${preview.competitors.length} Results`
							: 'Save tournament'}
				</button>
			</div>

			<ConfirmDialog
				isOpen={cancelOpen}
				title="Discard this draft?"
				message="Your in-progress tournament draft will be discarded. This can't be undone."
				confirmLabel="Discard draft"
				variant="danger"
				onConfirm={handleCancelConfirm}
				onCancel={() => setCancelOpen(false)}
			/>
		</div>
	);
}

function PreviewSection({ preview, activeEvents, totalPoints }) {
	return (
		<div className="ruf-preview">
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
			</div>

			<div className="ruf-meta">
				<div className="ruf-meta-row">
					<span className="ruf-meta-label">Events</span>
					<span>
						{activeEvents
							.map(
								(e) =>
									`${EVENT_LABELS[e]} (${totalPoints[`total_points_${e}`]} pts)`,
							)
							.join(' • ')}
					</span>
				</div>
			</div>

			<div className="ruf-table-wrapper">
				<table className="ruf-table">
					<thead>
						<tr>
							<th>Status</th>
							<th>Name</th>
							<th>Member</th>
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
								<td>{c.is_member ? 'Yes' : 'No'}</td>
								{activeEvents.map((e) => (
									<td key={e}>{c[`${e}_earned`] ?? '—'}</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
