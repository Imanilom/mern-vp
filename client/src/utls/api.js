/**
 * api.js — Centralized API utility for Health Trajectory Web Dashboard.
 *
 * All API calls go through /api/* proxied to the backend Express server
 * at localhost:3030. Credentials (JWT cookie) are sent with every request.
 *
 * Exports:
 *   authApi   — Authentication (sign in, sign out)
 *   usersApi  — User and patient management
 *   analysisApi — Segments, events, baselines, metrics
 *   activityApi — Activity logs
 *   logApi    — Raw biosensor CSV upload
 *   dashboardApi — Aggregated summary helpers
 */

const BASE = '/api';

/** Shared fetch wrapper — always sends credentials (cookies) */
async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.message || msg; } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
}

// ── Authentication ────────────────────────────────────────────────────────────

export const authApi = {
  /** POST /api/auth/signin — returns user object on success */
  signIn: (email, password) =>
    req('/auth/signin', { method: 'POST', body: JSON.stringify({ email, password }) }),

  /** POST /api/auth/signout */
  signOut: () => req('/auth/signout', { method: 'POST' }),
};

// ── Users / Patients ──────────────────────────────────────────────────────────

export const usersApi = {
  /** GET /api/user/:id — get single user profile */
  getUser: (id) => req(`/user/${id}`),

  /** GET /api/patient/all — list all patients for the logged-in doctor */
  getAllPatients: () => req('/patient/all'),

  /** GET /api/patient/add/pasient?p=<page> — unassigned patients */
  getNonePatient: (page = 0) => req(`/patient/add/pasient?p=${page}`),
};

// ── Analysis — Segments, Events, Baselines ────────────────────────────────────

