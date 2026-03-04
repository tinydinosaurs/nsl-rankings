import { useState } from 'react';
import './EditableField.css';

export default function EditableField({ label, value, onSave, type = 'text', placeholder }) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(value ?? '');
	const [error, setError] = useState('');
	const [saving, setSaving] = useState(false);

	const handleSave = async () => {
		setSaving(true);
		setError('');
		try {
			await onSave(draft.trim());
			setEditing(false);
		} catch (err) {
			setError(err.message || 'Failed to save');
		} finally {
			setSaving(false);
		}
	};

	const handleCancel = () => {
		setDraft(value ?? '');
		setError('');
		setEditing(false);
	};

	if (!editing) {
		return (
			<div className="editable-field">
				<span className="editable-field__label">{label}</span>
				<span className="editable-field__value">
					{value ||
						(placeholder ? (
							<em className="muted">{placeholder}</em>
						) : (
							<em className="muted">Not set</em>
						))}
				</span>
				<button className="btn btn-sm btn-secondary" onClick={() => setEditing(true)}>
					Edit
				</button>
			</div>
		);
	}

	return (
		<div className="editable-field editable-field--editing">
			<span className="editable-field__label">{label}</span>
			<input
				className="editable-field__input"
				type={type}
				value={draft}
				placeholder={placeholder}
				onChange={(e) => setDraft(e.target.value)}
				autoFocus
			/>
			<div className="editable-field__actions">
				<button className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving}>
					{saving ? 'Saving…' : 'Save'}
				</button>
				<button className="btn btn-sm btn-secondary" onClick={handleCancel} disabled={saving}>
					Cancel
				</button>
			</div>
			{error && <span className="editable-field__error">{error}</span>}
		</div>
	);
}
