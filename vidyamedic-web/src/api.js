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
  async loadDashboard(periodDays = 30) {
    const safePeriodDays = [7, 30, 90].includes(periodDays) ? periodDays : 30;
    const periodStart = new Date(Date.now() - safePeriodDays * 24 * 60 * 60 * 1000);
    const periodEnd = new Date();
    const historyRanges = [];
    let rangeStart = periodStart;
    while (rangeStart < periodEnd) {
      const rangeEnd = new Date(Math.min(
        rangeStart.getTime() + 30 * 24 * 60 * 60 * 1000,
        periodEnd.getTime(),
      ));
      historyRanges.push({
        from: rangeStart.toISOString(),
        to: rangeEnd.toISOString(),
      });
      rangeStart = new Date(rangeEnd.getTime() + 1);
    }
    const from = periodStart.toISOString();
    const to = periodEnd.toISOString();
    const [overview, profile, insights, history, checkIns, patientActions] = await Promise.allSettled([
      request('/patient-app/overview'),
      request('/patient-app/profile'),
      request('/patient-app/capar-insights'),
      Promise.all(historyRanges.map((range) => request(
        `/patient-app/wearable/history?from=${encodeURIComponent(
          range.from,
        )}&to=${encodeURIComponent(range.to)}&bucket_minutes=30`,
      ))),
      request(
        `/patient-app/check-ins?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=100`,
      ),
      request('/patient-app/actions?limit=100'),
    ]);
    const historyData = history.status === 'fulfilled'
      ? history.value.flatMap((result) => result.data || [])
      : [];
    return {
      overview: overview.status === 'fulfilled' ? overview.value.data : null,
      profile: profile.status === 'fulfilled' ? profile.value.data : null,
      insights: insights.status === 'fulfilled' ? insights.value.data : null,
      history: historyData,
      checkIns: checkIns.status === 'fulfilled' ? checkIns.value.data || [] : [],
      patientActions: patientActions.status === 'fulfilled' ? patientActions.value.data || [] : [],
      periodDays: safePeriodDays,
      errors: [overview, profile, insights, history, checkIns, patientActions]
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
  async createCheckIn(data) {
    return request('/patient-app/check-ins', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async createPatientAction(data) {
    return request('/patient-app/actions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async updatePatientActionStatus(actionId, status) {
    return request(`/patient-app/actions/${encodeURIComponent(actionId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
};
