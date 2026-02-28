import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import LoginPage from './pages/LoginPage/LoginPage.jsx';
import RankingsPage from './pages/RankingsPage/RankingsPage.jsx';
import CompetitorPage from './pages/CompetitorPage/CompetitorPage.jsx';
import CompetitorsListPage from './pages/CompetitorPage/CompetitorsListPage.jsx';
import AdminPage from './pages/AdminPage/AdminPage.jsx';
import UploadPage from './pages/UploadPage/UploadPage.jsx';
import Layout from './components/shared/Layout/Layout.jsx';

function RequireAuth({ children }) {
	const { user } = useAuth();
	return user ? children : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }) {
	const { user } = useAuth();
	if (!user) return <Navigate to="/login" replace />;
	if (!['admin', 'owner'].includes(user.role))
		return <Navigate to="/" replace />;
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
							path="competitors/:id"
							element={<CompetitorPage />}
						/>
						<Route
							path="admin"
							element={
								<RequireAdmin>
									<AdminPage />
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
							path="upload"
							element={
								<RequireAdmin>
									<UploadPage />
								</RequireAdmin>
							}
						/>
					</Route>
				</Routes>
			</BrowserRouter>
		</AuthProvider>
	);
}
