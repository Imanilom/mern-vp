/**
 * capar.prediction.controller.js — CAPAR Section 10
 *
 * Future-State Prediction menggunakan:
 * 1. Personal transition matrix (dari StateTransition model)
 * 2. Recent score slope adjustment (trajectory-based)
 * 3. Recovery time estimate (dari riwayat AnomalyEvent)
 *
 * Endpoints:
 *   GET /api/analysis/forecast/:userId     — next-state probabilities + multi-step
 *   GET /api/analysis/recovery-estimate/:userId — recovery distribution
 *   GET /api/analysis/transitions/:userId  — transition matrix
 */

import { getTransitionMatrix, getAllTransitions } from '../utils/capar.transitions.js';
import { getRecoveryDistribution } from '../utils/capar.thresholds.js';
import Segment from '../models/segment.model.js';
import AnomalyEvent from '../models/anomalyevent.model.js';
import mongoose from 'mongoose';

const HORIZON_STEPS = 3; // Default horizon untuk multi-step forecast

// Mapping dari rr_status ke canonical CAPAR state
const STATUS_TO_STATE = {
  NORMAL:               'BASELINE_COMPATIBLE',
  PROVISIONAL_NORMAL:   'BASELINE_COMPATIBLE',
  DEVIATION_CANDIDATE:  'DEVIATION_CANDIDATE',
  PERSISTENT_DEVIATION: 'PERSISTENT_DEVIATION',
  RECOVERING:           'RECOVERY',
  RECOVERED:            'RECOVERED',
  INSUFFICIENT_BASELINE: 'UNKNOWN',
  QUALITY_WARNING:       'UNKNOWN',
  PROVISIONAL_DEVIATION: 'DEVIATION_CANDIDATE',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function round4(v) {
  return typeof v === 'number' && isFinite(v) ? parseFloat(v.toFixed(4)) : 0;
}

/**
 * Hitung slope dari array skor terbaru (Section 10.1 — beta).
 * beta = slope({S_{t-h+1},...,S_t}) via OLS.
 */
function computeRecentSlope(scores, h = 5) {
  const recent = scores.slice(-h);
  const n = recent.length;
  if (n < 2) return 0;

  const x = recent.map((_, i) => i);
  const sumX = x.reduce((s, v) => s + v, 0);
  const sumY = recent.reduce((s, v) => s + v, 0);
  const sumXY = x.reduce((s, v, i) => s + v * recent[i], 0);
  const sumX2 = x.reduce((s, v) => s + v * v, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-12) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

/**
 * Adjustments probabilistik berdasarkan trajectory slope (Section 10.1).
 *
 * Slope negatif saat PERSISTENT_DEVIATION → lebih mungkin transisi ke RECOVERY.
 * Slope positif saat RECOVERY → lebih mungkin rebound ke PERSISTENT_DEVIATION.
 * Score sangat rendah (< tau_normal) saat RECOVERY → lebih mungkin RECOVERED.
 */
function trajectoryAdjust(probs, beta, currentState, recentScore, tau) {
  const tau_in     = tau?.tau_in     || 1.5;
  const tau_normal = tau?.tau_normal || 0.7;
  const adj = { ...probs };

  const SLOPE_SENSITIVITY = 0.1; // Dampak slope per unit

  if (currentState === 'PERSISTENT_DEVIATION') {
    // Slope negatif → meningkatkan prob RECOVERY
    if (beta < 0 && adj.RECOVERY !== undefined) {
      const boost = Math.min(Math.abs(beta) * SLOPE_SENSITIVITY, 0.15);
      adj.RECOVERY = Math.min(1, (adj.RECOVERY || 0) + boost);
      adj.PERSISTENT_DEVIATION = Math.max(0, (adj.PERSISTENT_DEVIATION || 0) - boost);
    }
  } else if (currentState === 'RECOVERY') {
    if (beta > 0 && recentScore >= tau_in && adj.PERSISTENT_DEVIATION !== undefined) {
      // Rebound — meningkatkan prob PERSISTENT_DEVIATION
      const boost = Math.min(beta * SLOPE_SENSITIVITY, 0.15);
      adj.PERSISTENT_DEVIATION = Math.min(1, (adj.PERSISTENT_DEVIATION || 0) + boost);
      adj.RECOVERED = Math.max(0, (adj.RECOVERED || 0) - boost);
    }
    if (recentScore < tau_normal && adj.RECOVERED !== undefined) {
      // Score sangat rendah — meningkatkan prob RECOVERED
      const boost = 0.1;
      adj.RECOVERED = Math.min(1, (adj.RECOVERED || 0) + boost);
      adj.RECOVERY = Math.max(0, (adj.RECOVERY || 0) - boost);
    }
  }

  // Normalisasi agar tetap sum = 1
  const total = Object.values(adj).reduce((s, v) => s + Math.max(v, 0), 0);
  if (total > 0) {
    for (const k of Object.keys(adj)) adj[k] = round4(adj[k] / total);
  }
  return adj;
}

/**
 * Hitung p_next menggunakan matriks transisi.
 * Jika matrix null, gunakan prior uniform atas allowed transitions.
 */
function computeNextStateProbs(currentState, matrix, allowedTransitions) {
  if (matrix && matrix[currentState]) {
    return { ...matrix[currentState] };
  }
  // Prior uniform
  const allowed = allowedTransitions[currentState] || [currentState];
  const prior = {};
  for (const s of allowed) prior[s] = round4(1 / allowed.length);
  return prior;
}

/**
 * Hitung multi-step forecast p_(t+h) = p_t × A^h (Section 10.2).
 * Menggunakan iterasi sederhana (bukan matrix power eksplisit).
 */
function multiStepForecast(initialProbs, matrix, horizon, allowedTransitions) {
  const states = Object.keys(allowedTransitions);
  let current = { ...initialProbs };

  const steps = [];
  for (let h = 1; h <= horizon; h++) {
    const next = {};
    for (const toState of states) {
      let prob = 0;
      for (const fromState of states) {
        const fromProb = current[fromState] || 0;
        const transProb = (matrix?.[fromState]?.[toState]) || 0;
        prob += fromProb * transProb;
      }
      if (prob > 0) next[toState] = round4(prob);
    }
    // Normalisasi
    const total = Object.values(next).reduce((s, v) => s + v, 0);
    if (total > 0) {
      for (const k of Object.keys(next)) next[k] = round4(next[k] / total);
    }
    steps.push({ step: h, probabilities: next, most_likely: mostLikely(next) });
    current = next;
  }
  return steps;
}

function mostLikely(probs) {
  return Object.entries(probs).sort(([, a], [, b]) => b - a)[0]?.[0] || 'UNKNOWN';
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * GET /api/analysis/forecast/:userId
 *
 * Kembalikan:
 *  - current_state       — rr_status terakhir
 *  - next_state_probs    — probabilitas state berikutnya (one-step)
 *  - horizon_forecast    — multi-step forecast (default 3 langkah)
 *  - recovery_estimate   — waktu recovery yang diestimasikan
 *  - slope               — recent score slope (beta)
 */
export async function getNextStateForecast(req, res) {
  try {
    const userId = req.params.userId;
    const horizonSteps = parseInt(req.query.horizon) || HORIZON_STEPS;

    const objId = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : null;

    // 1. Ambil rr_status terbaru
    const latestSeg = await Segment.findOne(
      { user_id: objId, analyzed: true, rr_status: { $exists: true, $ne: null } },
      { rr_status: 1, anomaly_score: 1, activity_label: 1 }
    ).sort({ window_start: -1 }).lean();

    const currentRrStatus = latestSeg?.rr_status || 'UNKNOWN';
    const currentState    = STATUS_TO_STATE[currentRrStatus] || 'UNKNOWN';
    const activity        = latestSeg?.activity_label || 'Unknown';

    // 2. Ambil recent scores untuk slope
    const recentSegs = await Segment.find(
      { user_id: objId, analyzed: true, anomaly_score: { $ne: null }, rr_status: { $exists: true } },
      { anomaly_score: 1 }
    ).sort({ window_start: -1 }).limit(10).lean();

    const recentScores = recentSegs.map(s => s.anomaly_score).reverse();
    const beta = computeRecentSlope(recentScores);

    // 3. Ambil matriks transisi personal
    const { matrix, total_transitions, source: matrixSource } = await getTransitionMatrix(userId, activity);

    // 4. Allowed transitions (untuk prior)
    const ALLOWED = {
      UNKNOWN:               ['BASELINE_COMPATIBLE'],
      BASELINE_COMPATIBLE:   ['BASELINE_COMPATIBLE', 'DEVIATION_CANDIDATE'],
      DEVIATION_CANDIDATE:   ['BASELINE_COMPATIBLE', 'PERSISTENT_DEVIATION', 'DEVIATION_CANDIDATE'],
      PERSISTENT_DEVIATION:  ['RECOVERY', 'PERSISTENT_DEVIATION', 'UNRESOLVED'],
      RECOVERY:              ['PERSISTENT_DEVIATION', 'RECOVERED', 'RECOVERY'],
      RECOVERED:             ['BASELINE_COMPATIBLE', 'RECOVERED'],
      UNRESOLVED:            ['BASELINE_COMPATIBLE'],
    };

    // 5. One-step prediction + trajectory adjustment
    let nextProbs = computeNextStateProbs(currentState, matrix, ALLOWED);
    nextProbs = trajectoryAdjust(nextProbs, beta, currentState, recentScores.at(-1) || 0, null);

    // 6. Multi-step forecast
    const horizonForecast = multiStepForecast(nextProbs, matrix, horizonSteps, ALLOWED);

    // 7. Recovery estimate
    const recoveryEst = await getRecoveryDistribution(userId, activity);

    return res.json({
      success: true,
      data: {
        user_id: userId,
        current_state: currentState,
        current_rr_status: currentRrStatus,
        activity,
        recent_score: recentScores.at(-1) || null,
        slope_beta: round4(beta),
        slope_direction: beta > 0.05 ? 'increasing' : beta < -0.05 ? 'decreasing' : 'stable',
        next_state_probabilities: nextProbs,
        most_likely_next: mostLikely(nextProbs),
        horizon_forecast: horizonForecast,
        recovery_estimate: recoveryEst,
        experience: {
          matrix_source: matrixSource,
          total_transitions,
        },
        computed_at: new Date().toISOString(),
        algorithm: 'CAPAR Section 10 — Future-State Prediction',
      },
    });
  } catch (err) {
    console.error('[getNextStateForecast] Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/analysis/recovery-estimate/:userId
 *
 * Kembalikan distribusi recovery time personal (Section 7.3).
 */
export async function getRecoveryEstimate(req, res) {
  try {
    const userId   = req.params.userId;
    const activity = req.query.activity || null;
    const dist     = await getRecoveryDistribution(userId, activity);

    if (!dist) {
      return res.json({ success: true, data: null, message: 'No recovery history' });
    }
    return res.json({ success: true, data: dist });
  } catch (err) {
    console.error('[getRecoveryEstimate] Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/analysis/transitions/:userId
 *
 * Kembalikan transition matrix personal beserta raw counts.
 */
export async function getPersonalTransitions(req, res) {
  try {
    const userId   = req.params.userId;
    const activity = req.query.activity || null;
    const { matrix, total_transitions, source } = await getTransitionMatrix(userId, activity);
    const raw      = await getAllTransitions(userId);

    return res.json({
      success: true,
      data: {
        user_id: userId,
        activity_filter: activity || 'all',
        transition_matrix: matrix,
        total_transitions,
        source,
        raw_counts: raw,
        algorithm: 'CAPAR Section 7.2 — Transition Learning (Dirichlet prior alpha=0.1)',
      },
    });
  } catch (err) {
    console.error('[getPersonalTransitions] Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}
