import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RankingsPage from './pages/RankingsPage.jsx';
import CompetitorPage from './pages/CompetitorPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import UploadPage from './pages/UploadPage.jsx';
import Layout from './components/shared/Layout.jsx';

function RequireAuth({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={<RankingsPage />} />
            <Route path="competitors/:id" element={<CompetitorPage />} />
            <Route path="admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
            <Route path="upload" element={<RequireAdmin><UploadPage /></RequireAdmin>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
