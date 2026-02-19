import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import './Layout.css';

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <nav className="navbar">
        <div className="navbar-brand">🏆 Sport Rankings</div>
        <div className="navbar-links">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Rankings
          </NavLink>
          {isAdmin && (
            <>
              <NavLink to="/upload" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                Upload CSV
              </NavLink>
              <NavLink to="/admin" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                Admin
              </NavLink>
            </>
          )}
        </div>
        <div className="navbar-user">
          <span className={`badge badge-${user.role}`}>{user.role}</span>
          <span className="username">{user.username}</span>
          <button className="btn-ghost" onClick={handleLogout}>Sign out</button>
        </div>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
