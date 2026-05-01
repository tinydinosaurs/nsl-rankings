import { useId } from 'react';
import './Checkbox.css';

/**
 * Inline checkbox with a label and optional helper description.
 *
 * Use for any boolean toggle in forms, filter bars, or settings rows.
 * Wraps the native <input type="checkbox"> in a <label> so clicking the text
 * toggles the box, and scopes its own styling so the global `input` rule
 * doesn't override checkbox rendering.
 */
export default function Checkbox({
	label,
	description,
	checked,
	onChange,
	disabled = false,
	id,
	name,
	className = '',
}) {
	const generatedId = useId();
	const inputId = id || generatedId;

	return (
		<div className={`checkbox ${className}`.trim()}>
			<label className="checkbox-label" htmlFor={inputId}>
				<input
					id={inputId}
					name={name}
					type="checkbox"
					checked={checked}
					onChange={onChange}
					disabled={disabled}
					className="checkbox-input"
				/>
				<span className="checkbox-text">{label}</span>
			</label>
			{description && <small className="checkbox-description">{description}</small>}
		</div>
	);
}
