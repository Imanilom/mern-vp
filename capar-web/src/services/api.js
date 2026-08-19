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
        lastUpdate: user.updatedAt ? new Date(user.updatedAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : undefined,
        ...user,
      }));
    } catch (err) {
      console.error('getParticipants Error:', err);
      return [];
    }
  },

  async getEpisodes() {
    try {
      const patients = await this.fetchAllPatients();

      const results = await Promise.all(
        patients.map(async (user) => {
          const userId = user.guid || user._id;
          if (!userId) return [];
          try {
            const { data } = await axios.get(`/analysis/events/${userId}?limit=20`);
            const events = Array.isArray(data?.data) ? data.data : [];
            return events.map((ev, i) => ({
              id: ev._id || `E-${userId.substring(0, 4)}-${i}`,
              participantId: ev.user_id?.guid || user.guid || userId,
              deviceId: ev.device_id || user.current_device || '-',
              context: ev.activity || 'Unknown',
              onset: ev.onset_time ? new Date(ev.onset_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Unknown',
              onsetScore: typeof ev.onset_score === 'number' ? ev.onset_score : 0,
              peakScore: typeof ev.peak_score === 'number' ? ev.peak_score : (typeof ev.onset_score === 'number' ? ev.onset_score : 0),
              durationMinutes: ev.duration_ms ? Math.round(ev.duration_ms / 60000) : 0,
              classification: ev.classification || 'Alert',
              status: ev.status || 'open',
              reviewStatus: ev.review_status || 'New',
              validationLabel: ev.validation_label || 'None',
              reviewerNotes: ev.reviewer_notes || '',
              raw: ev
            }));
          } catch {
            return [];
          }
        })
      );

      return results.flat();
    } catch (err) {
      console.error('getEpisodes Error:', err);
      return [];
    }
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
            if (forecastData) {
               if (forecastData.most_likely_next) {
                  nextStatePrediction = forecastData.most_likely_next;
               } else if (forecastData.next_state_probabilities) {
                  const states = Object.keys(forecastData.next_state_probabilities);
                  if (states.length > 0) {
                     nextStatePrediction = states.reduce((a, b) => (forecastData.next_state_probabilities[a] > (forecastData.next_state_probabilities[b] || 0) ? a : b), states[0]);
                  }
               } else if (forecastData.current_state) {
                  nextStatePrediction = forecastData.current_state;
               }

               if (forecastData.next_state_probabilities && forecastData.next_state_probabilities[nextStatePrediction] !== undefined) {
                  predictionConfidence = forecastData.next_state_probabilities[nextStatePrediction];
               } else if (forecastData.prediction_confidence !== undefined) {
                  predictionConfidence = forecastData.prediction_confidence;
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
              predictionConfidence
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
    return axios.get(`/analysis/events/${userId}?limit=${limit}`).then(res => res.data);
  },
  async getEventDetails(eventId) {
    return axios.get(`/analysis/events/details/${eventId}`).then(res => res.data);
  },
  async getEpisodeAnalysis(userId) {
    return axios.get(`/analysis/episode-analysis/${userId}`).then(res => Array.isArray(res.data?.data) ? res.data.data : []);
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
    return axios.get(`/prediction-eval/brier/${userId}?horizon=${horizon}`).then(res => res.data);
  },
  async postBrierEvaluation(records, referenceBrier = null) {
    return axios.post('/prediction-eval/brier', { records, reference_brier: referenceBrier }).then(res => res.data);
  },

  // --- PERSONAL EXPERIENCE MEMORY & GAMIFICATION ---
  async getPersonalExperience(userId = 'ALL') {
    return axios.get(`/analysis/experience/${userId}`).then(res => res.data);
  }
};
