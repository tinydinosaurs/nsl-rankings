import './PageHeader.css';

export default function PageHeader({ title, subtitle, action }) {
	return (
		<div className="page-header">
			<div className="page-title">
				<h1>{title}</h1>
				{subtitle && <span className="page-subtitle">{subtitle}</span>}
			</div>
			{action && <div>{action}</div>}
		</div>
	);
}
