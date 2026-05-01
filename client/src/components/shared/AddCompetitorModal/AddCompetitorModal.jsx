import { useState } from 'react';
import api from '../../../utils/api.js';
import Modal from '../Modal/Modal.jsx';

export default function AddCompetitorModal({ isOpen, onClose, onAdd }) {
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [isMember, setIsMember] = useState(false);
	const [error, setError] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!name.trim()) {
			setError('Name is required');
			return;
		}

		setIsSubmitting(true);
		setError('');

		try {
			await api.post('/rankings/competitors', {
				name: name.trim(),
				email: email.trim() || undefined,
				is_member: isMember,
			});
			onAdd();
			setName('');
			setEmail('');
			setIsMember(false);
			onClose();
		} catch (err) {
			setError(err.response?.data?.error || 'Failed to add competitor');
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Add Competitor">
			<form onSubmit={handleSubmit}>
				{error && <div className="alert alert-error">{error}</div>}

				<div className="form-group">
					<label htmlFor="competitor-name">Name *</label>
					<input
						id="competitor-name"
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Enter competitor's full name"
						required
					/>
				</div>

				<div className="form-group">
					<label htmlFor="competitor-email">Email</label>
					<input
						id="competitor-email"
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="competitor@example.com (optional)"
					/>
					<small className="form-help">
						If empty, a placeholder email will be generated
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
					<button type="button" className="btn btn-secondary" onClick={onClose}>
						Cancel
					</button>
					<button type="submit" className="btn btn-primary" disabled={isSubmitting}>
						{isSubmitting ? 'Adding...' : 'Add Competitor'}
					</button>
				</div>
			</form>
		</Modal>
	);
}
