import axios from 'axios';

const localHosts = new Set(['localhost', '127.0.0.1']);
const isLocalDevelopment = localHosts.has(window.location.hostname);
const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const apiBaseURL = configuredApiBaseUrl || (isLocalDevelopment
  ? '/api'
  : 'https://mentorship-cohort-manager-backend.onrender.com/api');

const api = axios.create({
  baseURL: apiBaseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('mcm_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Session and batch lists contain user-specific, fast-changing data. Avoid
    // stale browser/proxy 304 responses leaving Axios with an empty payload.
    const method = (config.method || 'get').toLowerCase();
    const url = config.url || '';
    if (method === 'get' && /\/(batches|sessions)(\/|\?|$)/i.test(url)) {
      config.params = { ...(config.params || {}), _fresh: Date.now() };
      config.headers['Cache-Control'] = 'no-cache, no-store, max-age=0';
      config.headers.Pragma = 'no-cache';
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('mcm_token');
      localStorage.removeItem('mcm_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
