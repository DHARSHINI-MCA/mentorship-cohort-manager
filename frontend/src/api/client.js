import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
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