export const analysisApi = {
  /**
   * GET /api/analysis/segments/:userId?limit=<n>
   * Returns N latest analyzed segments with HR, score, classification, z_scores.
   */
  getSegments: (userId, limit = 100) =>
    req(`/analysis/segments/${userId}?limit=${limit}`),

  /**
   * GET /api/analysis/events/:userId?limit=<n>
   * Returns N latest anomaly events (onset_time, peak_score, classification, trajectory).
   */
  getEvents: (userId, limit = 20) =>
    req(`/analysis/events/${userId}?limit=${limit}`),

  /**
   * GET /api/analysis/events/details/:eventId
   * Fetches full event details including all associated segments for precise plotting.
   */
  getEventSegments: (eventId) =>
    req(`/analysis/events/details/${eventId}`),

  /**
   * POST /api/analysis/events/:eventId/annotate
   * Adds an annotation at a specific timestamp.
   */
  annotateEvent: (eventId, text, timestamp) =>
    req(`/analysis/events/${eventId}/annotate`, {
      method: 'POST',
      body: JSON.stringify({ text, timestamp }),
    }),

  /** Clinical Review Workflow */
  updateEventStatus: (eventId, status) =>
    req(`/analysis/events/${eventId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  validateEvent: (eventId, label, notes) =>
    req(`/analysis/events/${eventId}/validate`, {
      method: 'PATCH',
      body: JSON.stringify({ label, notes }),
    }),

  escalateEvent: (eventId, escalated) =>
    req(`/analysis/events/${eventId}/escalate`, {
      method: 'PATCH',
      body: JSON.stringify({ escalated }),
    }),

  assignReviewer: (eventId) =>
    req(`/analysis/events/${eventId}/assign`, {
      method: 'PATCH',
    }),

  /**
   * GET /api/analysis/reports
   * Generates complex reports.
   */
  generateReport: (params) => {
    const query = new URLSearchParams();
    Object.keys(params).forEach(k => {
      if (params[k]) query.append(k, params[k]);
    });
    return req(`/analysis/reports?${query.toString()}`);
  },

  /**
   * GET /api/analysis/baseline/:userId
   * Returns all baseline models for a user (one per activity + time_period).
   */
  getBaselines: (userId) => req(`/analysis/baseline/${userId}`),

  /**
   * GET /api/analysis/metrics/:userId
   * Full evaluation metrics: Precision, Recall, F1, AUC, Detection Delay, etc.
   */
  getMetrics: (userId) => req(`/analysis/metrics/${userId}`),

  /**
   * PATCH /api/analysis/events/:eventId/label
   * Set actual_onset_time for detection delay evaluation.
   */
  labelEvent: (eventId, actual_onset_time) =>
    req(`/analysis/events/${eventId}/label`, {
      method: 'PATCH',
      body: JSON.stringify({ actual_onset_time }),
    }),

  /**
   * PATCH /api/analysis/segments/:segmentId/label
   * Set ground_truth_label ('anomaly' | 'normal') for precision/recall evaluation.
   */
  labelSegment: (segmentId, label) =>
    req(`/analysis/segments/${segmentId}/label`, {
      method: 'PATCH',
      body: JSON.stringify({ label }),
    }),

  /** PATCH /api/analysis/baseline/:baselineId/freeze */
  freezeBaseline: (baselineId, isFrozen) =>
    req(`/analysis/baseline/${baselineId}/freeze`, {
      method: 'PATCH',
      body: JSON.stringify({ is_frozen: isFrozen }),
    }),

  /** PATCH /api/analysis/baseline/:baselineId/approve */
  approveBaseline: (baselineId) =>
    req(`/analysis/baseline/${baselineId}/approve`, {
      method: 'PATCH',
    }),

  /** POST /api/analysis/baseline/:baselineId/recalculate */
  recalculateBaseline: (baselineId) =>
    req(`/analysis/baseline/${baselineId}/recalculate`, {
      method: 'POST',
    }),
};

// ── Activity ──────────────────────────────────────────────────────────────────

export const activityApi = {
  /** GET /api/activity/getActivity — activity labels for the current user */
  getMyActivities: () => req('/activity/getActivity'),

  /** GET /api/activity/getActivity/:patientId — activities for a specific patient */
  getPatientActivities: (patientId) => req(`/activity/getActivity/${patientId}`),
};

// ── Raw Log / CSV Upload ──────────────────────────────────────────────────────

export const logApi = {
  /**
   * POST /api/log/logs — multipart CSV upload.
   * @param {File} file — the CSV file object from an input[type=file]
   */
  uploadCsv: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch(`${BASE}/log/logs`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    }).then((r) => r.json());
  },
};

// ── Dashboard Aggregation Helpers ─────────────────────────────────────────────

export const dashboardApi = {
  /**
   * Fetch all patients, their latest segment, and open events in one go.
   * Calls getAllPatients + for each patient getSegments + getEvents (1 each).
   * Returns an array of { user, latestSegment, openEvents, latestBaselines }.
   */
  async getParticipantSummaries() {
    const patients = await usersApi.getAllPatients();
    const summaries = await Promise.allSettled(
      patients.map(async (p) => {
        const [segRes, evtRes, blRes] = await Promise.allSettled([
          analysisApi.getSegments(p._id, 1),
          analysisApi.getEvents(p._id, 5),
          analysisApi.getBaselines(p._id),
        ]);
        return {
          user: p,
          latestSegment: segRes.status === 'fulfilled' ? segRes.value?.data?.[0] : null,
          openEvents: evtRes.status === 'fulfilled'
            ? (evtRes.value?.data || []).filter((e) => e.status === 'open')
            : [],
          baselines: blRes.status === 'fulfilled' ? blRes.value?.data || [] : [],
        };
      })
    );
    return summaries.filter((s) => s.status === 'fulfilled').map((s) => s.value);
  },

  /**
   * For overview dashboard — fetch recent events across all patients.
   * Needs a specific userId (e.g., doctor calling their own events), or
   * pass a known participant ID for targeted overview.
   */
  getRecentEvents: (userId, limit = 10) => analysisApi.getEvents(userId, limit),
};

// ── Pipeline Monitor ─────────────────────────────────────────────────────────────────

export const pipelineApi = {
  /** GET /api/pipeline/status */
  getStatus: () => req('/pipeline/status'),

  /** GET /api/pipeline/nodes */
  getNodes: () => req('/pipeline/nodes'),

  /** DELETE /api/pipeline/queue/:name/purge */
  purgeQueue: (name) => req(`/pipeline/queue/${encodeURIComponent(name)}/purge`, { method: 'DELETE' }),

  /** POST /api/pipeline/queue/:name/pause */
  pauseQueue: (name) => req(`/pipeline/queue/${encodeURIComponent(name)}/pause`, { method: 'POST' }),

  /** POST /api/pipeline/queue/:name/messages */
  peekMessages: (name, count = 10) =>
    req(`/pipeline/queue/${encodeURIComponent(name)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ count }),
    }),
};

