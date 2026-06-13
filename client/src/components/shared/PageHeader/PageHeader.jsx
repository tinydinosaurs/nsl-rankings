import IdentityStrip from '../../shared/IdentityStrip/IdentityStrip.jsx';

import './PageHeader.css';

export default function PageHeader({ title, subtitle, meta, action }) {
	return (
		<>
			<IdentityStrip />
			<header className="page-header">
				<div className="page-header__text">
					<p className="page-header__kicker">National Slingshot League</p>
					<h1 className="page-header__title">
						{title}
						<em aria-hidden="true">.</em>
					</h1>
					{subtitle && <p className="page-subtitle">{subtitle}</p>}
					{meta && <div className="page-header__meta">{meta}</div>}
				</div>
				{action && <div className="page-header__action">{action}</div>}
			</header>
		</>
	);
}
