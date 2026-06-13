import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../utils/api.js';
import PageHeader from '../../components/shared/PageHeader/PageHeader.jsx';
import TournamentDraftPage from './TournamentDraftPage.jsx';

/**
 * Route wrapper for /admin/tournaments/:id/upload.
 *
 * Loads the tournament from the API and seeds TournamentDraftPage's initial
 * metadata. The DB is the source of truth here — no sessionStorage draft —
 * so we render a small loading/error shell while the fetch is in flight and
 * pass everything through to the draft page once it lands.
 */
export default function TournamentUploadWrapper() {
	const { id } = useParams();
	const [tournament, setTournament] = useState(null);
	const [participantCount, setParticipantCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const { data } = await api.get(`/rankings/tournaments/${id}`);
				if (!cancelled) {
					setTournament(data.tournament);
					setParticipantCount(data.participant_count ?? 0);
				}
			} catch (err) {
				if (cancelled) return;
				if (err.response?.status === 404) {
					setError(
						"We couldn't find a tournament with that ID. It may have been deleted, or the link may be wrong.",
					);
				} else {
					setError(
						'Something went wrong loading this tournament. Please try again \u2014 if it keeps happening, refresh the page.',
					);
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [id]);

	if (loading) {
		return <div className="page-loading">Loading tournament…</div>;
	}

	if (error || !tournament) {
		return (
			<div className="tournament-draft-page">
				<PageHeader title="Tournament not available" />
				<div className="alert alert-error">
					<p>
						{error ||
							"We couldn't find a tournament with that ID. It may have been deleted, or the link may be wrong."}
					</p>
					<p>
						<Link to="/admin/tournaments">← Back to all tournaments</Link>
					</p>
				</div>
			</div>
		);
	}

	const initialMetadata = {
		name: tournament.name ?? '',
		date: tournament.date ?? '',
		events: {
			has_knockdowns: !!tournament.has_knockdowns,
			has_distance: !!tournament.has_distance,
			has_speed: !!tournament.has_speed,
			has_woods: !!tournament.has_woods,
		},
		points: {
			total_points_knockdowns: tournament.total_points_knockdowns ?? 120,
			total_points_distance: tournament.total_points_distance ?? 120,
			total_points_speed: tournament.total_points_speed ?? 120,
			total_points_woods: tournament.total_points_woods ?? 120,
		},
	};

	return (
		<TournamentDraftPage
			mode="update"
			tournamentId={Number(id)}
			initialMetadata={initialMetadata}
			existingResultCount={participantCount}
			pageTitle={`Add results to ${tournament.name || 'tournament'}`}
			pageSubtitle="Upload a results file. You can adjust tournament details inline if needed — nothing is saved until you confirm."
			cancelTo={`/admin/tournaments/${id}`}
		/>
	);
}
