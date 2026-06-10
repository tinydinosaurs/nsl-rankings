import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../utils/api.js';
import PageHeader from '../../components/shared/PageHeader/PageHeader.jsx';
import Checkbox from '../../components/shared/Checkbox/Checkbox.jsx';
import ConfirmDialog from '../../components/shared/ConfirmDialog/ConfirmDialog.jsx';
import { EVENT_LIST, EVENTS, EVENT_LABELS } from '../../constants/events.js';
import CommitConfirmModal from './CommitConfirmModal.jsx';
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

// Human-readable labels for the parser's `missing_required_columns` keys.
// Used by the missing-required-column banner. Keep keys in sync with the
// `name` / `is_member` fields in `server/db/csvParser.js`.
const REQUIRED_COLUMN_LABELS = {
	name: 'a name column (e.g. "Name" or "Competitor")',
	is_member: 'a membership column (e.g. "Member" or "NSL member")',
};

/**
 * Owns the new/update-tournament flow for both entry points:
 *
 *   /admin/tournaments/new           → mode="create" (sessionStorage draft)
 *   /admin/tournaments/:id/upload    → mode="update" (hydrated from DB)
 *
 * In create mode, metadata is held in a sessionStorage draft and survives
 * refresh within the tab. In update mode, the DB is the source of truth and
 * no draft layer is used; commit requires a staged file (metadata-only edits
 * live on the tournament detail page's edit modal).
 */
