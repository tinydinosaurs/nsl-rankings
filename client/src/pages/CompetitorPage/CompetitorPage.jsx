import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { EVENTS, EVENT_LABELS } from '../../constants/events';
import './CompetitorPage.css';

function fmt(val) {
	if (val === null || val === undefined) return '—';
	return (Math.round(val * 10) / 10).toFixed(1);
}

export default function CompetitorPage() {
	const { id } = useParams();
	const navigate = useNavigate();
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	useEffect(() => {
		api.get(`/rankings/competitors/${id}`)
			.then((res) => setData(res.data))
			.catch(() => setError('Competitor not found'))
			.finally(() => setLoading(false));
	}, [id]);

	if (loading) return <div className="page-loading">Loading…</div>;
	if (error) return <div className="alert alert-error">{error}</div>;

	// Compute current scores from history
	const eventAverages = {};
	for (const event of EVENTS) {
		const scores = data.history
			.map((h) => h[event])
			.filter((v) => v !== null && v !== undefined);
		eventAverages[event] =
			scores.length > 0
				? scores.reduce((a, b) => a + b, 0) / scores.length
				: null;
	}
	const total = EVENTS.reduce((s, e) => s + (eventAverages[e] ?? 0), 0) / 4;

	return (
		<div className="competitor-page">
			<button
				className="btn-ghost back-btn"
				onClick={() => navigate('/')}
			>
				← Back to Rankings
			</button>

			<h1>{data.name}</h1>

			<div className="score-cards">
				{EVENTS.map((event) => {
					const val = eventAverages[event];
					const hue = val !== null ? (val / 100) * 120 : null;
					return (
						<div className="score-card card" key={event}>
							<div className="score-card-label">
								{EVENT_LABELS[event]}
							</div>
							<div
								className="score-card-value"
								style={
									hue !== null
										? { color: `hsl(${hue}, 70%, 65%)` }
										: {}
								}
							>
								{fmt(val)}
							</div>
							<div className="score-card-count">
								{
									data.history.filter(
										(h) => h[event] !== null,
									).length
								}{' '}
								tournaments
							</div>
						</div>
					);
				})}
				<div className="score-card card score-card-total">
					<div className="score-card-label">Total Score</div>
					<div className="score-card-value total">{fmt(total)}</div>
				</div>
			</div>

			<h2>Tournament History</h2>
			{data.history.length === 0 ? (
				<div className="card empty-state">
					No tournament results yet.
				</div>
			) : (
				<div className="table-wrapper card">
					<table className="history-table">
						<thead>
							<tr>
								<th>Tournament</th>
								<th>Date</th>
								{EVENTS.map((e) => (
									<th key={e}>{EVENT_LABELS[e]}</th>
								))}
							</tr>
						</thead>
						<tbody>
							{[...data.history].reverse().map((row, i) => (
								<tr key={i}>
									<td>
										{row.tournament_name || (
											<span
												style={{
													color: 'var(--text-muted)',
												}}
											>
												—
											</span>
										)}
									</td>
									<td>{row.tournament_date}</td>
									{EVENTS.map((e) => (
										<td
											key={e}
											className={
												row[e] === null
													? 'null-score'
													: ''
											}
										>
											{fmt(row[e])}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
