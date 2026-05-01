import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../utils/api.js';
import PageHeader from '../../components/shared/PageHeader/PageHeader.jsx';
import EmptyState from '../../components/shared/EmptyState/EmptyState.jsx';
import Badge from '../../components/shared/Badge/Badge.jsx';
import ConfirmDialog from '../../components/shared/ConfirmDialog/ConfirmDialog.jsx';
import EditResultModal from '../../components/shared/EditResultModal/EditResultModal.jsx';
import AddResultModal from '../../components/shared/AddResultModal/AddResultModal.jsx';
import EditCompetitorModal from '../../components/shared/EditCompetitorModal/EditCompetitorModal.jsx';
import { formatScore } from '../../utils/formatScore.js';
import './CompetitorDetailPage.css';

function ScoreCard({ label, score, rawValue, variant }) {
	return (
		<div className={`score-card${variant ? ` score-card--${variant}` : ''}`}>
			<span className="score-card__label">{label}</span>
			<span className="score-card__value">
				{rawValue !== undefined ? rawValue : formatScore(score)}
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
	const [overallRank, setOverallRank] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [deleteResultTarget, setDeleteResultTarget] = useState(null);
	const [editResultTarget, setEditResultTarget] = useState(null);
	const [deleteCompetitorOpen, setDeleteCompetitorOpen] = useState(false);
	const [addResultOpen, setAddResultOpen] = useState(false);
	const [editProfileOpen, setEditProfileOpen] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const res = await api.get(`/rankings/competitors/${id}/history`);
			setCompetitor(res.data.competitor);
			setHistory(res.data.results ?? []);
			setScores(res.data.scores ?? null);
			setOverallRank(res.data.overallRank ?? null);
		} catch (err) {
			setError(
				err.response?.status === 404
					? 'Competitor not found.'
					: 'Failed to load competitor',
			);
		} finally {
			setLoading(false);
		}
	}, [id]);

	useEffect(() => {
		load();
	}, [load]);

	const handleDeleteResult = async () => {
		await api.delete(`/rankings/results/${deleteResultTarget.result_id}`);
		setDeleteResultTarget(null);
		load();
	};

	const handleDeleteCompetitor = async () => {
		await api.delete(`/rankings/competitors/${id}`);
		navigate('/admin/competitors');
	};

	const handleProfileSaved = (updated) => {
		setCompetitor((c) => ({
			...c,
			name: updated.name,
			email: updated.email,
			is_member: updated.is_member ? 1 : 0,
		}));
		// Reload so dependent values (overall rank when membership flips) refresh.
		load();
	};

	const isPlaceholder =
		!competitor?.email || competitor.email.endsWith('.nsl@placeholder.local');

	if (loading) return <div className="page-loading">Loading competitor…</div>;
	if (error) return <div className="alert alert-error">{error}</div>;
	if (!competitor) return <EmptyState message="Competitor not found." />;
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
				<div className="section-title-row">
					<h2 className="section-title">Profile</h2>
					<button
						className="btn btn-sm btn-secondary"
						onClick={() => setEditProfileOpen(true)}
					>
						Edit Profile
					</button>
				</div>
				<dl className="profile-fields">
					<div className="profile-field">
						<dt>Name</dt>
						<dd>{competitor.name}</dd>
					</div>
					<div className="profile-field">
						<dt>Email</dt>
						<dd>
							{isPlaceholder ? (
								<span className="profile-field__muted">
									{competitor.email ?? 'No email — placeholder assigned'}
								</span>
							) : (
								competitor.email
							)}
						</dd>
					</div>
				</dl>
				<div className="competitor-detail__email-status">
					<Badge
						text={isPlaceholder ? 'Placeholder Email' : 'Email Verified'}
						variant={isPlaceholder ? 'warning' : 'success'}
					/>
					<Badge
						text={competitor.is_member ? 'Member' : 'Non-member'}
						variant={competitor.is_member ? 'success' : 'neutral'}
					/>
				</div>
			</section>

			{/* Career Scores */}
			{scores && (
				<section className="card competitor-detail__scores">
					<h2 className="section-title">Career Scores</h2>
					<div className="score-cards">
						<ScoreCard
							label="Knockdowns"
							score={scores.knockdowns}
							variant="blue"
						/>
						<ScoreCard
							label="Distance"
							score={scores.distance}
							variant="teal"
						/>
						<ScoreCard label="Speed" score={scores.speed} variant="indigo" />
						<ScoreCard label="Woods" score={scores.woods} variant="green" />
						<ScoreCard
							label="Total"
							score={scores.total}
							variant="amber"
						/>{' '}
						<ScoreCard
							label="Overall Rank"
							rawValue={overallRank ? `#${overallRank}` : '—'}
							variant="bronze"
						/>{' '}
					</div>
				</section>
			)}

			{/* Tournament History */}
			<section className="card competitor-detail__history">
				<div className="section-title-row">
					<h2 className="section-title">Tournament History</h2>
					<button
						className="btn btn-sm btn-secondary"
						onClick={() => setAddResultOpen(true)}
					>
						Add Result
					</button>
				</div>
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
										<td>
											<Link to={`/admin/tournaments/${result.tournament_id}`}>
												{result.tournament_rank === 1 && '🥇 '}
												{result.tournament_rank === 2 && '🥈 '}
												{result.tournament_rank === 3 && '🥉 '}
												{result.tournament_name}
											</Link>
										</td>
										<td>{result.tournament_date}</td>
										<td className="score-cell">
											{result.knockdowns_earned ?? '—'}
										</td>
										<td className="score-cell">
											{result.distance_earned ?? '—'}
										</td>
										<td className="score-cell">{result.speed_earned ?? '—'}</td>
										<td className="score-cell">{result.woods_earned ?? '—'}</td>
										<td className="row-actions">
											<button
												className="btn btn-sm btn-secondary"
												onClick={() => setEditResultTarget(result)}
											>
												Edit
											</button>
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
			{editResultTarget && (
				<EditResultModal
					key={editResultTarget.result_id}
					result={editResultTarget}
					title={`Edit Result — ${editResultTarget.tournament_name}`}
					onClose={() => setEditResultTarget(null)}
					onSaved={load}
				/>
			)}
			{addResultOpen && (
				<AddResultModal
					competitorId={id}
					existingTournamentIds={history.map((r) => r.tournament_id)}
					onClose={() => setAddResultOpen(false)}
					onSaved={load}
				/>
			)}
			<EditCompetitorModal
				isOpen={editProfileOpen}
				onClose={() => setEditProfileOpen(false)}
				competitor={competitor}
				onSaved={handleProfileSaved}
			/>
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
