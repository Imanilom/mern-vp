const API_BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'vidyamedic_web_access_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem('access_token');
}

export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('access_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    const error = new Error(
      payload?.message || `Permintaan gagal (HTTP ${response.status}).`,
    );
    error.status = response.status;
    throw error;
  }
  return payload;
}

export const api = {
  async signin(email, password) {
    const result = await request('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (result.token) saveToken(result.token);
    return result;
  },
  async me() {
    const result = await request('/auth/me');
    return result.user || result;
  },
  async signout() {
    try {
      await request('/auth/signout');
    } finally {
      clearToken();
    }
  },
  async loadDashboard() {
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const to = new Date().toISOString();
    const [overview, profile, insights, history, checkIns] = await Promise.allSettled([
      request('/patient-app/overview'),
      request('/patient-app/profile'),
      request('/patient-app/capar-insights'),
      request(
        `/patient-app/wearable/history?from=${encodeURIComponent(
          from,
        )}&to=${encodeURIComponent(to)}&bucket_minutes=30`,
      ),
      request(
        `/patient-app/check-ins?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=100`,
      ),
    ]);
    return {
      overview: overview.status === 'fulfilled' ? overview.value.data : null,
      profile: profile.status === 'fulfilled' ? profile.value.data : null,
      insights: insights.status === 'fulfilled' ? insights.value.data : null,
      history: history.status === 'fulfilled' ? history.value.data || [] : [],
      checkIns: checkIns.status === 'fulfilled' ? checkIns.value.data || [] : [],
      errors: [overview, profile, insights, history, checkIns]
        .filter((item) => item.status === 'rejected')
        .map((item) => item.reason),
    };
  },
  async updateProfile(data) {
    return request('/patient-app/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};
