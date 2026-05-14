import { useState } from 'react';
import api from '../../utils/api.js';
import { useAuth } from '../../hooks/useAuth.jsx';
import PageHeader from '../../components/shared/PageHeader/PageHeader.jsx';
import Badge from '../../components/shared/Badge/Badge.jsx';
import {
	EyeIcon,
	EyeOffIcon,
} from '../../components/shared/EyeIcons/EyeIcons.jsx';
import './AccountPage.css';

export default function AccountPage() {
	const { user } = useAuth();

	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [showCurrent, setShowCurrent] = useState(false);
	const [showNew, setShowNew] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');
	const [saving, setSaving] = useState(false);

	const resetForm = () => {
		setCurrentPassword('');
		setNewPassword('');
		setConfirmPassword('');
		setShowCurrent(false);
		setShowNew(false);
		setShowConfirm(false);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError('');
		setSuccess('');

		if (newPassword !== confirmPassword) {
			setError('New password and confirmation do not match.');
			return;
		}
		if (newPassword === currentPassword) {
			setError('New password must be different from your current password.');
			return;
		}

		setSaving(true);
		try {
			await api.put('/auth/me/password', {
				currentPassword,
				newPassword,
			});
			setSuccess('Password updated.');
			resetForm();
		} catch (err) {
			setError(
				err.response?.data?.error ||
					'Failed to update password. Please try again.',
			);
		} finally {
			setSaving(false);
		}
	};

	if (!user) {
		// Should be unreachable thanks to RequireAuth, but be defensive.
		return null;
	}

	return (
		<div className="account-page">
			<PageHeader
				title="Account"
				subtitle="Your username and role, plus a way to change your password."
			/>

			<section className="card account-page__profile">
				<h2 className="section-title">Profile</h2>
				<dl className="account-page__profile-list">
					<div>
						<dt>Username</dt>
						<dd>{user.username}</dd>
					</div>
					<div>
						<dt>Role</dt>
						<dd>
							<Badge variant={user.role} text={user.role} />
						</dd>
					</div>
				</dl>
			</section>

			<section className="card account-page__password">
				<h2 className="section-title">Change password</h2>
				<p className="account-page__hint">
					Passwords must be at least 8 characters and include an uppercase
					letter, a lowercase letter, and a number.
				</p>

				{error && <div className="alert alert-error">{error}</div>}
				{success && <div className="alert alert-success">{success}</div>}

				<form className="account-page__form" onSubmit={handleSubmit}>
					<PasswordField
						id="current-password"
						label="Current password"
						value={currentPassword}
						onChange={setCurrentPassword}
						show={showCurrent}
						onToggleShow={() => setShowCurrent((v) => !v)}
						autoComplete="current-password"
					/>
					<PasswordField
						id="new-password"
						label="New password"
						value={newPassword}
						onChange={setNewPassword}
						show={showNew}
						onToggleShow={() => setShowNew((v) => !v)}
						autoComplete="new-password"
					/>
					<PasswordField
						id="confirm-password"
						label="Confirm new password"
						value={confirmPassword}
						onChange={setConfirmPassword}
						show={showConfirm}
						onToggleShow={() => setShowConfirm((v) => !v)}
						autoComplete="new-password"
					/>

					<div className="account-page__actions">
						<button
							type="submit"
							className="btn btn-primary"
							disabled={
								saving || !currentPassword || !newPassword || !confirmPassword
							}
						>
							{saving ? 'Saving…' : 'Update password'}
						</button>
					</div>
				</form>
			</section>
		</div>
	);
}

function PasswordField({
	id,
	label,
	value,
	onChange,
	show,
	onToggleShow,
	autoComplete,
}) {
	return (
		<div className="form-group">
			<label htmlFor={id}>{label}</label>
			<div className="password-field">
				<input
					id={id}
					type={show ? 'text' : 'password'}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					autoComplete={autoComplete}
					required
				/>
				<button
					type="button"
					className="password-toggle"
					onClick={onToggleShow}
					aria-label={show ? 'Hide password' : 'Show password'}
				>
					{show ? <EyeOffIcon /> : <EyeIcon />}
				</button>
			</div>
		</div>
	);
}
