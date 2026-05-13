import './IdentityStrip.css';

/**
 * NSL ceremonial divider — a 4px burgundy band with a 1px burgundy-tint
 * underline beneath it. Sits above heroes / page titles as a brand accent.
 * Pure decoration: no role, no interaction. Use sparingly — the signature
 * NSL move per the design brief.
 */
export default function IdentityStrip() {
	return (
		<div role="presentation" aria-hidden="true">
			<div className="identity-strip" />
			<div className="identity-strip__thin" />
		</div>
	);
}
