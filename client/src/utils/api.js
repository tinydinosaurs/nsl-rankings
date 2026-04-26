import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      // Hard redirect — intentionally simple for an admin tool.
      // Tradeoff: loses React Router state (e.g. mid-flow pages).
      // Also fires on failed login attempts, which is harmless today
      // but could break ?redirect= flows if added in future.
      // Long-term: coordinate with useAuth context for a soft redirect.
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
