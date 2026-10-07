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
import { getPatientDecisionPolicyBundle } from '../config/patientDecisionPolicies.js';

const CAPAR_POLICY_RULES = {
  min_stable_scores: 'capar_min_stable_scores',
  min_scores_for_learning: 'capar_min_scores_for_learning',
  tau_in_lower: 'capar_tau_in_lower',
  tau_in_upper: 'capar_tau_in_upper',
  tau_out_lower: 'capar_tau_out_lower',
  tau_out_upper: 'capar_tau_out_upper',
  delta_h_min: 'capar_minimum_hysteresis_gap',
  tau_normal_lower: 'capar_tau_normal_lower',
  default_tau_in: 'capar_default_tau_in',
  default_tau_out: 'capar_default_tau_out',
  default_tau_normal: 'capar_default_tau_normal',
  tau_in_quantile: 'capar_tau_in_quantile',
  tau_out_quantile: 'capar_tau_out_quantile',
  tau_normal_quantile: 'capar_tau_normal_quantile',
};

const policyRuleIds = Object.values(CAPAR_POLICY_RULES);
const policyDefaults = Object.fromEntries(
  Object.entries(CAPAR_POLICY_RULES).map(([configKey, ruleId]) => [
    configKey,
    getPatientDecisionPolicyBundle([ruleId]).rules[0].value,
  ])
);

const DEFAULT_CONFIG = {
  ...policyDefaults,
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
export function computeTauFromStableScores(stableScores, options = {}) {
  const unknownOptions = Object.keys(options)
    .filter((key) => key !== 'policyOverrides');
  if (unknownOptions.length) {
    throw new TypeError(
      `CAPAR threshold options require policyOverrides with provenance; unsupported: ${unknownOptions.join(', ')}`
    );
  }
  const { policyOverrides = {} } = options;
  const policy = getPatientDecisionPolicyBundle(policyRuleIds, policyOverrides);
  const ruleValues = new Map(policy.rules.map((rule) => [rule.rule_id, rule.value]));
  const cfg = Object.fromEntries(
    Object.entries(CAPAR_POLICY_RULES).map(([configKey, ruleId]) => [
      configKey,
      ruleValues.get(ruleId),
    ])
  );

  // Jika belum ada stable scores sama sekali atau < 10, gunakan configured defaults (NON-NULL)
  if (!stableScores || stableScores.length < cfg.min_scores_for_learning) {
    return {
      tau_in: cfg.default_tau_in,
      tau_out: cfg.default_tau_out,
      tau_normal: cfg.default_tau_normal,
      source: 'configured',
      stable_score_count: stableScores?.length || 0,
      min_required: cfg.min_stable_scores,
      policy,
      policy_status: policy.status,
      effective_config: cfg,
    };
  }

  const isProvisional = stableScores.length < cfg.min_stable_scores;

  // Hitung quantiles dari stable scores
  const q99 = quantile(stableScores, cfg.tau_in_quantile);
  const q95 = quantile(stableScores, cfg.tau_out_quantile);
  const q90 = quantile(stableScores, cfg.tau_normal_quantile);

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
    source: isProvisional ? 'provisional' : 'learned',
    stable_score_count: stableScores.length,
    min_required: cfg.min_stable_scores,
    hysteresis_valid: validHysteresis,
    policy,
    policy_status: policy.status,
    effective_config: cfg,
    quantiles: {
      q99: round4(q99),
      q95: round4(q95),
      q90: round4(q90),
    },
  };
}

