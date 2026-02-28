import './EmptyState.css';

export default function EmptyState({ message }) {
	return (
		<div className="card empty-state">
			<p>{message}</p>
		</div>
	);
}
