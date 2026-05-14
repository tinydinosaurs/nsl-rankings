import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth.jsx';
import './Layout.css';

export default function Layout() {
	const { user, logout, isAdmin } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const [menuOpenPath, setMenuOpenPath] = useState(null);
	const menuOpen = menuOpenPath === location.pathname;
	const openMenu = () => setMenuOpenPath(location.pathname);
	const closeMenu = () => setMenuOpenPath(null);
	const navRef = useRef();

	// Close on outside click
	useEffect(() => {
		if (!menuOpen) return;
		const handler = (e) => {
			if (navRef.current && !navRef.current.contains(e.target)) {
				closeMenu();
			}
		};
		document.addEventListener('mousedown', handler);
		document.addEventListener('touchstart', handler);
		return () => {
			document.removeEventListener('mousedown', handler);
			document.removeEventListener('touchstart', handler);
		};
	}, [menuOpen]);

	const handleLogout = () => {
		closeMenu();
		logout();
		navigate('/login');
	};

	const navLinkClass = ({ isActive }) =>
		isActive ? 'nav-link active' : 'nav-link';

	return (
		<div className="layout">
			<div ref={navRef}>
				<nav className="navbar">
					<div className="navbar-brand">🏆 NSL Rankings</div>
					<div className="navbar-links">
						{isAdmin && (
							<>
								<NavLink to="/admin" end className={navLinkClass}>
									Dashboard
								</NavLink>
								<NavLink to="/admin/competitors" className={navLinkClass}>
									Competitors
								</NavLink>
								<NavLink to="/admin/tournaments" className={navLinkClass}>
									Tournaments
								</NavLink>
								{user?.role === 'owner' && (
									<NavLink to="/admin/users" className={navLinkClass}>
										Users
									</NavLink>
								)}
							</>
						)}
						<NavLink to="/" end className={navLinkClass}>
							Rankings
						</NavLink>
					</div>
					<div className="navbar-user">
						{user ? (
							<>
								<NavLink to="/admin/account" className="username-link">
									{user.username}
								</NavLink>
								<button className="btn btn-ghost" onClick={handleLogout}>
									Sign out
								</button>
							</>
						) : (
							<NavLink to="/login" className="nav-link">
								Login
							</NavLink>
						)}
					</div>
					<button
						className="navbar-menu-toggle"
						onClick={() => (menuOpen ? closeMenu() : openMenu())}
						aria-expanded={menuOpen}
						aria-label="Toggle navigation menu"
					>
						<span />
						<span />
						<span />
					</button>
				</nav>

				{menuOpen && (
					<div className="mobile-menu">
						{isAdmin && (
							<>
								<NavLink
									to="/admin"
									end
									className={navLinkClass}
									onClick={closeMenu}
								>
									Dashboard
								</NavLink>
								<NavLink
									to="/admin/competitors"
									className={navLinkClass}
									onClick={closeMenu}
								>
									Competitors
								</NavLink>
								<NavLink
									to="/admin/tournaments"
									className={navLinkClass}
									onClick={closeMenu}
								>
									Tournaments
								</NavLink>
								{user?.role === 'owner' && (
									<NavLink
										to="/admin/users"
										className={navLinkClass}
										onClick={closeMenu}
									>
										Users
									</NavLink>
								)}
							</>
						)}
						<NavLink to="/" end className={navLinkClass} onClick={closeMenu}>
							Rankings
						</NavLink>
						<div className="mobile-menu__user">
							{user ? (
								<>
									<NavLink
										to="/admin/account"
										className="username-link"
										onClick={closeMenu}
									>
										{user.username}
									</NavLink>
									<button className="btn btn-ghost" onClick={handleLogout}>
										Sign out
									</button>
								</>
							) : (
								<NavLink to="/login" className="nav-link" onClick={closeMenu}>
									Login
								</NavLink>
							)}
						</div>
					</div>
				)}
			</div>

			<main className="main-content">
				<Outlet />
			</main>
		</div>
	);
}
