import { useState, useEffect } from 'react';
import api from '../../utils/api.js';
import {
	EyeIcon,
	EyeOffIcon,
} from '../../components/shared/EyeIcons/EyeIcons.jsx';
import { useAuth } from '../../hooks/useAuth.jsx';
import Badge from '../../components/shared/Badge/Badge.jsx';
import Modal from '../../components/shared/Modal/Modal.jsx';
import ConfirmDialog from '../../components/shared/ConfirmDialog/ConfirmDialog.jsx';
import PageHeader from '../../components/shared/PageHeader/PageHeader.jsx';
import './AdminUsersPage.css';

function formatDate(dateStr) {
	if (!dateStr) return '—';
	return new Date(dateStr).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	});
}

export default function AdminUsersPage() {
	const { user: currentUser } = useAuth();

	// Users list
	const [users, setUsers] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	// Create form
	const [createUsername, setCreateUsername] = useState('');
	const [createPassword, setCreatePassword] = useState('');
	const [showCreatePassword, setShowCreatePassword] = useState(false);
	const [createError, setCreateError] = useState('');
	const [createSuccess, setCreateSuccess] = useState('');
	const [isCreating, setIsCreating] = useState(false);

	// Edit modal
	const [editTarget, setEditTarget] = useState(null);
	const [editUsername, setEditUsername] = useState('');
	const [editPassword, setEditPassword] = useState('');
	const [showEditPassword, setShowEditPassword] = useState(false);
	const [editRole, setEditRole] = useState('admin');
	const [editError, setEditError] = useState('');
	const [isSaving, setIsSaving] = useState(false);

	// Delete confirm
	const [deleteTarget, setDeleteTarget] = useState(null);

	const loadUsers = async () => {
		setLoading(true);
		try {
			const res = await api.get('/auth/users');
			setUsers(res.data);
			setError('');
		} catch {
			setError('Failed to load users');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadUsers();
	}, []);

	const handleCreate = async (e) => {
		e.preventDefault();
		setCreateError('');
		setCreateSuccess('');
		setIsCreating(true);
		try {
			await api.post('/auth/users', {
				username: createUsername.trim(),
				password: createPassword,
				role: 'admin',
			});
			setCreateSuccess(`Account created for ${createUsername.trim()}`);
			setCreateUsername('');
			setCreatePassword('');
			loadUsers();
		} catch (err) {
			if (err.response?.status === 409) {
				setCreateError('Username already taken');
			} else {
				setCreateError(err.response?.data?.error || 'Failed to create account');
			}
		} finally {
			setIsCreating(false);
		}
	};

	const openEdit = (u) => {
		setEditTarget(u);
		setEditUsername(u.username);
		setShowEditPassword(false);
		setEditPassword('');
		setEditRole(u.role);
		setEditError('');
	};

	const handleSaveEdit = async (e) => {
		e.preventDefault();
		setEditError('');
		setIsSaving(true);
		try {
			const body = {
				username: editUsername.trim(),
				role: editRole,
			};
			if (editPassword) body.password = editPassword;
			await api.put(`/auth/users/${editTarget.id}`, body);
			setEditTarget(null);
			loadUsers();
		} catch (err) {
			if (err.response?.status === 409) {
				setEditError('Username already taken');
			} else {
				setEditError(err.response?.data?.error || 'Failed to save changes');
			}
		} finally {
			setIsSaving(false);
		}
	};

	const handleDeleteConfirmed = async () => {
		try {
			await api.delete(`/auth/users/${deleteTarget.id}`);
			setDeleteTarget(null);
			loadUsers();
		} catch (err) {
			setError(err.response?.data?.error || 'Failed to delete user');
			setDeleteTarget(null);
		}
	};

	return (
		<div className="page-container">
			<PageHeader title="User Management" subtitle="Manage admin accounts" />

			{/* ── Create New User ── */}
			<section className="card users-create-card">
				<h2 className="section-title">Create New User</h2>
				<form className="users-create-form" onSubmit={handleCreate}>
					{createError && (
						<div className="alert alert-error">{createError}</div>
					)}
					{createSuccess && (
						<div className="alert alert-success">{createSuccess}</div>
					)}
					<div className="users-create-fields">
						<div className="form-group">
							<label htmlFor="new-username">Username</label>
							<input
								id="new-username"
								type="text"
								value={createUsername}
								onChange={(e) => setCreateUsername(e.target.value)}
								placeholder="Username"
								required
								autoComplete="off"
							/>
						</div>
						<div className="form-group">
							<label htmlFor="new-password">Password</label>
							<div className="password-field">
								<input
									id="new-password"
									type={showCreatePassword ? 'text' : 'password'}
									value={createPassword}
									onChange={(e) => setCreatePassword(e.target.value)}
									placeholder="Password"
									required
									autoComplete="new-password"
								/>
								<button
									type="button"
									className="password-toggle"
									onClick={() => setShowCreatePassword((v) => !v)}
									aria-label={
										showCreatePassword ? 'Hide password' : 'Show password'
									}
								>
									{showCreatePassword ? <EyeOffIcon /> : <EyeIcon />}
								</button>
							</div>
						</div>
						<div className="form-group">
							<label htmlFor="new-role">Role</label>
							<select id="new-role" value="admin" disabled>
								<option value="admin">admin</option>
							</select>
						</div>
					</div>
					<button
						type="submit"
						className="btn btn-primary"
						disabled={isCreating}
					>
						{isCreating ? 'Creating…' : 'Create Account'}
					</button>
				</form>
			</section>

			{/* ── Active Users ── */}
			<section className="card">
				<h2 className="section-title">Active Users</h2>
				{loading && <p className="page-loading">Loading…</p>}
				{error && <div className="alert alert-error">{error}</div>}
				{!loading && !error && (
					<div className="table-wrapper">
						<table className="data-table">
							<thead>
								<tr>
									<th>Username</th>
									<th>Role</th>
									<th>Date joined</th>
									<th aria-label="Actions" />
								</tr>
							</thead>
							<tbody>
								{users.map((u) => {
									const isSelf = u.id === currentUser?.id;
									return (
										<tr key={u.id}>
											<td className="user-username">{u.username}</td>
											<td>
												<Badge
													text={u.role}
													variant={u.role === 'owner' ? 'owner' : 'admin'}
												/>
											</td>
											<td>{formatDate(u.created_at)}</td>
											<td className="row-actions">
												<button
													className="btn btn-secondary"
													onClick={() => openEdit(u)}
												>
													Edit
												</button>
												<button
													className="btn btn-danger btn-sm"
													onClick={() => setDeleteTarget(u)}
													disabled={isSelf}
													title={
														isSelf
															? 'You cannot delete your own account'
															: undefined
													}
												>
													Delete
												</button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</section>

			{/* ── Pending Invitations (stub) ── */}
			<section className="card users-invitations-stub">
				<h2 className="section-title">Pending Invitations</h2>
				<p className="users-stub-text">
					Invitation-based onboarding coming soon.
				</p>
			</section>

			{/* ── Edit Modal ── */}
			<Modal
				isOpen={!!editTarget}
				onClose={() => setEditTarget(null)}
				title={`Edit ${editTarget?.username ?? 'User'}`}
			>
				<form onSubmit={handleSaveEdit}>
					{editError && <div className="alert alert-error">{editError}</div>}
					<div className="form-group">
						<label htmlFor="edit-username">Username</label>
						<input
							id="edit-username"
							type="text"
							value={editUsername}
							onChange={(e) => setEditUsername(e.target.value)}
							required
							autoComplete="off"
						/>
					</div>
					<div className="form-group">
						<label htmlFor="edit-password">
							New password{' '}
							<span className="field-optional">
								(leave blank to keep current)
							</span>
						</label>
						<div className="password-field">
							<input
								id="edit-password"
								type={showEditPassword ? 'text' : 'password'}
								value={editPassword}
								onChange={(e) => setEditPassword(e.target.value)}
								placeholder="Leave blank to keep current"
								autoComplete="new-password"
							/>
							<button
								type="button"
								className="password-toggle"
								onClick={() => setShowEditPassword((v) => !v)}
								aria-label={
									showEditPassword ? 'Hide password' : 'Show password'
								}
							>
								{showEditPassword ? <EyeOffIcon /> : <EyeIcon />}
							</button>
						</div>
					</div>
					<div className="form-group">
						<label htmlFor="edit-role">Role</label>
						<select
							id="edit-role"
							value={editRole}
							onChange={(e) => setEditRole(e.target.value)}
							disabled={editTarget?.id === currentUser?.id}
						>
							<option value="admin">admin</option>
							<option value="owner">owner</option>
						</select>
					</div>
					{editTarget?.id === currentUser?.id && (
						<p className="field-hint">You cannot change your own role.</p>
					)}
					<div className="modal-actions">
						<button
							type="button"
							className="btn btn-secondary"
							onClick={() => setEditTarget(null)}
						>
							Cancel
						</button>
						<button
							type="submit"
							className="btn btn-primary"
							disabled={isSaving}
						>
							{isSaving ? 'Saving…' : 'Save Changes'}
						</button>
					</div>
				</form>
			</Modal>

			{/* ── Delete Confirm ── */}
			<ConfirmDialog
				isOpen={!!deleteTarget}
				title="Delete account"
				message={`Delete account '${deleteTarget?.username}'? This cannot be undone.`}
				confirmLabel="Delete"
				variant="danger"
				onConfirm={handleDeleteConfirmed}
				onCancel={() => setDeleteTarget(null)}
			/>
		</div>
	);
}
