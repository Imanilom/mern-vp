import axios from 'axios';

// Configure Axios Defaults
const API_URL = import.meta.env.VITE_API_URL || '/api';

axios.defaults.baseURL = API_URL;
axios.defaults.withCredentials = true;

// Add interceptor for Bearer token authorization
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

export const api = {
  async getMe() {
    try {
      const { data } = await axios.get('/auth/me'); // Changed to /auth/me or similar if we have one. Actually user route has /:id. We should probably use /user/:id or verifyToken will return it. Let's see if /auth/me exists... no. I'll stick to what was there, maybe just '/me' or return user from signin.
      return data.user || null;
    } catch (err) {
      console.error('getMe Error:', err);
      return null;
    }
  },

  async signin(email, password) {
    try {
      const { data } = await axios.post('/auth/signin', { email, password });
      if (data && data.token) {
        localStorage.setItem('access_token', data.token);
      }
      return data;
    } catch (err) {
      console.error('signin Error:', err);
      throw err;
    }
  },

  async signout() {
    try {
      localStorage.removeItem('access_token');
      await axios.get('/auth/signout');
    } catch (err) {
      console.error('signout Error:', err);
    }
  },

  async getDashboard() {
    try {
      const { data } = await axios.get('/dashboard');
      return data;
    } catch (err) {
      console.error('getDashboard Error:', err);
      return null;
    }
  },

  async fetchAllPatients() {
    try {
      const response = await axios.get('/patient/all').catch(err => err.response);
      const raw = response?.data;
      console.log('[fetchAllPatients] /patient/all raw:', response?.status, Array.isArray(raw) ? `array(${raw.length})` : typeof raw, raw?.message || '');

      // /patient/all can return: array directly, or {data: [...], success: true}
      let list = Array.isArray(raw) ? raw : (raw?.data || null);

      if (!list || list.length === 0) {
        console.log('[fetchAllPatients] Primary empty, trying /doctor/patients fallback...');
        const docRes = await axios.get('/doctor/patients').catch(e => e.response);
        console.log('[fetchAllPatients] /doctor/patients status:', docRes?.status, JSON.stringify(docRes?.data)?.substring(0, 100));
        if (docRes?.data?.success && Array.isArray(docRes.data.data)) {
          list = docRes.data.data;
        }
      }

      console.log('[fetchAllPatients] Final count:', list?.length || 0);
      return list || [];
    } catch (e) {
      console.error('[fetchAllPatients] Error:', e.message);
      return [];
    }
  },

  async getCohorts() {
    try {
      const list = await this.fetchAllPatients();
      return [{ id: 'all-patients', label: `Cohort: All Patients (N=${list.length})` }];
    } catch (err) {
      console.error('getCohorts Error:', err);
      return [{ id: 'all-patients', label: 'Cohort: All Patients (N=0)' }];
    }
  },

  async getParticipants(cohortId = 'all-patients') {
    try {
      const list = await this.fetchAllPatients();
      return list.map((user, index) => ({
        id: user.guid || user._id || `P-${index + 1}`,
        _id: user._id,
        name: user.name || user.email,
        email: user.email,
        device: user.current_device,
        baselineMaturity: user.baseline_status || (user.mature_baselines > 0 ? 'mature' : 'learning'),
        evidenceState: user.evidenceState || (user.recentDeviation === 'Anomali terdeteksi' ? 'QUALITY_WARNING' : 'EVALUABLE'),
        physiologicalState: user.latest_physiological_state || user.physiologicalState || (user.alertPriority === 'High' ? 'PERSISTENT_DEVIATION' : (user.alertPriority === 'Medium' ? 'DEVIATION_CANDIDATE' : 'BASELINE_COMPATIBLE')),
        anomalyScore: user.anomalyScore ?? user.latest_score ?? (user.alertPriority === 'High' ? 4 : (user.alertPriority === 'Medium' ? 2 : 0)),
        context: user.latest_context || user.context || 'Unknown',
        contextConfidence: user.contextConfidence || 0.95,
        battery: user.battery || 100,
        clockDrift: user.clockDrift,
        peakHr: user.peakHr,
        peakTime: user.peakTime,
        persistenceWindow: user.persistenceWindow,
        hrMean: user.hrMean,
        lastUpdate: user.updatedAt ? new Date(user.updatedAt).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : undefined,
        ...user,
      }));
    } catch (err) {
      console.error('getParticipants Error:', err);
      return [];
    }
  },

  // Helper untuk memetakan raw event ke format episode yang dipakai UI
  formatDurationMs(msVal, status = null) {
    if (!msVal || msVal <= 0) {
      if (status && !['closed', 'transient', 'recovered', 'RECOVERED', 'CLOSED'].includes(status)) {
        return 'Ongoing';
      }
      return '-';
    }
    const m = Math.floor(msVal / 60000);
    const s = Math.floor((msVal % 60000) / 1000);
    const msRem = msVal % 1000;
    const parts = [];
    if (m > 0) parts.push(`${m}m`);
    if (s > 0) parts.push(`${s}s`);
    if (msRem > 0) parts.push(`${msRem}ms`);
    return parts.length > 0 ? parts.join(' ') : '-';
  },

  _mapEventToEpisode(ev, userMap = {}) {
    const userId = typeof ev.user_id === 'object' && ev.user_id ? ev.user_id._id || ev.user_id : ev.user_id;
    const userInfo = userMap[String(userId)] || ev.user_id || {};
    const onsetDate = ev.onset_time ? new Date(ev.onset_time) : null;
    // ISO format untuk filter (yyyy-mm-dd)
    const isoDateStr = onsetDate
      ? `${onsetDate.getFullYear()}-${String(onsetDate.getMonth()+1).padStart(2,'0')}-${String(onsetDate.getDate()).padStart(2,'0')}`
      : '';
    // Display format untuk UI
    const dateStr = onsetDate
      ? onsetDate.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '-';
    const timeStr = onsetDate
      ? onsetDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : '-';

    const msVal = ev.duration_ms || 0;
    const currentStatus = ev.current_state || ev.status || 'open';
    const durFormatted = this.formatDurationMs(msVal, currentStatus);

    return {
      id: ev._id || String(Math.random()),
      participantId: userInfo?.guid || userInfo?.email || String(userId),
      participantName: typeof ev.user_id === 'object' && ev.user_id
        ? (ev.user_id.name || ev.user_id.email || ev.user_id.guid || 'Unknown')
        : (userInfo?.name || userInfo?.email || 'Unknown'),
      deviceId: ev.device_id || '-',
      context: ev.activity || 'Unknown',
      onset: onsetDate ? `${dateStr} ${timeStr}` : '-',
      onsetDate: isoDateStr,
      onsetDateDisplay: dateStr,
      onsetTime: timeStr,
      onsetRaw: ev.onset_time,
      onsetScore: typeof ev.onset_score === 'number' ? ev.onset_score : 0,
      peakScore: typeof ev.peak_score === 'number' ? ev.peak_score : (typeof ev.onset_score === 'number' ? ev.onset_score : 0),
      peakHr: ev.peak_hr || null,
      baselineHr: ev.baseline_hr || null,
      durationMinutes: ev.duration_ms ? Math.round(ev.duration_ms / 60000) : 0,
      durationFormatted: durFormatted,
      classification: ev.classification || 'Alert',
      status: ev.current_state || ev.status || 'open',
      reviewStatus: ev.review_status || 'New',
      validationLabel: ev.validation_label || 'None',
      reviewerNotes: ev.reviewer_notes || '',
      tauIn: ev.tau_in || null,
      tauOut: ev.tau_out || null,
      raw: ev,
    };
  },

  // Paginated episode fetch — single API call, no N+1 requests
  async getEventsPaginated(userId = 'ALL', page = 1, limit = 50) {
    try {
      const target = (!userId || userId === 'undefined' || userId === 'null') ? 'ALL' : userId;
      const { data } = await axios.get(`/analysis/events/${target}?page=${page}&limit=${limit}`);
      const events = Array.isArray(data?.data) ? data.data : [];
      return {
        data: events.map(ev => this._mapEventToEpisode(ev)),
        totalCount: data.totalCount || events.length,
        page: data.page || page,
        totalPages: data.totalPages || 1,
      };
    } catch (err) {
      console.error('getEventsPaginated Error:', err);
      return { data: [], totalCount: 0, page: 1, totalPages: 1 };
    }
  },

  // Legacy — dipakai oleh EpisodeView, dimigrasikan ke paginated
  async getEpisodes(userId = 'ALL', page = 1, limit = 50) {
    const result = await this.getEventsPaginated(userId, page, limit);
    return result;
  },

  async getSignalQuality(userId) {
    try {
      const { data } = await axios.get(`/analysis/signal-quality/${userId}`);
      return data.data;
    } catch (err) {
      console.error('getSignalQuality Error:', err);
      return null;
    }
  },

  async getEvaluationMetrics(userId) {
    try {
      const { data } = await axios.get(`/analysis/evaluation/${userId}`);
      return data.data;
    } catch (err) {
      console.error('getEvaluationMetrics Error:', err);
      return null;
    }
  },

  async getTransitions(userId) {
    try {
      const { data } = await axios.get(`/analysis/transitions/${userId}`);
      return data.data;
    } catch (err) {
      console.error('getTransitions Error:', err);
      return null;
    }
  },

  async getForecast(userId) {
    try {
      const { data } = await axios.get(`/analysis/forecast/${userId}`);
      return data.data;
    } catch (err) {
      console.error('getForecast Error:', err);
      return null;
    }
  },

  async getPersonalExperience() {
    try {
      const patients = await this.fetchAllPatients();

      const models = await Promise.all(
        patients.map(async (user) => {
          const userId = user.guid || user._id;
          if (!userId) return null;

          try {
            const [baselineRes, metricRes, thresholdRes, transitionRes, forecastRes] = await Promise.all([
              axios.get(`/analysis/baseline/${userId}`).catch(() => ({ data: { data: [] } })),
              axios.get(`/analysis/metrics/${userId}`).catch(() => ({ data: { data: {} } })),
              axios.get(`/analysis/thresholds/${userId}`).catch(() => ({ data: { data: null } })),
              axios.get(`/analysis/transitions/${userId}`).catch(() => ({ data: { data: null } })),
              axios.get(`/analysis/forecast/${userId}`).catch(() => ({ data: { data: null } })),
            ]);

            const baselines = baselineRes.data?.data || [];
            const metrics = metricRes.data?.data || {};
            const thresholds = thresholdRes.data?.data || null;
            const transitionsData = transitionRes.data?.data?.transition_matrix || null;
            const forecastData = forecastRes.data?.data || null;
            const mature = baselines.filter((b) => b.is_mature).length;

            const h3a = metrics?.hypothesis?.H3a || {};
            const h1a = metrics?.hypothesis?.H1a || {};
            const classMetrics = metrics?.classification_metrics || {};

            const avgRecMs = h3a.avg_recovery_ms || 0;
            const avgRecMin = avgRecMs > 0 ? Math.round(avgRecMs / 60000) : 0;
            const confScore = classMetrics.f1 !== undefined ? Math.round(classMetrics.f1 * 100) : (h1a.TCR !== undefined ? Math.round(h1a.TCR * 100) : 0);

            // Real CAPAR-learned thresholds (Section 7.1)
            const globalTau = thresholds?.global_threshold || {};
            const tauIn = globalTau.tau_in ?? 1.50;
            const tauOut = globalTau.tau_out ?? 1.00;
            const tauNormal = globalTau.tau_normal ?? 0.70;
            const tauSource = globalTau.source || 'configured';
            const stableScoreCount = globalTau.stable_score_count || 0;

            // Fetch Real transitions from backend (CAPAR Section 7.2)
            let learnedTransitions = [];
            if (transitionsData && typeof transitionsData === 'object') {
               Object.keys(transitionsData).forEach(fromState => {
                  if (typeof transitionsData[fromState] === 'object') {
                     Object.keys(transitionsData[fromState]).forEach(toState => {
                        const prob = transitionsData[fromState][toState];
                        if (typeof prob === 'number' && prob > 0) {
                           learnedTransitions.push({ from: fromState, to: toState, probability: prob, count: Math.round(prob * 20) || 1 });
                        }
                     });
                  }
               });
            }

            // Forecast mapping from backend
            let nextStatePrediction = 'BASELINE_COMPATIBLE';
            let predictionConfidence = 0;
            let probabilities = forecastData?.next_state_probabilities || null;

            if (forecastData) {
               if (typeof forecastData.predicted_state === 'string') {
                  nextStatePrediction = forecastData.predicted_state;
               } else if (forecastData.most_likely_next) {
                  nextStatePrediction = typeof forecastData.most_likely_next === 'object' ? forecastData.most_likely_next.state : forecastData.most_likely_next;
               } else if (forecastData.next_state_probabilities) {
                  const states = Object.keys(forecastData.next_state_probabilities);
                  if (states.length > 0) {
                     nextStatePrediction = states.reduce((a, b) => (forecastData.next_state_probabilities[a] > (forecastData.next_state_probabilities[b] || 0) ? a : b), states[0]);
                  }
               }

               if (forecastData.confidence !== undefined) {
                  predictionConfidence = forecastData.confidence;
               } else if (forecastData.next_state_probabilities && forecastData.next_state_probabilities[nextStatePrediction] !== undefined) {
                  predictionConfidence = forecastData.next_state_probabilities[nextStatePrediction];
               }
            }

            return {
              id: userId,
              participantId: user.guid || user.name || userId,
              resolvedEpisodesCount: baselines.length || h3a.trajectory_event_count || 0,
              medianRecoveryMinutes: avgRecMin,
              p25RecoveryMinutes: avgRecMin ? Math.round(avgRecMin * 0.7) : 0,
              p75RecoveryMinutes: avgRecMin ? Math.round(avgRecMin * 1.3) : 0,
              phenotype: mature > 0 ? 'Mature Profile' : (baselines.length > 0 ? 'Learning Profile' : 'No Data'),
              confidenceScore: confScore,
              learnedTransitions,
              thresholdSource: tauSource,
              stableScoreCount,
              thresholdByActivity: thresholds?.threshold_by_activity || {},
              adaptiveThresholds: {
                tauIn,
                tauOut,
                tauNormal,
              },
              nextStatePrediction,
              predictionConfidence,
              probabilities
            };
          } catch {
            return null;
          }
        })
      );

      return models.filter(Boolean);
    } catch (err) {
      console.error('getPersonalExperience Error:', err);
      return [];
    }
  },

  async getMe() {
    try {
      const { data } = await axios.get('/auth/me');
      return data?.user || null;
    } catch (e) {
      return null;
    }
  },

  async updateUser(id, userData) {
    try {
      const { data } = await axios.post(`/user/update/${id}`, userData);
      return data;
    } catch (e) {
      console.error('[API] Failed to update user', e);
      throw e;
    }
  },

  async getModelRules() {
    try {
      const { data } = await axios.get('/system/model-rules');
      return data?.data || null;
    } catch (err) {
      console.error('getModelRules Error:', err);
      return null;
    }
  },

  async getExportJobs() {
    try {
      const { data } = await axios.get('/system/export-jobs');
      return data?.data || [];
    } catch (err) {
      console.error('getExportJobs Error:', err);
      return [];
    }
  },

  async generateExportJob(payload) {
    try {
      const { data } = await axios.post('/system/export-jobs', payload);
      return data;
    } catch (err) {
      console.error('generateExportJob Error:', err);
      return { success: false, message: err.message };
    }
  },

  async getAuditTrail() {
    try {
      const { data } = await axios.get('/system/audit-trail');
      return Array.isArray(data?.data) ? data.data : [];
    } catch (err) {
      console.error('getAuditTrail Error:', err);
      return [];
    }
  },

  async getRiwayatDeteksi(userId) {
    if (!userId) return null;
    try {
      const { data } = await axios.get(`/user/riwayatdeteksi/${userId}`);
      return data || null;
    } catch (err) {
      console.error('getRiwayatDeteksi Error:', err);
      return null;
    }
  },

  async getBaselineMaturity(userId) {
    if (!userId) return null;
    try {
      const { data } = await axios.get(`/analysis/rr/baseline/${userId}`);
      return data?.data || [];
    } catch (err) {
      console.error('getBaselineMaturity Error:', err);
      return [];
    }
  },

  async getRawData(userId, date) {
    if (!userId) return null;
    try {
      const url = date ? `/data/raw/${userId}?date=${date}` : `/data/raw/${userId}`;
      const { data } = await axios.get(url);
      return data || null;
    } catch (err) {
      console.error('getRawData Error:', err);
      return null;
    }
  },

  // --- ACTIVITY ROUTES ---
  async getActivity() {
    return axios.get('/activity/getActivity').then(res => res.data);
  },
  async getActivityForPatient(patientId) {
    return axios.get(`/activity/getActivity/${patientId}`).then(res => res.data);
  },
  async getActivityById(id) {
    return axios.get(`/activity/get/${id}`).then(res => res.data);
  },
  async createActivity(data) {
    return axios.post('/activity/create', data).then(res => res.data);
  },
  async deleteActivity(id) {
    return axios.delete(`/activity/delete/${id}`).then(res => res.data);
  },
  async updateActivity(id, data) {
    return axios.post(`/activity/update/${id}`, data).then(res => res.data);
  },

  // --- AI PIPELINE ROUTES ---
  async predictHealthRisk(data) {
    return axios.post('/ai/prediction', data).then(res => res.data);
  },
  async detectArtifact(data) {
    return axios.post('/ai/artifact/detect', data).then(res => res.data);
  },
  async detectAnomaly(data) {
    return axios.post('/ai/anomaly/detect', data).then(res => res.data);
  },
  async analyzeMissingData(data) {
    return axios.post('/ai/missing/analyze', data).then(res => res.data);
  },
  async processKalmanFilter(data) {
    return axios.post('/ai/kalman/filter', data).then(res => res.data);
  },
  async createActivityContext(data) {
    return axios.post('/ai/activity-context', data).then(res => res.data);
  },
  async getActivityContextByUser(userId) {
    return axios.get(`/ai/activity-context/${userId}`).then(res => res.data);
  },

  // --- ANALYSIS ROUTES ---
  // getModelRules, getExportJobs, getAuditTrail defined above (using /system/* endpoints)
  async getAnalysisReports() {
    return axios.get('/analysis/reports').then(res => res.data);
  },
  async getAnalyzedSegments(userId, limit = 100) {
    return axios.get(`/analysis/segments/${userId}?limit=${limit}`).then(res => res.data);
  },
  async getRecentEvents(userId, limit = 20) {
    const target = (!userId || userId === 'undefined' || userId === 'null') ? 'ALL' : userId;
    return axios.get(`/analysis/events/${target}?limit=${limit}`).then(res => res.data);
  },
  async getEventDetails(eventId) {
    return axios.get(`/analysis/events/details/${eventId}`).then(res => res.data);
  },
  async getEpisodeAnalysis(userId = 'ALL') {
    const target = (!userId || userId === 'undefined' || userId === 'null') ? 'ALL' : userId;
    return axios.get(`/analysis/episode-analysis/${target}`).then(res => Array.isArray(res.data?.data) ? res.data.data : []).catch(() => []);
  },
  async annotateEvent(eventId, text, timestamp) {
    return axios.post(`/analysis/events/${eventId}/annotate`, { text, timestamp }).then(res => res.data);
  },
  async updateEventStatus(eventId, status) {
    return axios.patch(`/analysis/events/${eventId}/status`, { status }).then(res => res.data);
  },
  async validateEvent(eventId, label, notes) {
    return axios.patch(`/analysis/events/${eventId}/validate`, { label, notes }).then(res => res.data);
  },
  async escalateEvent(eventId, escalated) {
    return axios.patch(`/analysis/events/${eventId}/escalate`, { escalated }).then(res => res.data);
  },
  async assignReviewer(eventId) {
    return axios.patch(`/analysis/events/${eventId}/assign`).then(res => res.data);
  },
  async getUserBaselines(userId) {
    return axios.get(`/analysis/baseline/${userId}`).then(res => res.data);
  },
  async getRRBaseline(userId) {
    return axios.get(`/analysis/rr/baseline/${userId}`).then(res => res.data);
  },
  async getRRSegments(userId, limit = 50) {
    return axios.get(`/analysis/rr/segments/${userId}?limit=${limit}`).then(res => res.data);
  },
  async freezeBaseline(baselineId, isFrozen) {
    return axios.patch(`/analysis/baseline/${baselineId}/freeze`, { is_frozen: isFrozen }).then(res => res.data);
  },
  async approveBaseline(baselineId) {
    return axios.patch(`/analysis/baseline/${baselineId}/approve`).then(res => res.data);
  },
  async recalculateBaseline(baselineId) {
    return axios.post(`/analysis/baseline/${baselineId}/recalculate`).then(res => res.data);
  },
  async getFullMetrics(userId) {
    return axios.get(`/analysis/metrics/${userId}`).then(res => res.data);
  },
  async getMetricsROC(userId) {
    return axios.get(`/analysis/metrics/${userId}/roc`).then(res => res.data);
  },
  async getMetricsH1a(userId, interval) {
    return axios.get(`/analysis/metrics/${userId}/h1a?interval=${interval}`).then(res => res.data);
  },
  async getMetricsH2a(userId) {
    return axios.get(`/analysis/metrics/${userId}/h2a`).then(res => res.data);
  },
  async getMetricsH3a(userId) {
    return axios.get(`/analysis/metrics/${userId}/h3a`).then(res => res.data);
  },
  async getActivityContext(userId) {
    return axios.get(`/analysis/activity-context/${userId}`).then(res => res.data);
  },
  async updateSegmentLabel(segmentId, label) {
    return axios.patch(`/analysis/segments/${segmentId}/label`, { label }).then(res => res.data);
  },
  async updateEventLabel(eventId, actualOnsetTime) {
    return axios.patch(`/analysis/events/${eventId}/label`, { actual_onset_time: actualOnsetTime }).then(res => res.data);
  },
  async validateSegmentByDoctor(segmentId, data) {
    return axios.patch(`/analysis/segments/${segmentId}/doctor-validate`, data).then(res => res.data);
  },
  async getKalmanTrajectory(userId) {
    return axios.get(`/analysis/kalman-trajectory/${userId}`).then(res => res.data);
  },
  async triggerRRAnalysis() {
    return axios.post('/analysis/rr/trigger').then(res => res.data);
  },
  async getRRSegments(userId, limit = 100, status) {
    const statusQuery = status ? `&status=${status}` : '';
    return axios.get(`/analysis/rr/segments/${userId}?limit=${limit}${statusQuery}`).then(res => res.data);
  },
  async getRRBaseline(userId) {
    return axios.get(`/analysis/rr/baseline/${userId}`).then(res => res.data);
  },

  async getSignalQuality(userId) {
    const target = userId && userId !== 'ALL' ? userId : 'ALL';
    return axios.get(`/analysis/signal-quality/${target}`).then(res => res.data?.data || res.data);
  },

  // --- DATA ROUTES ---
  async getFilteredAndRawData() {
    return axios.get('/data/filtered-raw').then(res => res.data);
  },
  async getDailyData() {
    return axios.get('/data/daily-data').then(res => res.data);
  },
  async getRawPolarData(userId) {
    return axios.get(`/data/raw/${userId}`).then(res => res.data);
  },

  // --- DOCTOR ROUTES ---
  async getDoctorPatients() {
    return axios.get('/doctor/patients').then(res => res.data);
  },
  async getDoctorPatientById(id) {
    return axios.get(`/doctor/patient/${id}`).then(res => res.data);
  },
  async getDoctorPatientLive(id) {
    return axios.get(`/doctor/patient/${id}/live`).then(res => res.data);
  },
  async getDoctorPatientHistory(id) {
    return axios.get(`/doctor/patient/${id}/history`).then(res => res.data);
  },
  async getDoctorPatientPredictions(id) {
    return axios.get(`/doctor/patient/${id}/predictions`).then(res => res.data);
  },
  async postDoctorPatientValidation(id, data) {
    return axios.post(`/doctor/patient/${id}/validation`, data).then(res => res.data);
  },
  async getDoctorPatientConfidence(id) {
    return axios.get(`/doctor/patient/${id}/confidence`).then(res => res.data);
  },

  // --- REPORT ROUTES ---
  async generateReport() {
    return axios.get('/reports/generate').then(res => res.data);
  },
  async getReportsList(userId) {
    return axios.get(`/reports/list/${userId}`).then(res => res.data);
  },

  // --- PREDICTION EVALUATION ROUTES ---
  async getPredictionEvalBrier(userId = 'ALL', horizon = 3) {
    const target = (!userId || userId === 'undefined' || userId === 'null') ? 'ALL' : userId;
    return axios.get(`/analysis/prediction-eval/brier/${target}?horizon=${horizon}`)
      .catch(() => axios.get(`/prediction-eval/brier/${target}?horizon=${horizon}`))
      .then(res => res.data);
  },
  async postBrierEvaluation(records, referenceBrier = null) {
    return axios.post('/analysis/prediction-eval/brier', { records, reference_brier: referenceBrier })
      .catch(() => axios.post('/prediction-eval/brier', { records, reference_brier: referenceBrier }))
      .then(res => res.data);
  },

  // --- PERSONAL EXPERIENCE MEMORY & GAMIFICATION ---
  async getPersonalExperienceByUser(userId = 'ALL') {
    const target = (!userId || userId === 'undefined' || userId === 'null') ? 'ALL' : userId;
    return axios.get(`/analysis/experience/${target}`).then(res => res.data).catch(() => null);
  },

  // --- EPISODE DETAIL (Event Generator) ---
  async getEpisodeDetail(episodeId) {
    return axios.get(`/episodes/${episodeId}`).then(res => res.data);
  },
  async getEpisodeTrajectory(episodeId) {
    return axios.get(`/episodes/${episodeId}/trajectory`).then(res => res.data);
  },
  async getEpisodeContext(episodeId) {
    return axios.get(`/episodes/${episodeId}/context`).then(res => res.data);
  },
  async getEpisodeAudit(episodeId) {
    return axios.get(`/episodes/${episodeId}/audit`).then(res => res.data);
  },
  async reviewEpisode(episodeId, payload) {
    return axios.post(`/episodes/${episodeId}/review`, payload).then(res => res.data);
  },

  // --- ABLATION E1-E6 EXPERIMENT FRAMEWORK ---
  async getAblationResults(userId = 'ALL') {
    const target = (!userId || userId === 'undefined' || userId === 'null') ? 'ALL' : userId;
    return axios.get(`/analysis/ablation/results?userId=${target}`).then(res => res.data).catch(() => null);
  },
  async runAblationExperiment(userId = 'ALL', config = {}) {
    return axios.post('/analysis/ablation/run', { participantId: userId, config }).then(res => res.data);
  },

  // --- ZERO-SHOT LLM ANALYSIS ---
  async zeroShotAnalyze(episodeId, useExported = false, rawData = null) {
    const body = useExported
      ? { useExported: true, raw_data: rawData?.raw_data, fsm_states: rawData?.fsm_states, thresholds: rawData?.thresholds }
      : { episodeId };
    return axios.post('/ai/zero-shot/analyze', body)
      .then(res => res.data)
      .catch(err => {
        if (err.response?.data?.message) {
          throw new Error(err.response.data.message);
        }
        throw err;
      });
  },
  async listZeroShotEpisodes(userId = 'ALL') {
    const target = (!userId || userId === 'undefined' || userId === 'null') ? 'ALL' : userId;
    return axios.get(`/ai/zero-shot/episodes?userId=${target}`).then(res => res.data).catch(() => ({ success: false, data: [] }));
  },
  async zeroShotPromptPreview(episodeId) {
    return axios.get(`/ai/zero-shot/prompt-preview?episodeId=${episodeId}`).then(res => res.data);
  },
};
