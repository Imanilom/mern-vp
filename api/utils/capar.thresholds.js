/**
 * capar.thresholds.js
 *
 * Implementasi algoritma CAPAR Personal Experience Learning — Tahap 4 (Section 7.1)
 * Menghitung tau_in, tau_out, tau_normal dari StableScore memory.
 *
 * StableScore_(u,c) = { S_t | P_(t-1) = BC ∧ P_t = BC }
 *   tau_in    = clip(Q_0.99(StableScore), lower, upper)
 *   tau_out   = min(Q_0.95(StableScore), tau_in - delta_h_min)
 *   tau_normal = min(Q_0.90(StableScore), tau_out)
 *
 * Sebelum jumlah stable scores mencapai min_stable_scores,
 * dikembalikan threshold dari konfigurasi (configured thresholds).
 */

import Segment from '../models/segment.model.js';
import Baseline from '../models/baseline.model.js';
import AnomalyEvent from '../models/anomalyevent.model.js';
import mongoose from 'mongoose';

// ── Konstanta default (dapat di-override via fungsi) ──────────────────────────
const DEFAULT_CONFIG = {
  min_stable_scores: 30,   // Minimum stable scores sebelum learned thresholds aktif
  tau_in_lower: 1.0,       // Batas bawah tau_in
  tau_in_upper: 3.0,       // Batas atas tau_in
  tau_out_lower: 0.5,
  tau_out_upper: 2.5,
  delta_h_min: 0.15,       // Minimum hysteresis gap: tau_in - tau_out >= delta_h_min
  tau_normal_lower: 0.3,
  // Default threshold (saat belum cukup stable scores)
  default_tau_in: 1.5,
  default_tau_out: 1.0,
  default_tau_normal: 0.7,
};

