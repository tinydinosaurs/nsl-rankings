import { useState, useEffect } from 'react';
import api from '../../../utils/api.js';
import Modal from '../Modal/Modal.jsx';

/**
 * Edit competitor profile in a single modal — name, email, and member status
 * saved together. Mirrors AddCompetitorModal so the two flows feel consistent.
 *
 * Props:
 *   isOpen        boolean
 *   onClose       () => void
 *   competitor    { id, name, email, is_member } — required when open
 *   onSaved       (updatedFields) => void  — called after a successful PUT
 */
export default function EditCompetitorModal({
	isOpen,
	onClose,
	competitor,
	onSaved,
}) {
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [isMember, setIsMember] = useState(false);
	const [error, setError] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Keep local form state in sync whenever the modal (re)opens with a
	// competitor. Resetting on isOpen avoids leaking edits between sessions.
	useEffect(() => {
		if (!isOpen || !competitor) return;
		setName(competitor.name ?? '');
		const isPlaceholder =
			!competitor.email ||
			competitor.email.endsWith('.nsl@placeholder.local');
		setEmail(isPlaceholder ? '' : competitor.email);
		setIsMember(Boolean(competitor.is_member));
		setError('');
	}, [isOpen, competitor]);

	if (!competitor) return null;

	const handleSubmit = async (e) => {
		e.preventDefault();
		const trimmedName = name.trim();
		const trimmedEmail = email.trim();

		if (!trimmedName) {
			setError('Name is required');
			return;
		}
		if (
			trimmedEmail &&
			!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
		) {
			setError('Please enter a valid email address');
			return;
		}

		setIsSubmitting(true);
		setError('');

		try {
			const payload = {
				name: trimmedName,
				email: trimmedEmail || null,
				is_member: isMember,
			};
			const { data } = await api.put(
				`/rankings/competitors/${competitor.id}`,
				payload,
			);
			onSaved?.(data);
			onClose();
		} catch (err) {
			setError(err.response?.data?.error || 'Failed to save competitor');
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Edit Competitor">
			<form onSubmit={handleSubmit}>
				{error && <div className="alert alert-error">{error}</div>}

				<div className="form-group">
					<label htmlFor="edit-competitor-name">Name *</label>
					<input
						id="edit-competitor-name"
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						required
					/>
				</div>

				<div className="form-group">
					<label htmlFor="edit-competitor-email">Email</label>
					<input
						id="edit-competitor-email"
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="competitor@example.com (optional)"
					/>
					<small className="form-help">
						Leave blank to use a generated placeholder.
					</small>
				</div>

				<div className="form-group">
					<label className="checkbox-label">
						<input
							type="checkbox"
							checked={isMember}
							onChange={(e) => setIsMember(e.target.checked)}
						/>
						NSL member
					</label>
					<small className="form-help">
						Only members appear on the public leaderboard.
					</small>
				</div>

				<div className="modal-actions">
					<button
						type="button"
						className="btn btn-secondary"
						onClick={onClose}
						disabled={isSubmitting}
					>
						Cancel
					</button>
					<button
						type="submit"
						className="btn btn-primary"
						disabled={isSubmitting}
					>
						{isSubmitting ? 'Saving…' : 'Save Changes'}
					</button>
				</div>
			</form>
		</Modal>
	);
}
