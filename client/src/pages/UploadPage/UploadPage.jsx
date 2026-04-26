import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EVENTS, EVENT_LABELS } from '../../constants/events';
import PageHeader from '../../components/shared/PageHeader/PageHeader.jsx';
import ResultsUploadForm from '../../components/shared/ResultsUploadForm/ResultsUploadForm.jsx';
import './UploadPage.css';

const defaultSettings = () => ({
	activeEvents: EVENTS,
	totalPoints: { knockdowns: 120, distance: 120, speed: 120, woods: 120 },
	tournamentName: '',
	tournamentDate: '',
});

export default function UploadPage() {
	const [settings, setSettings] = useState(defaultSettings());
	const [step, setStep] = useState('configure'); // 'configure' | 'upload' | 'success'
	const [error, setError] = useState('');
	const [successInfo, setSuccessInfo] = useState(null);

	const toggleEvent = (event) => {
		setSettings((s) => ({
			...s,
			activeEvents: s.activeEvents.includes(event)
				? s.activeEvents.filter((e) => e !== event)
				: [...s.activeEvents, event],
		}));
	};

	const setTotalPoints = (event, val) => {
		setSettings((s) => ({
			...s,
			totalPoints: { ...s.totalPoints, [event]: val },
		}));
	};

	const handleConfigureSubmit = (e) => {
		e.preventDefault();
		setError('');
		if (!settings.tournamentDate) {
			setError('Tournament date is required');
			return;
		}
		if (settings.activeEvents.length === 0) {
			setError('Select at least one event');
			return;
		}
		setStep('upload');
	};

	const handleSuccess = (data) => {
		setSuccessInfo(data);
		setStep('success');
	};

	const handleReset = () => {
		setStep('configure');
		setSettings(defaultSettings());
		setError('');
		setSuccessInfo(null);
	};

	if (step === 'success')
		return (
			<div className="upload-page">
				<PageHeader title="Upload Complete" />
				<div className="alert alert-success">
					Tournament saved successfully.
					{successInfo?.new_competitors?.length > 0 && (
						<> {successInfo.new_competitors.length} new competitor(s) added.</>
					)}
					{successInfo?.updated_competitors?.length > 0 && (
						<>
							{' '}
							{successInfo.updated_competitors.length} competitor(s) updated.
						</>
					)}
				</div>
				<div className="button-row">
					{successInfo?.tournament_id && (
						<Link
							to={`/admin/tournaments/${successInfo.tournament_id}`}
							className="btn btn-primary"
						>
							View Tournament
						</Link>
					)}
					<button className="btn btn-secondary" onClick={handleReset}>
						Upload Another
					</button>
					<Link to="/" className="btn btn-ghost">
						View Rankings
					</Link>
				</div>
			</div>
		);

	return (
		<div className="upload-page">
			<PageHeader title="Upload Tournament Results" />

			{step === 'configure' && (
				<form onSubmit={handleConfigureSubmit} className="upload-form">
					{error && <div className="alert alert-error">{error}</div>}

					<div className="card">
						<h2>Tournament Details</h2>
						<div className="form-row">
							<div className="form-group">
								<label>
									Tournament Name{' '}
									<span className="optional">(recommended)</span>
								</label>
								<input
									type="text"
									placeholder="e.g. Spring Regional 2025"
									value={settings.tournamentName}
									onChange={(e) =>
										setSettings((s) => ({
											...s,
											tournamentName: e.target.value,
										}))
									}
								/>
							</div>
							<div className="form-group">
								<label htmlFor="tournament-date">
									Date <span className="required">*</span>
								</label>
								<input
									id="tournament-date"
									type="date"
									value={settings.tournamentDate}
									onChange={(e) =>
										setSettings((s) => ({
											...s,
											tournamentDate: e.target.value,
										}))
									}
								/>
							</div>
						</div>
					</div>

					<div className="card">
						<h2>Events</h2>
						<p className="hint">
							Select which events were included in this tournament and set the
							total possible points for each.
						</p>
						<div className="events-grid">
							{EVENTS.map((event) => (
								<div
									key={event}
									className={`event-row ${!settings.activeEvents.includes(event) ? 'inactive' : ''}`}
								>
									<label className="checkbox-label">
										<input
											type="checkbox"
											checked={settings.activeEvents.includes(event)}
											onChange={() => toggleEvent(event)}
											style={{
												width: 'auto',
												marginRight: 8,
											}}
										/>
										{EVENT_LABELS[event]}
									</label>
									<div
										className="form-group"
										style={{
											margin: 0,
											flex: 1,
											maxWidth: 160,
										}}
									>
										<input
											type="number"
											min="1"
											value={settings.totalPoints[event]}
											onChange={(e) =>
												setTotalPoints(event, parseFloat(e.target.value) || 120)
											}
											disabled={!settings.activeEvents.includes(event)}
											placeholder="Total pts"
										/>
									</div>
								</div>
							))}
						</div>
					</div>

					<div className="button-row">
						<button type="submit" className="btn btn-primary">
							Next: Select File
						</button>
					</div>
				</form>
			)}

			{step === 'upload' && (
				<div className="upload-form">
					<div className="card">
						<h2>Results File</h2>
						<ResultsUploadForm
							activeEvents={settings.activeEvents}
							totalPoints={settings.totalPoints}
							tournamentId={null}
							tournamentName={settings.tournamentName}
							tournamentDate={settings.tournamentDate}
							onSuccess={handleSuccess}
							onBack={() => setStep('configure')}
						/>
					</div>
				</div>
			)}
		</div>
	);
}
