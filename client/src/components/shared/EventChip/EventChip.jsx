import './EventChip.css';

const EVENT_KEYS = new Set(['knockdowns', 'distance', 'speed', 'woods']);

/**
 * Event identity chip — a 3px-rule + tinted-bg badge that denotes one of the
 * four NSL events. Equal weight across events (no rainbow). Used as column
 * headers on the leaderboard, score-card labels, and anywhere an event needs
 * a glance-readable identity marker without competing with rank/score.
 *
 * @param {object} props
 * @param {'knockdowns'|'distance'|'speed'|'woods'} props.event
 * @param {string} [props.label] Optional override label (defaults to the
 *   capitalized event key, with "Woods" for woods).
 * @param {string} [props.className]
 */
export default function EventChip({ event, label, className = '' }) {
	if (!EVENT_KEYS.has(event)) return null;
	const text = label ?? (event === 'woods' ? 'Woods' : capitalize(event));
	return (
		<span className={`event-chip event-chip--${event} ${className}`.trim()}>
			{text}
		</span>
	);
}

function capitalize(s) {
	return s.charAt(0).toUpperCase() + s.slice(1);
}
