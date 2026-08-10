/**
 * capar.transitions.js — CAPAR Section 7.2
 *
 * Personal Experience Transition Learning.
 *
 * Menyimpan dan membaca transition counts N_(i,j,u,c).
 * Digunakan untuk membangun matriks transisi P(j|i,u,c)
 * yang diperlukan oleh prediction engine (Section 10).
 *
 * P(S_j | S_i, u, c) = (N_(i,j) + alpha_j) / (Σ_k N_(i,k) + Σ_k alpha_k)
 *
 * alpha = 0.1 (Dirichlet/Laplace smoothing, hanya untuk transisi yang diizinkan)
 */

import StateTransition, { ALLOWED_TRANSITIONS } from '../models/state_transition.model.js';
import mongoose from 'mongoose';

// Dirichlet prior — mencegah probabilitas jadi 0 atau 1 saat data sedikit
const DIRICHLET_ALPHA = 0.1;

// Mapping: nama state → field name di MongoDB
const STATE_TO_FIELD = {
  UNKNOWN:               'from_UNKNOWN',
  BASELINE_COMPATIBLE:   'from_BASELINE_COMPATIBLE',
  DEVIATION_CANDIDATE:   'from_DEVIATION_CANDIDATE',
  PERSISTENT_DEVIATION:  'from_PERSISTENT_DEVIATION',
  RECOVERY:              'from_RECOVERY',
  RECOVERED:             'from_RECOVERED',
};

// Mapping: nama rr_status (pipeline) → canonical state name
const STATUS_TO_STATE = {
  NORMAL:               'BASELINE_COMPATIBLE',
  PROVISIONAL_NORMAL:   'BASELINE_COMPATIBLE',
  DEVIATION_CANDIDATE:  'DEVIATION_CANDIDATE',
  PERSISTENT_DEVIATION: 'PERSISTENT_DEVIATION',
  RECOVERING:           'RECOVERY',
  RECOVERED:            'RECOVERED',
  INSUFFICIENT_BASELINE: 'UNKNOWN',
  QUALITY_WARNING:       null, // diabaikan untuk transition learning
  PROVISIONAL_DEVIATION: 'DEVIATION_CANDIDATE',
};

/**
 * Rekam satu transisi state.
 * Dipanggil setelah updateTemporalState() untuk setiap window yang dianalisis.
 *
 * @param {string|ObjectId} userId
 * @param {string} activity - 'Rest' | 'Light' | 'Moderate' | 'Intense' | 'Unknown'
 * @param {string} fromRrStatus - rr_status window sebelumnya
 * @param {string} toRrStatus   - rr_status window sekarang
 */
export async function recordStateTransition(userId, activity, fromRrStatus, toRrStatus) {
  try {
    const fromState = STATUS_TO_STATE[fromRrStatus];
    const toState   = STATUS_TO_STATE[toRrStatus];

    // Abaikan jika salah satu null (QUALITY_WARNING, dll)
    if (!fromState || !toState) return;

    // Cek apakah transisi ini secara struktural diizinkan
    const allowed = ALLOWED_TRANSITIONS[fromState];
    if (!allowed || !allowed.includes(toState)) return;

    const fromField = STATE_TO_FIELD[fromState];
    if (!fromField) return;

    const objId = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : null;
    if (!objId) return;

    // Upsert — increment counter atomically
    await StateTransition.updateOne(
      { user_id: objId, activity },
      {
        $inc: {
          [`${fromField}.to_${toState}`]: 1,
          [`${fromField}.total`]: 1,
          total_transitions: 1,
        },
        $set: { last_updated: new Date() },
      },
      { upsert: true }
    );
  } catch (err) {
    // Non-critical — jangan crash pipeline
    console.error('[recordStateTransition] Error:', err.message);
  }
}

/**
 * Ambil matriks transisi P(j|i) dengan Dirichlet smoothing.
 *
 * @param {string|ObjectId} userId
 * @param {string} activity
 * @returns {object} { matrix: { [fromState]: { [toState]: probability } }, total_transitions, source }
 */
export async function getTransitionMatrix(userId, activity = null) {
  try {
    const objId = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : null;

    const query = objId ? { user_id: objId } : {};
    if (activity) query.activity = activity;

    const docs = await StateTransition.find(query).lean();

    if (docs.length === 0) {
      return { matrix: null, total_transitions: 0, source: 'prior_only' };
    }

    // Agregat jika multi-activity
    const aggregated = aggregateDocs(docs);
    const matrix = buildProbabilityMatrix(aggregated);
    const total = docs.reduce((s, d) => s + (d.total_transitions || 0), 0);

    return {
      matrix,
      total_transitions: total,
      source: total >= 10 ? 'learned' : 'sparse',
    };
  } catch (err) {
    console.error('[getTransitionMatrix] Error:', err.message);
    return { matrix: null, total_transitions: 0, source: 'error' };
  }
}

/**
 * Ambil transition data untuk satu user per semua aktivitas.
 */
export async function getAllTransitions(userId) {
  try {
    const objId = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : null;
    if (!objId) return [];

    return await StateTransition.find({ user_id: objId }).lean();
  } catch (err) {
    console.error('[getAllTransitions] Error:', err.message);
    return [];
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function aggregateDocs(docs) {
  const result = {};
  for (const doc of docs) {
    for (const [fromField, countObj] of Object.entries(doc)) {
      if (!fromField.startsWith('from_') || typeof countObj !== 'object' || !countObj) continue;
      if (!result[fromField]) result[fromField] = {};
      for (const [toKey, count] of Object.entries(countObj)) {
        if (typeof count !== 'number') continue;
        result[fromField][toKey] = (result[fromField][toKey] || 0) + count;
      }
    }
  }
  return result;
}

function buildProbabilityMatrix(aggregated) {
  const states = Object.keys(ALLOWED_TRANSITIONS);
  const matrix = {};

  for (const fromState of states) {
    const fromField = STATE_TO_FIELD[fromState];
    if (!fromField) continue;

    const counts = aggregated[fromField] || {};
    const allowedTo = ALLOWED_TRANSITIONS[fromState];

    // Total observed + Dirichlet prior for allowed transitions
    const totalObserved = counts.total || 0;
    const totalPrior = DIRICHLET_ALPHA * allowedTo.length;
    const totalDenom = totalObserved + totalPrior;

    matrix[fromState] = {};
    for (const toState of allowedTo) {
      const observed = counts[`to_${toState}`] || 0;
      matrix[fromState][toState] = parseFloat(
        ((observed + DIRICHLET_ALPHA) / totalDenom).toFixed(4)
      );
    }
  }

  return matrix;
}
