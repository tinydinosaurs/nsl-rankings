import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { EyeIcon, EyeOffIcon } from '../../components/shared/EyeIcons/EyeIcons.jsx';
import './LoginPage.css';

export default function LoginPage() {
	const { login, user } = useAuth();
	const navigate = useNavigate();
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);

	useEffect(() => {
		if (user) navigate('/admin', { replace: true });
	}, [user, navigate]);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		try {
			const user = await login(username, password);
			// Redirect admin/owner to dashboard, others to public rankings
			if (user.role === 'admin' || user.role === 'owner') {
				navigate('/admin');
			} else {
				navigate('/');
			}
		} catch (err) {
			setError(err.response?.data?.error || 'Login failed');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="login-page">
			<div className="login-card card">
				<h1>🏆 NSL Rankings</h1>
				<p className="login-subtitle">Sign in to continue</p>

				{error && <div className="alert alert-error">{error}</div>}

				<form onSubmit={handleSubmit}>
					<div className="form-group">
						<label>Username</label>
						<input
							type="text"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							autoFocus
							required
						/>
					</div>
					<div className="form-group">
						<label htmlFor="login-password">Password</label>
						<div className="password-field">
							<input
								id="login-password"
								type={showPassword ? 'text' : 'password'}
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
							/>
							<button
								type="button"
								className="password-toggle"
								onClick={() => setShowPassword((v) => !v)}
								aria-label={showPassword ? 'Hide password' : 'Show password'}
							>
								{showPassword ? <EyeOffIcon /> : <EyeIcon />}
							</button>
						</div>
					</div>
					<button
						type="submit"
						className="btn btn-primary"
						disabled={loading}
						style={{ width: '100%' }}
					>
						{loading ? 'Signing in…' : 'Sign in'}
					</button>
				</form>
			</div>
		</div>
	);
}
