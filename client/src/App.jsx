import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import LoginPage from './pages/LoginPage/LoginPage.jsx';
import RankingsPage from './pages/RankingsPage/RankingsPage.jsx';
import CompetitorDetailPage from './pages/CompetitorPage/CompetitorDetailPage.jsx';
import CompetitorsListPage from './pages/CompetitorPage/CompetitorsListPage.jsx';
import TournamentListPage from './pages/TournamentPage/TournamentListPage.jsx';
import TournamentDetailPage from './pages/TournamentPage/TournamentDetailPage.jsx';
import TournamentNewPage from './pages/TournamentNewPage/TournamentNewPage.jsx';
import TournamentUploadPage from './pages/TournamentUploadPage/TournamentUploadPage.jsx';
import AdminPage from './pages/AdminPage/AdminPage.jsx';
import AdminUsersPage from './pages/AdminUsersPage/AdminUsersPage.jsx';
import AccountPage from './pages/AccountPage/AccountPage.jsx';
import Layout from './components/shared/Layout/Layout.jsx';

function RequireAuth({ children }) {
	const { user } = useAuth();
	return user ? children : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }) {
	const { user, isAdmin } = useAuth();
	if (!user) return <Navigate to="/login" replace />;
	if (!isAdmin) return <Navigate to="/" replace />;
	return children;
}

function RequireOwner({ children }) {
	const { user } = useAuth();
	if (!user) return <Navigate to="/login" replace />;
	if (user.role !== 'owner') return <Navigate to="/admin" replace />;
	return children;
}

export default function App() {
	return (
		<AuthProvider>
			<BrowserRouter>
				<Routes>
					<Route path="/login" element={<LoginPage />} />
					{/* Public leaderboard route */}
					<Route path="/" element={<Layout />}>
						<Route index element={<RankingsPage />} />
					</Route>
					{/* Authenticated routes */}
					<Route
						path="/"
						element={
							<RequireAuth>
								<Layout />
							</RequireAuth>
						}
					>
						<Route
							path="admin"
							element={
								<RequireAdmin>
									<AdminPage />
								</RequireAdmin>
							}
						/>
						<Route
							path="admin/tournaments/new"
							element={
								<RequireAdmin>
									<TournamentNewPage />
								</RequireAdmin>
							}
						/>
						<Route
							path="admin/tournaments/:id/upload"
							element={
								<RequireAdmin>
									<TournamentUploadPage />
								</RequireAdmin>
							}
						/>
						<Route
							path="admin/competitors"
							element={
								<RequireAdmin>
									<CompetitorsListPage />
								</RequireAdmin>
							}
						/>
						<Route
							path="admin/competitors/:id"
							element={
								<RequireAdmin>
									<CompetitorDetailPage />
								</RequireAdmin>
							}
						/>
						<Route
							path="/admin/tournaments/:id"
							element={
								<RequireAdmin>
									<TournamentDetailPage />
								</RequireAdmin>
							}
						/>
						<Route
							path="/admin/tournaments"
							element={
								<RequireAdmin>
									<TournamentListPage />
								</RequireAdmin>
							}
						/>
						<Route
							path="/admin/users"
							element={
								<RequireOwner>
									<AdminUsersPage />
								</RequireOwner>
							}
						/>
						<Route
							path="/admin/account"
							element={
								<RequireAuth>
									<AccountPage />
								</RequireAuth>
							}
						/>
					</Route>
				</Routes>
			</BrowserRouter>
		</AuthProvider>
	);
}
