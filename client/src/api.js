const BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export const api = {
  overview: () => request('/overview'),
  live: (since) => request(`/live${since ? `?since=${encodeURIComponent(since)}` : ''}`),
  planRoute: (from, to) =>
    request('/route', { method: 'POST', body: JSON.stringify({ from, to }) }),

  createReport: (data) =>
    request('/reports', { method: 'POST', body: JSON.stringify(data) }),
  confirmReport: (id) => request(`/reports/${id}/confirm`, { method: 'PATCH' }),
  verifyReport: (id) => request(`/reports/${id}/verify`, { method: 'PATCH' }),
  deleteReport: (id) => request(`/reports/${id}`, { method: 'DELETE' }),

  setRoadStatus: (id, payload) =>
    request(`/roads/${id}/status`, { method: 'PATCH', body: JSON.stringify(payload) }),

  simulateFlood: (payload) =>
    request('/simulate/flood', { method: 'POST', body: JSON.stringify(payload) }),
  setWeather: (rainfallMmHr) =>
    request('/simulate/weather', { method: 'POST', body: JSON.stringify({ rainfallMmHr }) }),
  resetDemo: () => request('/simulate/reset', { method: 'POST' }),
};