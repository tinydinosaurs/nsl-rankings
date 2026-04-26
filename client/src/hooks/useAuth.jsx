import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // TOKEN STORAGE NOTE:
  // The JWT is stored in localStorage for simplicity. This is a known tradeoff —
  // localStorage is accessible to any JS on the page (XSS risk).
  // For this admin-only tool with no user-generated HTML content, the practical
  // risk is low. The correct long-term fix is httpOnly cookies, which requires
  // server-side cookie handling (Set-Cookie on login, cookie middleware on protected
  // routes). Acceptable for MVP; revisit before any public expansion.
  const [user, setUser] = useState(() => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;

      // Decode JWT payload to check expiry and derive user state.
      // atob can throw on malformed tokens — caught by the outer try/catch.
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return null;
      }

      return { id: payload.id, username: payload.username, role: payload.role };
    } catch {
      return null;
    }
  });

  const login = useCallback(async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('token', data.token);
    // Derive user state from the token payload rather than the response body
    // so the stored token is the single source of truth.
    const payload = JSON.parse(atob(data.token.split('.')[1]));
    const loggedInUser = { id: payload.id, username: payload.username, role: payload.role };
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  // Schedule automatic logout exactly when the token expires.
  // Cleans up and reschedules whenever user changes (login/logout).
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const msUntilExpiry = payload.exp * 1000 - Date.now();
      if (msUntilExpiry <= 0) return;
      const timer = setTimeout(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        window.location.href = '/login';
      }, msUntilExpiry);
      return () => clearTimeout(timer);
    } catch {
      // Malformed token — the 401 interceptor will handle it on the next request.
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      isAdmin: user?.role === 'admin' || user?.role === 'owner' 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