// ── Helper: Quantile dari array angka ─────────────────────────────────────────
function quantile(arr, q) {
  if (!arr || arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (base + 1 < sorted.length) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function clip(val, lower, upper) {
  return Math.max(lower, Math.min(upper, val));
}

function round4(v) {
  return typeof v === 'number' && !isNaN(v) ? parseFloat(v.toFixed(4)) : null;
}

// ── Fungsi inti: hitung tau dari StableScore array ────────────────────────────
export function computeTauFromStableScores(stableScores, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Jika belum cukup data, gunakan configured defaults
  if (!stableScores || stableScores.length < cfg.min_stable_scores) {
    return {
      tau_in: cfg.default_tau_in,
      tau_out: cfg.default_tau_out,
      tau_normal: cfg.default_tau_normal,
      source: 'configured',
      stable_score_count: stableScores?.length || 0,
      min_required: cfg.min_stable_scores,
    };
  }

  // Hitung quantiles dari stable scores
  const q99 = quantile(stableScores, 0.99);
  const q95 = quantile(stableScores, 0.95);
  const q90 = quantile(stableScores, 0.90);

  // tau_in = clip(Q_0.99, lower, upper)
  const tau_in = clip(q99, cfg.tau_in_lower, cfg.tau_in_upper);

  // tau_out = min(Q_0.95, tau_in - delta_h_min)
  const tau_out = Math.min(q95, tau_in - cfg.delta_h_min);
  const tau_out_clipped = clip(tau_out, cfg.tau_out_lower, cfg.tau_out_upper);

  // tau_normal = min(Q_0.90, tau_out)
  const tau_normal = Math.min(q90, tau_out_clipped);
  const tau_normal_clipped = clip(tau_normal, cfg.tau_normal_lower, tau_out_clipped);

  // Validasi hysteresis: tau_normal <= tau_out < tau_in
  const validHysteresis = tau_normal_clipped <= tau_out_clipped && tau_out_clipped < tau_in;

  return {
    tau_in: round4(tau_in),
    tau_out: round4(tau_out_clipped),
    tau_normal: round4(tau_normal_clipped),
    source: 'learned',
    stable_score_count: stableScores.length,
    min_required: cfg.min_stable_scores,
    hysteresis_valid: validHysteresis,
    quantiles: {
      q99: round4(q99),
      q95: round4(q95),
      q90: round4(q90),
    },
  };
}

// ── Ambil StableScores dari Segment database ──────────────────────────────────
/**
 * StableScore_(u,c) = anomaly_score pada window NORMAL (BC→BC).
 * Dalam database kita, BC→BC window = segment dengan classification='Normal'
 * dan rr_status='NORMAL' atau classification='Normal'.
 * 
 * Kita gunakan classification='Normal' sebagai proxy untuk BC state,
 * karena itu adalah segmen yang berada dalam baseline-compatible zone.
 */
export async function getStableScores(userId, activity = null) {
  try {
    const objId = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : null;

    if (!objId) return [];

    const filter = {
      user_id: objId,
      analyzed: true,
      is_valid: true,
      classification: 'Normal',
      anomaly_score: { $ne: null, $exists: true, $gt: 0 },
    };

    if (activity) {
      filter.activity_label = activity;
    }

    const segments = await Segment.find(filter)
      .select('anomaly_score activity_label window_start')
      .sort({ window_start: -1 })
      .limit(500) // Ambil 500 terbaru untuk efisiensi
      .lean();

    return segments.map(s => s.anomaly_score).filter(s => typeof s === 'number' && !isNaN(s));
  } catch (err) {
    console.error('[getStableScores] Error:', err.message);
    return [];
  }
}

// ── Hitung thresholds per aktivitas ──────────────────────────────────────────
/**
 * Hitung tau_in, tau_out, tau_normal untuk satu user,
 * dikelompokkan per activity label.
 * 
 * @param {string} userId - MongoDB ObjectId atau guid
 * @param {object} config - Override konfigurasi default
 * @returns {object} threshold_by_activity + global_threshold
 */
export async function computePersonalThresholds(userId, config = {}) {
  try {
    const activities = ['Rest', 'Light', 'Moderate', 'Intense', 'Unknown'];
    const result = {};

    // Per-activity thresholds
    for (const activity of activities) {
      const scores = await getStableScores(userId, activity);
      result[activity] = computeTauFromStableScores(scores, config);
      result[activity].activity = activity;
    }

    // Global threshold (semua aktivitas digabung)
    const allScores = await getStableScores(userId, null);
    const global = computeTauFromStableScores(allScores, config);

    return {
      user_id: userId,
      computed_at: new Date().toISOString(),
      global_threshold: {
        ...global,
        activity: 'all',
      },
      threshold_by_activity: result,
      algorithm: {
        description: 'CAPAR Personal Experience Learning — Section 7.1',
        tau_in: 'clip(Q_0.99(StableScore), lower, upper)',
        tau_out: 'min(Q_0.95(StableScore), tau_in - delta_h_min)',
        tau_normal: 'min(Q_0.90(StableScore), tau_out)',
        stable_score_definition: 'anomaly_score from Normal (BC→BC) segments',
      },
    };
  } catch (err) {
    console.error('[computePersonalThresholds] Error:', err.message);
    throw err;
  }
}

// ── Persist Tau ke Baseline (untuk digunakan pipeline) ───────────────────────
/**
 * Simpan tau_in, tau_out, tau_normal ke dokumen Baseline.
 * Dipanggil setelah komputasi tau saat window count kelipatan 10.
 *
 * @param {string} baselineId - MongoDB ObjectId dari Baseline doc
 * @param {object} tau - { tau_in, tau_out, tau_normal, source, stable_score_count }
 */
export async function persistTauToBaseline(baselineId, tau) {
  try {
    await Baseline.updateOne(
      { _id: baselineId },
      {
        $set: {
          'learned_tau.tau_in':             tau.tau_in,
          'learned_tau.tau_out':            tau.tau_out,
          'learned_tau.tau_normal':         tau.tau_normal,
          'learned_tau.source':             tau.source,
          'learned_tau.stable_score_count': tau.stable_score_count,
          'learned_tau.computed_at':        new Date(),
        },
      }
    );
  } catch (err) {
    console.error('[persistTauToBaseline] Error:', err.message);
  }
}

/**
 * Push stable score ke history Baseline agar bisa dipakai untuk komputasi tau.
 * Hanya dipanggil saat window dalam status NORMAL (BC→BC transition).
 *
 * @param {string} baselineId
 * @param {number} anomalyScore
 */
export async function appendStableScore(baselineId, anomalyScore) {
  try {
    if (typeof anomalyScore !== 'number' || isNaN(anomalyScore)) return;
    await Baseline.updateOne(
      { _id: baselineId },
      { $push: { stable_score_history: { $each: [anomalyScore], $slice: -500 } } } // keep last 500
    );
  } catch (err) {
    console.error('[appendStableScore] Error:', err.message);
  }
}

// ── Recovery Distribution (CAPAR Section 7.3) ────────────────────────────────
/**
 * Hitung distribusi recovery time dari riwayat AnomalyEvent yang sudah resolved.
 *
 * T_hat_recovery = median(R_(u,c))
 * interval = [Q_0.25, Q_0.75]
 *
 * @param {string} userId
 * @param {string|null} activity - Filter per aktivitas, null = semua
 * @returns {{ median_ms, p25_ms, p75_ms, count, confidence, median_min, p25_min, p75_min }}
 */
export async function getRecoveryDistribution(userId, activity = null) {
  try {
    const objId = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : null;
    if (!objId) return null;

    const filter = {
      user_id: objId,
      status: { $in: ['closed', 'resolved'] },
      'trajectory.recovery_time_ms': { $gt: 0, $exists: true },
    };
    if (activity) filter.activity = activity;

    const events = await AnomalyEvent.find(filter)
      .select('trajectory.recovery_time_ms activity')
      .lean();

    const recoveries = events
      .map(e => e.trajectory?.recovery_time_ms)
      .filter(v => typeof v === 'number' && v > 0);

    if (recoveries.length === 0) {
      return { median_ms: null, p25_ms: null, p75_ms: null, count: 0, confidence: 'insufficient' };
    }

    const median_ms = quantile(recoveries, 0.50);
    const p25_ms    = quantile(recoveries, 0.25);
    const p75_ms    = quantile(recoveries, 0.75);

    const confidence = recoveries.length >= 10 ? 'high' : recoveries.length >= 3 ? 'medium' : 'low';

    return {
      median_ms:  round4(median_ms),
      p25_ms:     round4(p25_ms),
      p75_ms:     round4(p75_ms),
      // Untuk tampilan (menit)
      median_min: round4(median_ms / 60000),
      p25_min:    round4(p25_ms / 60000),
      p75_min:    round4(p75_ms / 60000),
      count:      recoveries.length,
      confidence,
    };
  } catch (err) {
    console.error('[getRecoveryDistribution] Error:', err.message);
    return null;
  }
}
