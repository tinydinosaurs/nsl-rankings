import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../utils/api.js';
import PageHeader from '../../components/shared/PageHeader/PageHeader.jsx';
import Checkbox from '../../components/shared/Checkbox/Checkbox.jsx';
import { EVENT_LIST as EVENTS } from '../../constants/events.js';
import './TournamentNewPage.css';

const todayIso = () => new Date().toISOString().slice(0, 10);

const defaultEvents = () => ({
	has_knockdowns: true,
	has_distance: true,
	has_speed: true,
	has_woods: true,
});

const defaultPoints = () => ({
	total_points_knockdowns: 120,
	total_points_distance: 120,
	total_points_speed: 120,
	total_points_woods: 120,
});

export default function TournamentNewPage() {
	const navigate = useNavigate();
	const fileRef = useRef(null);
	const [name, setName] = useState('');
	const [date, setDate] = useState(todayIso());
	const [events, setEvents] = useState(defaultEvents());
	const [points, setPoints] = useState(defaultPoints());
	const [resultsFile, setResultsFile] = useState(null);
	const [error, setError] = useState('');
	const [conflictTournamentId, setConflictTournamentId] = useState(null);
	const [submitting, setSubmitting] = useState(false);

	const toggleEvent = (key) =>
		setEvents((prev) => ({ ...prev, [`has_${key}`]: !prev[`has_${key}`] }));

	const setEventPoints = (key, value) =>
		setPoints((prev) => ({
			...prev,
			[`total_points_${key}`]: Number(value) || 120,
		}));

	const clearFile = () => {
		setResultsFile(null);
		if (fileRef.current) fileRef.current.value = '';
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError('');
		setConflictTournamentId(null);

		if (!name.trim()) {
			setError('Tournament name is required');
			return;
		}
		if (!date) {
			setError('Date is required');
			return;
		}
		const activeEventKeys = EVENTS
			.map(({ key }) => key)
			.filter((key) => events[`has_${key}`]);
		if (activeEventKeys.length === 0) {
			setError('Select at least one event');
			return;
		}

		setSubmitting(true);
		try {
			const { data: created } = await api.post('/rankings/tournaments', {
				name: name.trim(),
				date,
				...Object.fromEntries(
					Object.entries(events).map(([k, v]) => [k, v ? 1 : 0]),
				),
				...points,
			});

			if (resultsFile) {
				navigate(`/admin/tournaments/${created.id}/upload`, {
					state: { stagedFile: resultsFile },
				});
			} else {
				navigate(`/admin/tournaments/${created.id}`);
			}
		} catch (err) {
			const d = err.response?.data;
			if (err.response?.status === 409 && d?.details?.tournament_id) {
				setConflictTournamentId(d.details.tournament_id);
			}
			setError(d?.error || 'Failed to add tournament');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="tournament-new-page">
			<PageHeader
				title="Add Tournament"
				subtitle="Enter tournament details and optionally upload a results file."
			/>

			<form onSubmit={handleSubmit}>
				{error && (
					<div className="alert alert-error">
						{error}
						{conflictTournamentId && (
							<>
								{' '}—{' '}
								<Link to={`/admin/tournaments/${conflictTournamentId}`}>
									View existing tournament
								</Link>
							</>
						)}
					</div>
				)}

				{/* Section 1 — Tournament info */}
				<div className="card">
					<h2>Tournament information</h2>
					<p className="section-hint">
						Only the name is required. The date defaults to today; everything
						else can be added or edited later.
					</p>

					<div className="form-row">
						<div className="form-group">
							<label htmlFor="t-name">
								Name <span className="required">*</span>
							</label>
							<input
								id="t-name"
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="e.g. Spring Championship 2025"
								autoFocus
							/>
						</div>
						<div className="form-group">
							<label htmlFor="t-date">Date</label>
							<input
								id="t-date"
								type="date"
								value={date}
								onChange={(e) => setDate(e.target.value)}
							/>
						</div>
					</div>

					<fieldset className="form-group" style={{ border: 'none', padding: 0 }}>
						<legend>Events held</legend>
						<div className="event-grid">
							{EVENTS.map(({ key, label }) => (
								<Checkbox
									key={key}
									label={label}
									checked={events[`has_${key}`]}
									onChange={() => toggleEvent(key)}
								/>
							))}
						</div>
					</fieldset>

					<fieldset className="form-group" style={{ border: 'none', padding: 0 }}>
						<legend>Total points per event</legend>
						<div className="points-grid">
							{EVENTS.filter(({ key }) => events[`has_${key}`]).map(
								({ key, label }) => (
									<div key={key} className="form-group">
										<label htmlFor={`pts-${key}`}>{label}</label>
										<input
											id={`pts-${key}`}
											type="number"
											min="1"
											value={points[`total_points_${key}`]}
											onChange={(e) => setEventPoints(key, e.target.value)}
										/>
									</div>
								),
							)}
						</div>
					</fieldset>
				</div>

				{/* Section 2 — Results (optional) */}
				<div className="card" style={{ marginTop: '1.5rem' }}>
					<h2>
						Results <span className="optional">(optional)</span>
					</h2>
					<p className="section-hint">
						Upload a CSV or Excel file with this tournament&apos;s results. You
						can review and confirm the parsed results on the next page. If
						you skip this step, you can add results later from the tournament
						page.
					</p>

					<div className="file-row">
						{!resultsFile ? (
							<input
								id="results-file"
								type="file"
								accept=".csv,.tsv,.txt,.xlsx,.xls,.ods"
								ref={fileRef}
								onChange={(e) => setResultsFile(e.target.files[0] || null)}
							/>
						) : (
							<>
								<span>
									Selected: <strong>{resultsFile.name}</strong>
								</span>
								<button
									type="button"
									className="file-clear-btn"
									onClick={clearFile}
									aria-label="Remove selected file"
								>
									✕
								</button>
							</>
						)}
					</div>
				</div>

				<div className="button-row" style={{ marginTop: '1.5rem' }}>
					<button
						type="button"
						className="btn btn-ghost"
						onClick={() => navigate('/admin/tournaments')}
						disabled={submitting}
					>
						Cancel
					</button>
					<button
						type="submit"
						className="btn btn-primary"
						disabled={submitting}
					>
						{submitting
							? 'Saving…'
							: resultsFile
								? 'Save & continue to preview'
								: 'Save tournament'}
					</button>
				</div>
			</form>
		</div>
	);
}
