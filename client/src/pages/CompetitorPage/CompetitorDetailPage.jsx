import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api.js';
import PageHeader from '../../components/shared/PageHeader/PageHeader.jsx';
import EmptyState from '../../components/shared/EmptyState/EmptyState.jsx';
import Badge from '../../components/shared/Badge/Badge.jsx';
import ConfirmDialog from '../../components/shared/ConfirmDialog/ConfirmDialog.jsx';
import './CompetitorDetailPage.css';

function EditableField({ label, value, onSave, type = 'text', placeholder }) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(value ?? '');
	const [error, setError] = useState('');
	const [saving, setSaving] = useState(false);

	const handleSave = async () => {
		setSaving(true);
		setError('');
		try {
			await onSave(draft.trim());
			setEditing(false);
		} catch (err) {
			setError(err.message || 'Failed to save');
		} finally {
			setSaving(false);
		}
	};

	const handleCancel = () => {
		setDraft(value ?? '');
		setError('');
		setEditing(false);
	};

	if (!editing) {
		return (
			<div className="editable-field">
				<span className="editable-field__label">{label}</span>
				<span className="editable-field__value">
					{value ||
						(placeholder ? (
							<em className="muted">{placeholder}</em>
						) : (
							<em className="muted">Not set</em>
						))}
				</span>
				<button
					className="btn btn-sm btn-secondary"
					onClick={() => setEditing(true)}
				>
					Edit
				</button>
			</div>
		);
	}

	return (
		<div className="editable-field editable-field--editing">
			<span className="editable-field__label">{label}</span>
			<input
				className="editable-field__input"
				type={type}
				value={draft}
				placeholder={placeholder}
				onChange={(e) => setDraft(e.target.value)}
				autoFocus
			/>
			<div className="editable-field__actions">
				<button
					className="btn btn-sm btn-primary"
					onClick={handleSave}
					disabled={saving}
				>
					{saving ? 'Saving…' : 'Save'}
				</button>
				<button
					className="btn btn-sm btn-secondary"
					onClick={handleCancel}
					disabled={saving}
				>
					Cancel
				</button>
			</div>
			{error && <span className="editable-field__error">{error}</span>}
		</div>
	);
}

function ScoreCard({ label, score }) {
	return (
		<div className="score-card">
			<span className="score-card__label">{label}</span>
			<span className="score-card__value">
				{score != null ? (Math.round(score * 10) / 10).toFixed(1) : '—'}
			</span>
		</div>
	);
}