export function applyProvisionalTauFallback(tau, stats) {
  if (tau?.source !== 'configured' || !stats) return tau;
  const stdHr = stats.mean_hr?.std
    || stats.std_hr?.mean
    || stats.hr_mean?.std
    || getPatientDecisionPolicyBundle(['capar_provisional_hr_std_fallback']).rules[0].value;
  if (!Number.isFinite(stdHr) || stdHr <= 0) return tau;

  const policy = getPatientDecisionPolicyBundle([
    'capar_provisional_hr_std_fallback',
    'capar_provisional_tau_in_base',
    'capar_provisional_tau_in_hr_std_weight',
    'capar_provisional_tau_out_base',
    'capar_provisional_tau_out_hr_std_weight',
    'capar_provisional_tau_normal',
  ]);
  const values = new Map(policy.rules.map((rule) => [rule.rule_id, rule.value]));
  return {
    ...tau,
    tau_in: Number((
      values.get('capar_provisional_tau_in_base')
      + stdHr * values.get('capar_provisional_tau_in_hr_std_weight')
    ).toFixed(2)),
    tau_out: Number((
      values.get('capar_provisional_tau_out_base')
      + stdHr * values.get('capar_provisional_tau_out_hr_std_weight')
    ).toFixed(2)),
    tau_normal: values.get('capar_provisional_tau_normal'),
    source: 'provisional',
    policy: {
      ...tau.policy,
      rules: [...(tau.policy?.rules || []), ...policy.rules],
    },
    policy_status: policy.status,
    effective_config: {
      ...tau.effective_config,
      provisional_hr_std: stdHr,
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
 * @param {{ policyOverrides?: object }} options - Provenance-complete policy rule overrides
 * @returns {object} threshold_by_activity + global_threshold
 */
export async function computePersonalThresholds(userId, options = {}) {
  const unknownOptions = Object.keys(options)
    .filter((key) => key !== 'policyOverrides');
  if (unknownOptions.length) {
    throw new TypeError(
      `CAPAR threshold options require policyOverrides with provenance; unsupported: ${unknownOptions.join(', ')}`
    );
  }
  const { policyOverrides = {} } = options;
  try {
    const activities = ['Rest', 'Light', 'Moderate', 'Intense', 'Unknown'];
    const result = {};

    // Per-activity thresholds
    for (const activity of activities) {
      const scores = await getStableScores(userId, activity);
      result[activity] = computeTauFromStableScores(scores, { policyOverrides });
      result[activity].activity = activity;
    }

    // Global threshold (semua aktivitas digabung)
    const allScores = await getStableScores(userId, null);
    const global = computeTauFromStableScores(allScores, { policyOverrides });

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
        policy: getPatientDecisionPolicyBundle(policyRuleIds, policyOverrides),
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
 *
 * @param {string} baselineId - MongoDB ObjectId dari Baseline doc
 * @param {object} tau - { tau_in, tau_out, tau_normal, source, stable_score_count }
 */
export async function persistTauToBaseline(baselineId, tau) {
  try {
    const tauIn = (tau && typeof tau.tau_in === 'number') ? tau.tau_in : DEFAULT_CONFIG.default_tau_in;
    const tauOut = (tau && typeof tau.tau_out === 'number') ? tau.tau_out : DEFAULT_CONFIG.default_tau_out;
    const tauNorm = (tau && typeof tau.tau_normal === 'number') ? tau.tau_normal : DEFAULT_CONFIG.default_tau_normal;
    const source = tau?.source || 'configured';
    const count = tau?.stable_score_count || 0;
    const policy = tau?.policy || getPatientDecisionPolicyBundle(policyRuleIds);

    await Baseline.updateOne(
      { _id: baselineId },
      {
        $set: {
          'learned_tau.tau_in':             tauIn,
          'learned_tau.tau_out':            tauOut,
          'learned_tau.tau_normal':         tauNorm,
          'learned_tau.source':             source,
          'learned_tau.stable_score_count': count,
          'learned_tau.computed_at':        new Date(),
          'learned_tau.policy':             policy,
        },
      }
    );
  } catch (err) {
    console.error('[persistTauToBaseline] Error:', err.message);
  }
}

export function buildLegacyTauPolicy(tau) {
  const computedAt = tau.computed_at ? new Date(tau.computed_at) : null;
  const effectiveDate = computedAt && Number.isFinite(computedAt.getTime())
    ? computedAt.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const fields = [
    ['capar_legacy_tau_in', tau.tau_in],
    ['capar_legacy_tau_out', tau.tau_out],
    ['capar_legacy_tau_normal', tau.tau_normal],
  ];
  const source = 'Existing Baseline.learned_tau values; original provenance unavailable';
  const rationale = 'Preserves the previously stored value without asserting clinical validation.';
  const rules = fields.map(([ruleId, value]) => ({
    policy_id: 'nadiku_legacy_capar_thresholds',
    rule_id: ruleId,
    version: '0.0.0',
    source,
    rationale,
    effective_date: effectiveDate,
    confidence: 0,
    status: 'NON-CLINICAL / PLACEHOLDER',
    value,
  }));
  return {
    policy_id: 'nadiku_legacy_capar_thresholds',
    version: '0.0.0',
    source,
    rationale,
    effective_date: effectiveDate,
    confidence: 0,
    status: 'NON-CLINICAL / PLACEHOLDER',
    rules,
  };
}

/**
 * Auto sync / backfill learned_tau untuk seluruh Baseline di MongoDB
 * yang learned_tau.tau_in nya masih null / undefined or lacks policy provenance.
 */
export async function syncAllBaselineLearnedTau() {
  try {
    const baselines = await Baseline.find({
      $or: [
        { learned_tau: { $exists: false } },
        { 'learned_tau.tau_in': null },
        { 'learned_tau.tau_in': { $exists: false } },
        { 'learned_tau.policy': null },
        { 'learned_tau.policy': { $exists: false } },
      ]
    });

    if (!baselines || baselines.length === 0) {
      console.log('[syncBaselineLearnedTau] Semua baseline sudah memiliki learned_tau non-null.');
      return;
    }

    console.log(`[syncBaselineLearnedTau] Menemukan ${baselines.length} baseline dengan learned_tau null. Memperbaiki...`);
    let updatedCount = 0;

    for (const b of baselines) {
      const legacyTau = b.learned_tau;
      if (
        Number.isFinite(legacyTau?.tau_in)
        && Number.isFinite(legacyTau?.tau_out)
        && Number.isFinite(legacyTau?.tau_normal)
        && !legacyTau.policy
      ) {
        const legacyValues = typeof legacyTau.toObject === 'function'
          ? legacyTau.toObject()
          : legacyTau;
        await persistTauToBaseline(b._id, {
          ...legacyValues,
          policy: buildLegacyTauPolicy(legacyTau),
        });
        updatedCount++;
        continue;
      }
      const scoresFromSeg = await getStableScores(b.user_id, b.activity);
      const combinedScores = (scoresFromSeg && scoresFromSeg.length > 0)
        ? scoresFromSeg
        : (b.stable_score_history || []);

      const tau = applyProvisionalTauFallback(
        computeTauFromStableScores(combinedScores),
        b.stats
      );

      await persistTauToBaseline(b._id, tau);
      updatedCount++;
    }

    console.log(`[syncBaselineLearnedTau] Sukses memperbarui ${updatedCount} baseline learned_tau.`);
  } catch (err) {
    console.error('[syncBaselineLearnedTau] Error:', err.message);
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
