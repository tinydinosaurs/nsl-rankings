import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import api from '../../utils/api.js';
import PageHeader from '../../components/shared/PageHeader/PageHeader.jsx';
import ResultsUploadForm from '../../components/shared/ResultsUploadForm/ResultsUploadForm.jsx';
import { EVENT_LIST as EVENTS } from '../../constants/events.js';
import './TournamentUploadPage.css';

export default function TournamentUploadPage() {
	const { id } = useParams();
	const navigate = useNavigate();
	const location = useLocation();
	const stagedFile = location.state?.stagedFile || null;

	const [tournament, setTournament] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const { data } = await api.get(`/rankings/tournaments/${id}`);
				if (!cancelled) setTournament(data.tournament);
			} catch {
				if (!cancelled) setError('Failed to load tournament');
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [id]);

	if (loading) return <div className="page-loading">Loading tournament…</div>;

	if (error || !tournament) {
		return (
			<div className="tournament-upload-page">
				<PageHeader title="Upload Results" />
				<div className="alert alert-error">
					{error || 'Tournament not found.'}{' '}
					<Link to="/admin/tournaments">Back to tournaments</Link>
				</div>
			</div>
		);
	}

	const activeEventKeys = EVENTS
		.map(({ key }) => key)
		.filter((key) => tournament[`has_${key}`]);

	const totalPoints = {
		knockdowns: tournament.total_points_knockdowns,
		distance: tournament.total_points_distance,
		speed: tournament.total_points_speed,
		woods: tournament.total_points_woods,
	};

	const activeLabels = EVENTS
		.filter(({ key }) => tournament[`has_${key}`])
		.map(({ label }) => label)
		.join(' • ');

	return (
		<div className="tournament-upload-page">
			<PageHeader
				title={`Upload Results — ${tournament.name || 'Untitled tournament'}`}
				subtitle="Review the parsed results and confirm to save them to this tournament."
			/>

			<div className="card">
				<div className="meta-summary">
					{tournament.name && (
						<span>
							Tournament: <strong>{tournament.name}</strong>
						</span>
					)}
					{tournament.date && (
						<span>
							Date: <strong>{tournament.date}</strong>
						</span>
					)}
					{activeLabels && (
						<span>
							Events: <strong>{activeLabels}</strong>
						</span>
					)}
				</div>
			</div>

			<div className="card">
				<ResultsUploadForm
					activeEvents={activeEventKeys}
					totalPoints={totalPoints}
					tournamentId={tournament.id}
					tournamentName={tournament.name || ''}
					tournamentDate={tournament.date || ''}
					initialFile={stagedFile}
					onBack={() => navigate(`/admin/tournaments/${tournament.id}`)}
					onBackLabel="Cancel"
					onSuccess={() => navigate(`/admin/tournaments/${tournament.id}`)}
				/>
			</div>
		</div>
	);
}