export default function CompetitorDetailPage() {
	const { id } = useParams();
	const navigate = useNavigate();

	const [competitor, setCompetitor] = useState(null);
	const [history, setHistory] = useState([]);
	const [scores, setScores] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [deleteResultTarget, setDeleteResultTarget] = useState(null);
	const [deleteCompetitorOpen, setDeleteCompetitorOpen] = useState(false);

	const load = async () => {
		setLoading(true);
		setError('');
		try {
			const res = await api.get(`/rankings/competitors/${id}/history`);
			setCompetitor(res.data.competitor);
			setHistory(res.data.results ?? []);
			setScores(res.data.scores ?? null);
		} catch {
			setError('Failed to load competitor');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, [id]);

	const handleSaveName = async (name) => {
		if (!name) throw new Error('Name is required');
		await api.put(`/rankings/competitors/${id}`, { name });
		setCompetitor((c) => ({ ...c, name }));
	};

	const handleSaveEmail = async (email) => {
		await api.put(`/rankings/competitors/${id}`, { email: email || null });
		setCompetitor((c) => ({ ...c, email: email || null }));
	};

	const handleDeleteResult = async () => {
		await api.delete(`/rankings/results/${deleteResultTarget.result_id}`);
		setDeleteResultTarget(null);
		load();
	};

	const handleDeleteCompetitor = async () => {
		await api.delete(`/rankings/competitors/${id}`);
		navigate('/admin/competitors');
	};

	const isPlaceholder =
		!competitor?.email || competitor.email.endsWith('.nsl@placeholder.local');

	if (loading) return <div className="page-loading">Loading competitor…</div>;
	if (error) return <div className="alert alert-error">{error}</div>;
	if (!competitor) return <EmptyState message="Competitor not found." />;
	console.log('COMPETITOR DATA', competitor.email);
	return (
		<div className="competitor-detail-page">
			<PageHeader
				title={competitor.name}
				subtitle={`Competitor #${id}`}
				action={
					<button
						className="btn btn-danger"
						onClick={() => setDeleteCompetitorOpen(true)}
					>
						Delete Competitor
					</button>
				}
			/>

			{/* Profile */}
			<section className="card competitor-detail__profile">
				<h2 className="section-title">Profile</h2>
				<EditableField
					label="Name"
					value={competitor.name}
					onSave={handleSaveName}
				/>
				<EditableField
					label="Email"
					value={isPlaceholder ? null : competitor.email}
					placeholder={
						isPlaceholder
							? (competitor.email ?? 'No email — placeholder assigned')
							: undefined
					}
					onSave={handleSaveEmail}
					type="email"
				/>
				<div className="competitor-detail__email-status">
					<Badge
						text={isPlaceholder ? 'Placeholder Email' : 'Email Verified'}
						variant={isPlaceholder ? 'warning' : 'success'}
					/>
				</div>
			</section>

			{/* Career Scores */}
			{scores && (
				<section className="card competitor-detail__scores">
					<h2 className="section-title">Career Scores</h2>
					<div className="score-cards">
						<ScoreCard label="Knockdowns" score={scores.knockdowns} />
						<ScoreCard label="Distance" score={scores.distance} />
						<ScoreCard label="Speed" score={scores.speed} />
						<ScoreCard label="Woods" score={scores.woods} />
						<ScoreCard label="Total" score={scores.total} />
					</div>
				</section>
			)}

			{/* Tournament History */}
			<section className="card competitor-detail__history">
				<h2 className="section-title">Tournament History</h2>
				{history.length === 0 ? (
					<EmptyState message="No tournament results yet." />
				) : (
					<div className="table-wrapper">
						<table className="data-table">
							<thead>
								<tr>
									<th>Tournament</th>
									<th>Date</th>
									<th>Knockdowns</th>
									<th>Distance</th>
									<th>Speed</th>
									<th>Woods</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{history.map((result) => (
									<tr key={result.result_id}>
										<td>{result.tournament_name}</td>
										<td>{result.tournament_date}</td>
										<td className="score-cell">
											{result.knockdowns_earned ?? '—'}
										</td>
										<td className="score-cell">
											{result.distance_earned ?? '—'}
										</td>
										<td className="score-cell">{result.speed_earned ?? '—'}</td>
										<td className="score-cell">{result.woods_earned ?? '—'}</td>
										<td>
											<button
												className="btn btn-sm btn-danger"
												onClick={() => setDeleteResultTarget(result)}
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
			</section>

			{/* Delete result confirmation */}
			<ConfirmDialog
				isOpen={!!deleteResultTarget}
				title="Delete Result"
				message={`Remove ${competitor.name}'s result from "${deleteResultTarget?.tournament_name}"? This cannot be undone.`}
				confirmLabel="Delete Result"
				variant="danger"
				onConfirm={handleDeleteResult}
				onCancel={() => setDeleteResultTarget(null)}
			/>

			{/* Delete competitor confirmation */}
			<ConfirmDialog
				isOpen={deleteCompetitorOpen}
				title="Delete Competitor"
				message={`Permanently delete "${competitor.name}" and all their tournament results? This cannot be undone.`}
				confirmLabel="Delete Competitor"
				variant="danger"
				onConfirm={handleDeleteCompetitor}
				onCancel={() => setDeleteCompetitorOpen(false)}
			/>
		</div>
	);
}
