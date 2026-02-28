import './Badge.css';

export default function Badge({ text, variant = 'neutral' }) {
	return <span className={`badge badge-${variant}`}>{text}</span>;
}