export default function TournamentDraftPage({
	mode = 'create',
	tournamentId = null,
	initialMetadata = null,
	existingResultCount = 0,
	pageTitle = 'Add Tournament',
	pageSubtitle = 'Enter tournament details and optionally upload a results file. Nothing is saved until you confirm.',
	cancelTo = '/admin/tournaments',
}) {
	const navigate = useNavigate();
	const isUpdate = mode === 'update';

	// On mount, choose the initial metadata source. In create mode, check
	// sessionStorage for an existing draft and defer rendering the form if a
	// non-empty one exists. In update mode, hydrate from props.
	const initialDraftRef = useRef(null);
	if (initialDraftRef.current === null) {
		if (isUpdate) {
			initialDraftRef.current = {
				metadata: initialMetadata ?? defaultMetadata(),
				hasResumePrompt: false,
				wasRehydrated: false,
				rehydratedHadFile: false,
			};
		} else {
			const existing = loadDraft();
			initialDraftRef.current = {
				metadata: existing?.metadata ?? defaultMetadata(),
				hasResumePrompt:
					existing !== null && !isEmptyMetadata(existing.metadata),
				wasRehydrated: existing !== null,
				rehydratedHadFile: existing?.hadFile === true,
			};
		}
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
	// Structured list of required CSV columns the parser couldn't find
	// (currently `name` and/or `is_member`). When populated we render a
	// warn-and-remediate banner instead of the plain `previewError` alert.
	const [missingRequiredColumns, setMissingRequiredColumns] = useState([]);

	const [committing, setCommitting] = useState(false);
	const [commitError, setCommitError] = useState('');
	const [conflictId, setConflictId] = useState(null);

	const [cancelOpen, setCancelOpen] = useState(false);
	const [commitConfirmOpen, setCommitConfirmOpen] = useState(false);

	const fileRef = useRef(null);
	const eventsFieldsetRef = useRef(null);

	// Debounced sessionStorage write on metadata change. Create mode only —
	// in update mode the DB is the source of truth and there is no draft to
	// persist (and persisting one would risk a stale-vs-DB collision).
	useEffect(() => {
		if (isUpdate) return;
		if (resumePrompt) return;
		const id = setTimeout(
			() => saveDraft(metadata, { hadFile: file !== null }),
			DRAFT_SAVE_DEBOUNCE_MS,
		);
		return () => clearTimeout(id);
	}, [metadata, file, resumePrompt, isUpdate]);

	// Auto re-preview when (file, metadata) changes. Debounced so toggling
	// events doesn't fire N requests. AbortController cancels in-flight
	// requests when inputs change again.
	useEffect(() => {
		if (!file || resumePrompt) {
			setPreview(null);
			setPreviewError('');
			setMissingRequiredColumns([]);
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
		setMissingRequiredColumns([]);
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
			setMissingRequiredColumns(d?.details?.missing_required_columns ?? []);
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
		setMissingRequiredColumns([]);
	};
	const handleClearFile = () => {
		setFile(null);
		setPreview(null);
		setPreviewError('');
		setMissingRequiredColumns([]);
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
	// In update mode the draft layer doesn't apply, so dirtiness is just
	// whether anything has changed since hydration. Tracking a full diff for
	// the confirmation prompt is heavier than the value it adds for a single
	// admin tool, so we treat a staged file as the dirty signal and otherwise
	// cancel without confirmation.
	const draftIsDirty = isUpdate
		? file !== null
		: !isEmptyMetadata(metadata) || file !== null;

	const handleCancelClick = () => {
		if (draftIsDirty) {
			setCancelOpen(true);
		} else {
			if (!isUpdate) clearDraft();
			navigate(cancelTo);
		}
	};
	const handleCancelConfirm = () => {
		if (!isUpdate) clearDraft();
		setCancelOpen(false);
		navigate(cancelTo);
	};

	// Commit is allowed when the form is valid. Create mode allows a
	// metadata-only save (no file); update mode requires a staged file
	// (metadata-only edits live on the tournament detail page's edit modal).
	const metadataValid =
		metadata.name.trim() !== '' &&
		!!metadata.date &&
		activeEventKeys.length > 0;
	const canCommit = isUpdate
		? metadataValid && !!file && !!preview && !previewing && !previewError
		: file
			? metadataValid && !!preview && !previewing && !previewError
			: metadataValid && !previewing;

	// Rename the executor; the user-facing handler decides whether to open
	// the confirm modal first or commit directly. See `commitNeedsConfirm`.
	// `mode` is one of:
	//   - 'upsert'  (default) — server keeps existing results that aren't in
	//     the payload; matching emails overwrite, new ones insert
	//   - 'replace' — server deletes every existing result for this
	//     tournament inside the same transaction, then inserts from the
	//     payload. Only meaningful on the update-with-file path.
	const doCommit = async (mode = 'upsert') => {
		setCommitError('');
		setConflictId(null);
		setCommitting(true);
		try {
			const totalPoints = {};
			EVENTS.forEach((k) => {
				totalPoints[k] = metadata.points[`total_points_${k}`] ?? 120;
			});

			let finalTournamentId;
			if (isUpdate) {
				// Update path — uses the slice-1 server contract: include the
				// tournament_id plus optional metadata fields, all applied in one
				// transaction with the inserts. When `mode === 'replace'`, the
				// transaction also wipes the tournament's existing result rows
				// before inserting from the payload.
				const { data } = await api.post('/upload/commit', {
					tournament_id: tournamentId,
					tournament_name: metadata.name.trim(),
					tournament_date: metadata.date,
					activeEvents: activeEventKeys,
					totalPoints,
					competitors: preview.competitors,
					replace_mode: mode === 'replace',
				});
				finalTournamentId = data.tournament_id;
			} else if (file && preview) {
				// Create + results path — single transaction on the server.
				const { data } = await api.post('/upload/commit', {
					tournament_name: metadata.name.trim(),
					tournament_date: metadata.date,
					activeEvents: activeEventKeys,
					totalPoints,
					competitors: preview.competitors,
				});
				finalTournamentId = data.tournament_id;
			} else {
				// Create + metadata-only path — admin will add results later.
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
				finalTournamentId = data.id;
			}

			if (!isUpdate) clearDraft();
			navigate(`/admin/tournaments/${finalTournamentId}`);
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

	// Decide whether commit requires the pre-commit confirmation modal.
	// Triggers (any one suffices):
	//   - preview contains membership flips
	//   - preview is missing one or more active-event columns
	//   - update mode + tournament already has results that will be replaced
	const membershipChanges = preview?.membership_changes ?? [];
	const missingEventColumns = preview?.missing_event_columns ?? [];
	const willReplaceExistingResults =
		isUpdate && !!file && existingResultCount > 0;
	const commitNeedsConfirm =
		membershipChanges.length > 0 ||
		missingEventColumns.length > 0 ||
		willReplaceExistingResults;

	const handleCommit = () => {
		if (commitNeedsConfirm) {
			setCommitConfirmOpen(true);
		} else {
			doCommit('upsert');
		}
	};

	const handleConfirmCommit = (mode) => {
		setCommitConfirmOpen(false);
		doCommit(mode);
	};

	// Banner action: scroll the events fieldset into view and focus its
	// first checkbox so the admin can adjust which events are active.
	const handleFocusEventsFieldset = () => {
		const node = eventsFieldsetRef.current;
		if (!node) return;
		if (typeof node.scrollIntoView === 'function') {
			node.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
		const firstCheckbox = node.querySelector('input[type="checkbox"]');
		if (firstCheckbox) firstCheckbox.focus();
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
			<PageHeader title={pageTitle} subtitle={pageSubtitle} />

			{/* ─── Region 1: tournament metadata ──────────── */}
			<section className="card">
				<h2>Tournament information</h2>
				<p className="section-hint">
					Edit any field at any time. If a results file is attached, the preview
					re-runs automatically.
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

				<fieldset
					ref={eventsFieldsetRef}
					className="form-group"
					style={{ border: 'none', padding: 0 }}
				>
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
					<strong>
						Tournament details restored from your previous session.
					</strong>{' '}
					Re-attach your results file to continue. (Files can&apos;t be saved
					between page refreshes.)
				</div>
			)}
			<section className="card file-section">
				<h2>
					Results{' '}
					<span className="optional">
						{isUpdate ? '(required)' : '(optional)'}
					</span>
				</h2>
				<p className="section-hint">
					{isUpdate
						? 'Upload a CSV or Excel file with the results to add to this tournament. Accepted formats: .csv, .tsv, .xlsx, .xls, .ods.'
						: 'Upload a CSV or Excel file. Accepted formats: .csv, .tsv, .xlsx, .xls, .ods. You can change the file at any time — the preview will re-run.'}
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
					{missingRequiredColumns.length > 0 && (
						<div
							className="alert alert-error missing-required-banner"
							data-testid="missing-required-banner"
						>
							<strong>
								Missing required column
								{missingRequiredColumns.length === 1 ? '' : 's'} in your file
							</strong>
							<p>
								Your file is missing{' '}
								{missingRequiredColumns
									.map((c) => REQUIRED_COLUMN_LABELS[c] ?? c)
									.join(' and ')}
								. {missingRequiredColumns.length === 1 ? 'This column is' : 'These columns are'}{' '}
								required — nothing has been saved. Add{' '}
								{missingRequiredColumns.length === 1 ? 'it' : 'them'} to the
								header row and re-upload, or open the CSV format guide for
								details on accepted column names.
							</p>
							<div className="button-row">
								<label htmlFor="results-file" className="btn btn-secondary">
									Choose different file
								</label>
								<Link
									to="/admin/help#csv-format"
									className="btn btn-secondary"
									target="_blank"
									rel="noopener"
								>
									View CSV format guide
								</Link>
							</div>
						</div>
					)}
					{previewError && missingRequiredColumns.length === 0 && (
						<div className="alert alert-error">{previewError}</div>
					)}{' '}
					{preview && missingEventColumns.length > 0 && (
						<div
							className="alert alert-warn missing-event-banner"
							data-testid="missing-event-banner"
						>
							<strong>
								Missing column{missingEventColumns.length === 1 ? '' : 's'} in
								your file
							</strong>
							<p>
								You marked <strong>{missingEventColumns.join(', ')}</strong> as
								active, but the uploaded file has no matching column. If you
								save now, those events will be recorded as <em>not held</em> for
								every competitor in this upload.
							</p>
							<div className="button-row">
								<label htmlFor="results-file" className="btn btn-secondary">
									Choose different file
								</label>
								<button
									type="button"
									className="btn btn-secondary"
									onClick={handleFocusEventsFieldset}
								>
									Edit tournament events
								</button>
							</div>
						</div>
					)}
					{preview && membershipChanges.length > 0 && (
						<div
							className="alert alert-info membership-flip-callout"
							data-testid="membership-flip-callout"
						>
							<strong>
								Membership status change
								{membershipChanges.length === 1 ? '' : 's'} (
								{membershipChanges.length})
							</strong>
							<p>
								The following competitor
								{membershipChanges.length === 1 ? "'s" : "s'"} membership status
								differs from their previous record. Saving will update it.
							</p>
							<ul>
								{membershipChanges.map((c) => (
									<li key={c.email}>
										<strong>{c.name}</strong>:{' '}
										{c.before ? 'Member' : 'Non-member'} →{' '}
										{c.after ? 'Member' : 'Non-member'}
									</li>
								))}
							</ul>
						</div>
					)}{' '}
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
							: isUpdate
								? 'Choose a file to add results'
								: 'Save tournament'}
				</button>
			</div>

			<ConfirmDialog
				isOpen={cancelOpen}
				title={isUpdate ? 'Discard your changes?' : 'Discard this draft?'}
				message={
					isUpdate
						? 'Your staged file and any unsaved metadata changes will be discarded.'
						: "Your in-progress tournament draft will be discarded. This can't be undone."
				}
				confirmLabel={isUpdate ? 'Discard changes' : 'Discard draft'}
				variant="danger"
				onConfirm={handleCancelConfirm}
				onCancel={() => setCancelOpen(false)}
			/>

			<CommitConfirmModal
				isOpen={commitConfirmOpen}
				onConfirm={handleConfirmCommit}
				onCancel={() => setCommitConfirmOpen(false)}
				membershipChanges={membershipChanges}
				missingEventColumns={missingEventColumns}
				willReplaceExistingResults={willReplaceExistingResults}
				existingResultCount={existingResultCount}
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
