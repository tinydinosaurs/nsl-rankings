import { useState } from 'react';
import api from '../../../utils/api.js';
import Modal from '../Modal/Modal.jsx';
import './EditResultModal.css';

const EVENT_LABELS = {
	knockdowns: 'Knockdowns',
	distance: 'Distance',
	speed: 'Speed',
	woods: 'Woods',
};

const ALL_EVENTS = ['knockdowns', 'distance', 'speed', 'woods'];

/**
 * EditResultModal — shared modal for editing a competitor's earned scores
 * in a single tournament result.
 *
 * Props:
 *   result   — the result row, must include result_id and *_earned fields
 *   title    — modal heading (e.g. "Edit Result — Jane Smith")
 *   onClose  — called when modal should close
 *   onSaved  — called after successful save (trigger a reload in the parent)
 */
export default function EditResultModal({ result, title, onClose, onSaved }) {
	// Active events = those where earned is not null (null means event not held)
	const activeEvents = ALL_EVENTS.filter(
		(key) =>
			result[`${key}_earned`] !== null &&
			result[`${key}_earned`] !== undefined,
	);

	const [form, setForm] = useState(() => {
		const init = {};
		activeEvents.forEach((key) => {
			init[key] = String(result[`${key}_earned`] ?? '');
		});
		return init;
	});

	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	const handleSubmit = async (e) => {
		e.preventDefault();
		setSaving(true);
		setError('');

		const payload = {};
		for (const key of activeEvents) {
			const raw = form[key].trim();
			const val = raw === '' ? 0 : parseFloat(raw);
			if (isNaN(val) || val < 0) {
				setError(`Invalid value for ${EVENT_LABELS[key]}`);
				setSaving(false);
				return;
			}
			payload[`${key}_earned`] = val;
		}

		try {
			await api.put(`/rankings/results/${result.result_id}`, payload);
			onSaved();
			onClose();
		} catch (err) {
			setError(err.response?.data?.error || 'Failed to save');
			setSaving(false);
		}
	};

	return (
		<Modal isOpen title={title || 'Edit Result'} onClose={onClose}>
			{error && <div className="alert alert-error">{error}</div>}
			<form onSubmit={handleSubmit} className="edit-result-form">
				{activeEvents.map((key, i) => (
					<div className="form-group" key={key}>
						<label>{EVENT_LABELS[key]} earned</label>
						<input
							type="number"
							min="0"
							step="0.1"
							value={form[key]}
							autoFocus={i === 0}
							onChange={(e) =>
								setForm((f) => ({ ...f, [key]: e.target.value }))
							}
						/>
					</div>
				))}
				<div className="edit-result-form__actions">
					<button
						type="submit"
						className="btn btn-primary"
						disabled={saving}
					>
						{saving ? 'Saving…' : 'Save Changes'}
					</button>
					<button
						type="button"
						className="btn btn-secondary"
						onClick={onClose}
						disabled={saving}
					>
						Cancel
					</button>
				</div>
			</form>
		</Modal>
	);
}
