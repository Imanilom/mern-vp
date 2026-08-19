/**
 * rrBaselinePipeline.js — RR-Only Context-Aware Anomaly Detection
 *
 * Port dari Python: context_aware_autonomic_pipeline.py
 *
 * Fitur: hr_mean, hr_delta, hr_slope, sdnn, rmssd, pnn50,
 *        dfa_alpha1, dfa_alpha2, motion_index
 * Window: 1 menit
 * Threshold: dinamis berdasarkan maturity baseline
 *
 * Modul ini TIDAK membuat keputusan klinis. Threshold harus dikalibrasi
 * sesuai populasi dan perangkat yang digunakan.
 */
import { calculateDFA } from '../controllers/metrics.controller.js';

// ── Konfigurasi ───────────────────────────────────────────────────────────────

/**
 * Batas fisiologis RR interval (ms).
 * Kalibrasi untuk Polar H10 / perangkat kardio serupa.
 */
export const RR_BOUNDS = {
  min_ms: 300.0,    // ~200 bpm — batas atas HR saat olahraga berat
  max_ms: 2000.0,   // ~30 bpm — batas bawah HR saat tidur
};

/**
 * Konfigurasi quality gate.
 */
export const QUALITY_CONFIG = {
  local_median_beats: 11,           // lebar window median lokal (harus ganjil)
  local_relative_deviation: 0.20,   // deviasi relatif terhadap median lokal
  local_absolute_deviation_ms: 200, // deviasi absolut minimum (ms)
  max_artifact_fraction: 0.05,      // 5% maksimal artefak
  max_missing_fraction: 0.10,       // 10% maksimal missing
  min_activity_confidence: 0.80,    // kepercayaan minimum aktivitas
  min_rr_count: 45,                 // minimum RR per window 1 menit (>=75bpm x 60s)
  max_relative_jump: 0.20,          // 20% max relative jump antar beat (J_max)
};

/**
 * Konfigurasi maturity baseline.
 */
export const MATURITY_CONFIG = {
  provisional_min_windows: 15, // 15 windows @ 2 min = 30 min total per activity
  mature_min_windows: 30,      // 30 windows @ 2 min = 60 min total per activity
  min_effective_windows: 45,
  min_distinct_days: 3,
  min_windows_per_day: 5,
  max_single_day_fraction: 0.60,
  bq_min: 0.70,
  min_stability_score: 0.65,
  min_component_quality: 0.60,
  autocorr_max_lag: 20,
  provisional_outlier_mad: 4.0,
  provisional_outlier_min_n: 8,
};

/**
 * Bobot fitur untuk composite anomaly score (hanya RR-based, 3 fitur).
 * Dipertahankan untuk kompatibilitas mundur.
 * @deprecated Gunakan FEATURE_WEIGHTS untuk pipeline baru.
 */
export const RR_WEIGHTS = {
  z_rmssd: 0.50,
  z_sdnn: 0.30,
  z_hr: 0.20,
};

/**
 * Bobot fitur 7-komponen per spesifikasi algoritma v1.0 (Agustus 2026).
 * Digunakan oleh computePersonalizedScore() tanpa maturity penalty.
 * Total = 1.0
 */
export const FEATURE_WEIGHTS = {
  hr_mean: 0.20,
  hr_delta: 0.10,
  hr_slope: 0.10,
  sdnn: 0.15,
  rmssd: 0.20,
  dfa_alpha1: 0.20,
  motion_index: 0.05,
};

/** Fitur wajib — skor tidak dihitung jika baseline salah satunya belum ada. */
export const MANDATORY_FEATURES = ['hr_mean', 'rmssd', 'dfa_alpha1'];

/** Minimum total bobot fitur tersedia agar skor dianggap valid. */
export const MIN_SCORED_WEIGHT = 0.50;

/**
 * Threshold anomaly score berdasarkan level maturity baseline.
 * Semakin matang baseline, semakin ketat threshold.
 */
export function getDynamicThreshold(maturityLevel) {
  switch (maturityLevel) {
    case 'mature': return { CAUTION: 1.5, ALERT: 3.0 };
    case 'maturing': return { CAUTION: 2.0, ALERT: 3.5 };
    case 'provisional': return { CAUTION: 2.5, ALERT: 4.0 };
    case 'cold_start':
    default: return { CAUTION: 3.0, ALERT: 5.0 };
  }
}

export const MAX_ABS_Z = 8.0;

export const PERSISTENCE_CONFIG = {
  persistence_windows: 3,
  recovery_windows: 3,
  cooldown_windows: 3,
  recovery_threshold_frac: 0.5,
};

/** 
 * Population Priors untuk HRV dari literatur (estimasi kasar untuk Polar H10). 
 * Digunakan untuk Empirical Bayes Shrinkage selama masa PROVISIONAL.
 */
export const POPULATION_PRIORS = {
  Rest: { hr_mean: { mean: 65, sd: 10 }, sdnn: { mean: 50, sd: 15 }, rmssd: { mean: 42, sd: 18 }, dfa_alpha1: { mean: 1.10, sd: 0.20 } },
  Light: { hr_mean: { mean: 80, sd: 12 }, sdnn: { mean: 40, sd: 12 }, rmssd: { mean: 30, sd: 14 }, dfa_alpha1: { mean: 1.00, sd: 0.20 } },
  Moderate: { hr_mean: { mean: 95, sd: 15 }, sdnn: { mean: 30, sd: 10 }, rmssd: { mean: 20, sd: 10 }, dfa_alpha1: { mean: 0.90, sd: 0.20 } },
  Intense: { hr_mean: { mean: 130, sd: 20 }, sdnn: { mean: 20, sd: 8 }, rmssd: { mean: 12, sd: 6 }, dfa_alpha1: { mean: 0.80, sd: 0.15 } },
  Unknown: { hr_mean: { mean: 75, sd: 15 }, sdnn: { mean: 45, sd: 15 }, rmssd: { mean: 35, sd: 15 }, dfa_alpha1: { mean: 1.00, sd: 0.20 } },
};

// ── Quality Assessment ─────────────────────────────────────────────────────────

/**
 * Penilaian dan koreksi artefak RR interval dalam satu window.
 *
 * Port dari assess_and_correct_rr() Python.
 *
 * Langkah:
 *  1. Filter batas fisiologis (300-2000 ms)
 *  2. Local-median rule (deteksi ectopic / missed beat)
 *  3. Interpolasi linier untuk menggantikan beat yang buruk
 *  4. Hitung q_signal, q_complete, q_context
 *
 * @param {number[]} rrArr - Array RR interval (ms)
 * @param {number} activityConfidence - Kepercayaan label aktivitas (0-1)
 * @param {number} [expectedCount] - Jumlah beat yang diharapkan (opsional)
 * @returns {{ accepted, rr_clean, artifact_fraction, missing_fraction, q_signal, q_complete, q_context, reasons }}
 */
export function assessRRQuality(rrArr, activityConfidence, expectedCount) {
  const reasons = [];

  if (!rrArr || rrArr.length === 0) {
    return {
      accepted: false,
      rr_clean: [],
      artifact_fraction: 1.0,
      missing_fraction: 1.0,
      q_signal: 0.0,
      q_complete: 0.0,
      q_context: clip(activityConfidence, 0, 1),
      reasons: ['Array RR kosong.'],
    };
  }

  const n = rrArr.length;
  const expected = Math.max(expectedCount || n, 1);
  const missingCount = Math.max(expected - n, 0);
  const missing_fraction = clip(missingCount / expected, 0, 1);

  // Step 1: Filter fisiologis
  const bad = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    const v = rrArr[i];
    if (!isFinite(v) || v < RR_BOUNDS.min_ms || v > RR_BOUNDS.max_ms) {
      bad[i] = true;
    }
  }

  // Step 2: Local-median rule
  const work = rrArr.slice();
  const globalMedian = medianOf(rrArr.filter((_, i) => !bad[i])) || 800;
  for (let i = 0; i < n; i++) {
    if (bad[i]) work[i] = globalMedian;
  }

  const hw = Math.floor(QUALITY_CONFIG.local_median_beats / 2);
  for (let i = 0; i < n; i++) {
    // 1. Local-median rule
    const lo = Math.max(0, i - hw);
    const hi = Math.min(n - 1, i + hw);
    const localMed = medianOf(work.slice(lo, hi + 1));
    const allowed = Math.max(
      QUALITY_CONFIG.local_absolute_deviation_ms,
      QUALITY_CONFIG.local_relative_deviation * Math.max(localMed, 1),
    );
    if (Math.abs(work[i] - localMed) > allowed) {
      bad[i] = true;
    }

    // 2. Relative-jump rule (J_max) dari dokumen
    if (i > 0 && !bad[i - 1]) {
      const prev = work[i - 1];
      const jump = Math.abs(work[i] - prev) / Math.max(prev, 1);
      if (jump > QUALITY_CONFIG.max_relative_jump) {
        bad[i] = true;
      }
    }
  }

  const artifact_fraction = bad.filter(Boolean).length / n;

  // Step 3: Koreksi via interpolasi linier
  const rr_clean = work.slice();
  for (let i = 0; i < n; i++) {
    if (bad[i]) rr_clean[i] = null;
  }

  const validIdx = [];
  const validVal = [];
  for (let i = 0; i < n; i++) {
    if (rr_clean[i] !== null) { validIdx.push(i); validVal.push(rr_clean[i]); }
  }

  if (validIdx.length >= 2) {
    for (let i = 0; i < n; i++) {
      if (rr_clean[i] === null) {
        rr_clean[i] = linearInterp(i, validIdx, validVal);
      }
    }
  } else if (validIdx.length === 1) {
    rr_clean.fill(validVal[0]);
  } else {
    rr_clean.fill(globalMedian);
  }

  // Step 4: Quality scores
  const q_signal = clip(1 - artifact_fraction, 0, 1);
  const q_complete = clip(1 - missing_fraction, 0, 1);
  const q_context = clip(activityConfidence, 0, 1);

  // Quality gates
  if (rr_clean.length < QUALITY_CONFIG.min_rr_count) {
    reasons.push(`Jumlah RR valid (${rr_clean.length}) < minimum (${QUALITY_CONFIG.min_rr_count}).`);
  }
  if (artifact_fraction > QUALITY_CONFIG.max_artifact_fraction) {
    reasons.push(`Artefak ${(artifact_fraction * 100).toFixed(1)}% > batas ${(QUALITY_CONFIG.max_artifact_fraction * 100).toFixed(1)}%.`);
  }
  if (missing_fraction > QUALITY_CONFIG.max_missing_fraction) {
    reasons.push(`Missing data ${(missing_fraction * 100).toFixed(1)}% > batas ${(QUALITY_CONFIG.max_missing_fraction * 100).toFixed(1)}%.`);
  }
  // UNCERTAIN_CONTEXT / Confidence aktivitas rendah TIDAK MENCEGAT sistem dalam membuat baseline.
  // Data tetap diterima (accepted = true) khusus untuk pembentukan baseline akumulatif.
  if (rr_clean.some(v => !isFinite(v))) {
    reasons.push('Koreksi RR menghasilkan nilai non-finite.');
  }

  return {
    accepted: reasons.length === 0,
    rr_clean,
    artifact_fraction,
    missing_fraction,
    q_signal,
    q_complete,
    q_context,
    reasons,
  };
}


// ── Feature Extraction (RR + optional Accel) ─────────────────────────────────

/**
 * Ekstrak fitur HRV dan gerak dari RR interval yang sudah dibersihkan.
 *
 * Fitur yang dihitung (9 total):
 *  hr_mean      = 60000 / mean(RR)
 *  sdnn         = std(RR, ddof=1)
 *  rmssd        = sqrt(mean(successive_differences²))
 *  pnn50        = proporsi |ΔRR| > 50 ms (0–1)
 *  hr_delta     = mean(HR paruh kedua) − mean(HR paruh pertama)
 *  hr_slope     = slope regresi HR terhadap waktu (bpm/menit)
 *  dfa_alpha1   = DFA α1 (skala 4–16 beat) — butuh n ≥ minRrForDfa
 *  dfa_alpha2   = DFA α2 (skala 17–64 beat)
 *  motion_index = ENMO akselerometer (opsional)
 *
 * DFA menggunakan calculateDFA() dari metrics.controller yang sudah ada.
 *
 * @param {number[]} rr_clean     - RR interval bersih (ms), wajib
 * @param {number[]} [accelX=[]] - Akselerasi sumbu X (g), opsional
 * @param {number[]} [accelY=[]] - Akselerasi sumbu Y (g), opsional
 * @param {number[]} [accelZ=[]] - Akselerasi sumbu Z (g), opsional
 * @param {number}   [minRrForDfa=64] - Minimum beat agar DFA dihitung
 * @returns {{ hr_mean, sdnn, rmssd, pnn50, hr_delta, hr_slope, dfa_alpha1, dfa_alpha2, motion_index }}
 */
export function extractRRFeatures(rr_clean, accelX = [], accelY = [], accelZ = [], minRrForDfa = 64) {
  const nullResult = {
    hr_mean: null, sdnn: null, rmssd: null,
    hr_delta: null, hr_slope: null, pnn50: null,
    dfa_alpha1: null, dfa_alpha2: null, motion_index: null,
  };
  if (!rr_clean || rr_clean.length < 2) return nullResult;

  const n = rr_clean.length;
  const meanRR = rr_clean.reduce((s, v) => s + v, 0) / n;
  const hr = rr_clean.map(r => 60000 / r);

  // ─── Time-domain ──────────────────────────────────────────────────────────
  const hr_mean = 60000 / meanRR;

  const sdnn = n > 1
    ? Math.sqrt(rr_clean.reduce((s, v) => s + (v - meanRR) ** 2, 0) / (n - 1))
    : 0;

  const diffs = [];
  for (let i = 1; i < n; i++) diffs.push(rr_clean[i] - rr_clean[i - 1]);
  const rmssd = diffs.length > 0
    ? Math.sqrt(diffs.reduce((s, d) => s + d * d, 0) / diffs.length)
    : 0;

  // pNN50: proporsi pasangan RR yang selisihnya > 50 ms (0–1)
  const pnn50 = diffs.length > 0
    ? diffs.filter(d => Math.abs(d) > 50).length / diffs.length
    : 0;

  // hr_delta: perubahan rata-rata HR antara paruh pertama dan kedua window
  const mid = Math.max(1, Math.floor(n / 2));
  const hrFirst = hr.slice(0, mid);
  const hrSecond = hr.slice(mid);
  const hr_delta = (hrSecond.reduce((s, v) => s + v, 0) / hrSecond.length)
    - (hrFirst.reduce((s, v) => s + v, 0) / hrFirst.length);

  // hr_slope: bpm per menit via regresi OLS
  let hr_slope = null;
  if (n >= 3) {
    const elapsed = [];
    let t = 0;
    for (const r of rr_clean) { t += r / 1000; elapsed.push(t); }
    if (elapsed[elapsed.length - 1] > elapsed[0]) {
      const [slopeSec] = _polyfit1(elapsed, hr);
      if (isFinite(slopeSec)) hr_slope = slopeSec * 60; // bpm / menit
    }
  }

  // ─── DFA (reuse calculateDFA dari metrics.controller.js) ──────────────────
  let dfa_alpha1 = null, dfa_alpha2 = null;
  if (n >= minRrForDfa) {
    const dfa = calculateDFA(rr_clean, 4, 64);
    dfa_alpha1 = dfa.alpha1 !== null && isFinite(dfa.alpha1) ? dfa.alpha1 : null;
    dfa_alpha2 = dfa.alpha2 !== null && isFinite(dfa.alpha2) ? dfa.alpha2 : null;
  }

  // ─── Motion index (ENMO dari akselerometer, opsional) ────────────────────
  let motion_index = null;
  if (accelX.length > 0
    && accelX.length === accelY.length
    && accelX.length === accelZ.length) {
    const enmo = accelX.map((ax, i) =>
      Math.max(Math.sqrt(ax ** 2 + accelY[i] ** 2 + accelZ[i] ** 2) - 1.0, 0)
    );
    motion_index = enmo.reduce((s, v) => s + v, 0) / enmo.length;
  }

  return {
    hr_mean: isFinite(hr_mean) ? r2(hr_mean) : null,
    sdnn: isFinite(sdnn) ? r2(sdnn) : null,
    rmssd: isFinite(rmssd) ? r2(rmssd) : null,
    hr_delta: isFinite(hr_delta) ? r2(hr_delta) : null,
    hr_slope: hr_slope !== null ? r2(hr_slope) : null,
    pnn50: isFinite(pnn50) ? r4(pnn50) : null,
    dfa_alpha1: dfa_alpha1 !== null ? r4(dfa_alpha1) : null,
    dfa_alpha2: dfa_alpha2 !== null ? r4(dfa_alpha2) : null,
    motion_index: motion_index !== null && isFinite(motion_index) ? r4(motion_index) : null,
  };
}


// ── Baseline Maturity ─────────────────────────────────────────────────────────

/**
 * Estimasi jumlah window independen efektif via truncated autocorrelation.
 *
 * Port dari autocorrelation_effective_n() Python.
 * n_eff = n / (1 + 2 * SUM_k [(1 - k/n) * rho_k])
 * Summation berhenti saat rho_k <= 0.
 *
 * @param {number[]} values
 * @param {number} [maxLag=20]
 * @returns {number}
 */
export function autocorrEffectiveN(values, maxLag = 20) {
  const finite = values.filter(isFinite);
  const n = finite.length;
  if (n <= 2) return n;

  const mean = finite.reduce((s, v) => s + v, 0) / n;
  const centered = finite.map(v => v - mean);
  const denom = centered.reduce((s, v) => s + v * v, 0);
  if (denom <= 0) return n;

  let tau = 1.0;
  const upper = Math.min(maxLag, n - 1);
  for (let lag = 1; lag <= upper; lag++) {
    let cov = 0;
    for (let i = 0; i < n - lag; i++) cov += centered[i] * centered[i + lag];
    const rho = cov / denom;
    if (!isFinite(rho) || rho <= 0) break;
    tau += 2.0 * (1 - lag / n) * rho;
  }
  tau = Math.max(tau, 1);
  return clip(n / tau, 1, n);
}

/**
 * Skor stabilitas harian baseline dalam [0, 1].
 *
 * Port dari stability_score() Python.
 * Mengukur seberapa kecil pergeseran mean harian relatif terhadap SD baseline.
 *
 * @param {number[]} values
 * @param {number[]} timestamps - Epoch ms
 * @param {number} baselineSD
 * @returns {number}
 */
export function computeStabilityScore(values, timestamps, baselineSD) {
  if (values.length < 2 || timestamps.length !== values.length) return 0;

  const dayGroups = {};
  for (let i = 0; i < values.length; i++) {
    const day = new Date(timestamps[i]).toISOString().slice(0, 10);
    if (!dayGroups[day]) dayGroups[day] = [];
    dayGroups[day].push(values[i]);
  }

  const days = Object.keys(dayGroups).sort();
  if (days.length < 2) return 0;

  const dayMeans = days.map(d => {
    const g = dayGroups[d];
    return g.reduce((s, v) => s + v, 0) / g.length;
  });

  if (!isFinite(baselineSD) || baselineSD < 1e-12) {
    return allClose(dayMeans) ? 1 : 0;
  }

  const shifts = [];
  for (let i = 1; i < dayMeans.length; i++) {
    shifts.push(Math.abs(dayMeans[i] - dayMeans[i - 1]) / baselineSD);
  }
  return clip(1 / (1 + medianOf(shifts)), 0, 1);
}

/**
 * Hitung laporan maturity baseline lengkap.
 *
 * Port dari maturity_report() Python.
 * BQ = 0.35*q_signal + 0.25*q_complete + 0.20*q_context + 0.20*q_stability
 *
 * @param {object} baseline - Mongoose Baseline document
 * @param {number[]} featureValues - Nilai rmssd atau sdnn yang tersimpan (untuk n_eff)
 * @returns {{ mature, level, n_effective, distinct_days, max_single_day_frac, q_signal, q_complete, q_context, q_stability, bq, failed_gates }}
 */
export function computeBaselineMaturity(baseline, featureValues) {
  const cfg = MATURITY_CONFIG;
  const timestamps = baseline.window_timestamps || [];
  const qSig = baseline.q_signal_history || [];
  const qComp = baseline.q_complete_history || [];
  const qCtx = baseline.q_context_history || [];

  const vals = featureValues && featureValues.length > 0 ? featureValues : [];
  const n_eff = vals.length > 0
    ? autocorrEffectiveN(vals, cfg.autocorr_max_lag)
    : (baseline.segment_count || 0);

  // Distinct eligible days
  const dayCounts = {};
  for (const ts of timestamps) {
    const day = new Date(ts).toISOString().slice(0, 10);
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  }
  const eligibleDays = Object.values(dayCounts).filter(c => c >= cfg.min_windows_per_day).length;
  const maxCount = Math.max(...Object.values(dayCounts), 1);
  const max_single_day_frac = timestamps.length > 0 ? maxCount / timestamps.length : 1;

  const avg = arr => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  const q_signal = avg(qSig);
  const q_complete = avg(qComp);
  const q_context = avg(qCtx);

  const sd = baseline.stats?.rmssd?.std || 0;
  const q_stability = vals.length >= 2 && timestamps.length === vals.length
    ? computeStabilityScore(vals, timestamps, sd)
    : 0;

  // Composite Baseline Quality
  const bq = 0.35 * q_signal + 0.25 * q_complete + 0.20 * q_context + 0.20 * q_stability;

  const failed = [];
  if (n_eff < cfg.min_effective_windows)
    failed.push(`n_eff=${n_eff.toFixed(1)} < ${cfg.min_effective_windows}`);
  if (eligibleDays < cfg.min_distinct_days)
    failed.push(`hari_eligible=${eligibleDays} < ${cfg.min_distinct_days}`);
  if (max_single_day_frac > cfg.max_single_day_fraction)
    failed.push(`dominasi_hari=${(max_single_day_frac * 100).toFixed(0)}% > ${(cfg.max_single_day_fraction * 100).toFixed(0)}%`);
  if (q_signal < cfg.min_component_quality) failed.push(`q_signal=${q_signal.toFixed(2)} < ${cfg.min_component_quality}`);
  if (q_complete < cfg.min_component_quality) failed.push(`q_complete=${q_complete.toFixed(2)} < ${cfg.min_component_quality}`);
  // UNCERTAIN_CONTEXT / q_context rendah TIDAK mencegat maturity baseline
  if (q_stability < cfg.min_stability_score) failed.push(`q_stability=${q_stability.toFixed(2)} < ${cfg.min_stability_score}`);
  if (bq < cfg.bq_min) failed.push(`BQ=${bq.toFixed(2)} < ${cfg.bq_min}`);

  const mature = failed.length === 0 || eligibleDays >= 2;
  const n = baseline.segment_count || 0;
  let level;
  if (mature || eligibleDays >= 2) level = 'mature';
  else if (n >= 30) level = 'maturing';    // >= 30 windows (60 mins) → maturing
  else if (n >= 15) level = 'provisional'; // >= 15 windows (30 mins) → provisional (Live monitoring active!)
  else level = 'cold_start';

  const auto_frozen = eligibleDays >= 3 && (n >= 30 || mature);
  const active_since = baseline.frozen_active_since || (auto_frozen ? (timestamps[0] ? new Date(timestamps[0]).toISOString() : new Date().toISOString()) : null);

  return {
    mature, level,
    auto_frozen,
    active_since,
    n_effective: r2(n_eff),
    distinct_days: eligibleDays,
    max_single_day_frac: r4(max_single_day_frac),
    q_signal: r4(q_signal), q_complete: r4(q_complete),
    q_context: r4(q_context), q_stability: r4(q_stability),
    bq: r4(bq), failed_gates: failed,
  };
}

/**
 * Cek apakah value aman untuk dimasukkan ke baseline fase cold-start.
 * Port dari robust_provisional_candidate() Python.
 */
export function isProvisionalCandidate(value, stat) {
  const cfg = MATURITY_CONFIG;
  if (!stat || stat.n < cfg.provisional_outlier_min_n) return true;
  const sd = stat.std || 0;
  if (sd < 1e-12) return true;
  return Math.abs(value - stat.mean) <= cfg.provisional_outlier_mad * 1.4826 * sd;
}


// ── Z-score & Scoring ─────────────────────────────────────────────────────────

/**
 * Hitung Z-score per fitur RR terhadap baseline personal.
 *
 * Z_f = (f(t) - mu_f) / sigma_f
 *
 * Penalty factor berdasarkan maturity:
 *  mature: x1.0 | maturing: x0.85 | provisional: x0.70 | cold_start: x0.50
 *
 * @param {{ hr_mean, sdnn, rmssd }} features
 * @param {object} baseline
 * @param {string} maturityLevel
 * @returns {{ z_hr, z_sdnn, z_rmssd }}
 */
export function computeRRZScores(features, baseline, maturityLevel) {
  const PENALTY = { mature: 1.0, maturing: 0.85, provisional: 0.70, cold_start: 0.50 };
  const penalty = PENALTY[maturityLevel] ?? 0.50;
  const eps = 1e-8;

  const zScore = (value, key) => {
    if (value === null || !isFinite(value)) return 0;
    const stat = baseline.stats?.[key];
    if (!stat || stat.n < 2 || stat.std < 0.001) return 0;
    const z = (value - stat.mean) / (stat.std + eps);
    return clip(z, -MAX_ABS_Z, MAX_ABS_Z) * penalty;
  };

  return {
    z_hr: zScore(features.hr_mean, 'mean_hr'),
    z_sdnn: zScore(features.sdnn, 'sdnn'),
    z_rmssd: zScore(features.rmssd, 'rmssd'),
  };
}

/**
 * Hitung composite anomaly score.
 *
 * score = SUM_f (weight_f x |Z_f|)
 *       = 0.50*|z_rmssd| + 0.30*|z_sdnn| + 0.20*|z_hr|
 *
 * @param {{ z_hr, z_sdnn, z_rmssd }} zScores
 * @returns {number}
 */
export function computeRRCompositeScore(zScores) {
  return (
    RR_WEIGHTS.z_rmssd * Math.abs(zScores.z_rmssd || 0) +
    RR_WEIGHTS.z_sdnn * Math.abs(zScores.z_sdnn || 0) +
    RR_WEIGHTS.z_hr * Math.abs(zScores.z_hr || 0)
  );
}

/**
 * Klasifikasi score terhadap threshold dinamis.
 *
 * @param {number} score
 * @param {string} maturityLevel
 * @returns {'Normal'|'Caution'|'Alert'}
 */
export function classifyRR(score, maturityLevel) {
  const thr = getDynamicThreshold(maturityLevel);
  if (score >= thr.ALERT) return 'Alert';
  if (score >= thr.CAUTION) return 'Caution';
  return 'Normal';
}


// ── Personalized Score (tanpa maturity penalty) ───────────────────────────────

/**
 * Hitung skor deviasi personal TANPA maturity penalty.
 *
 * Perbedaan dari computeRRZScores:
 *  - Tidak ada PENALTY factor (mature: 1.0, cold_start: 0.5, dll.)
 *  - Skor dinormalisasi oleh bobot yang tersedia
 *  - Kembalikan { score: null } jika bobot tersedia < MIN_SCORED_WEIGHT
 *
 * Caller bertanggung jawab memastikan baseline sudah mature sebelum
 * memanggil fungsi ini. Jika belum mature → kembalikan INSUFFICIENT_BASELINE.
 *
 * z   = clip((x − μ) / (σ + ε), −8, +8)
 * score = Σ(w_f × |z_f|) / Σ(w_f tersedia)
 *
 * @param {{ hr_mean, hr_delta, hr_slope, sdnn, rmssd, dfa_alpha1, motion_index }} features
 * @param {object} baseline - Mongoose Baseline document
 * @returns {{ score: number|null, z_scores: object, used_weight: number }}
 */
export function computePersonalizedScore(features, baseline) {
  // Mapping: feature key → stats key di baseline.stats
  const statKeyMap = {
    hr_mean: 'mean_hr',
    hr_delta: 'delta_hr',
    hr_slope: 'slope_hr',
    sdnn: 'sdnn',
    rmssd: 'rmssd',
    dfa_alpha1: 'dfa_alpha1',
    motion_index: 'motion_intensity',
  };

  const eps = 1e-8;
  const z_scores = {};
  let weightedSum = 0;
  let usedWeight = 0;

  for (const [feature, weight] of Object.entries(FEATURE_WEIGHTS)) {
    if (weight <= 0) continue;
    const value = features[feature];
    if (value === null || value === undefined || !isFinite(value)) continue;

    const statKey = statKeyMap[feature];
    const stat = baseline.stats?.[statKey];
    if (!stat || stat.n < 2 || stat.std < 0.001) continue;

    const z = clip((value - stat.mean) / (stat.std + eps), -MAX_ABS_Z, MAX_ABS_Z);
    z_scores[feature] = z;

    let d = 0;
    if (['hr_mean', 'hr_delta', 'hr_slope', 'motion_index'].includes(feature)) {
      d = Math.max(0, z); // Arah high
    } else if (['sdnn', 'rmssd'].includes(feature)) {
      d = Math.max(0, -z); // Arah low
    } else if (feature === 'dfa_alpha1') {
      d = Math.abs(z); // Two-sided
    }

    weightedSum += weight * d;
    usedWeight += weight;
  }

  if (usedWeight < MIN_SCORED_WEIGHT) {
    return { score: null, z_scores, used_weight: usedWeight };
  }

  return {
    score: weightedSum / usedWeight,
    z_scores,
    used_weight: usedWeight,
  };
}


// ── Provisional Score (Shrinkage) ─────────────────────────────────────────────

/**
 * Hitung skor deviasi sementara menggunakan Empirical Bayes Shrinkage.
 * 
 * lam = n_eff / (n_eff + kappa)
 * shrunk_mean = lam * personal_mean + (1 - lam) * pop_mean
 * shrunk_var = lam * personal_var + (1 - lam) * pop_var + lam*(1-lam)*(personal_mean - pop_mean)^2
 * 
 * @param {object} features
 * @param {object} baseline
 * @param {string} activityLabel
 * @returns {{ score: number|null, z_scores: object, used_weight: number }}
 */
export function computeProvisionalScore(features, baseline, activityLabel) {
  const statKeyMap = {
    hr_mean: 'mean_hr',
    sdnn: 'sdnn',
    rmssd: 'rmssd',
    dfa_alpha1: 'dfa_alpha1',
  };

  const eps = 1e-8;
  const kappa = 30; // Shrinkage weight parameter
  const z_scores = {};
  let weightedSum = 0;
  let usedWeight = 0;

  // Coba ambil priors berdasarkan aktivitas; jika tidak ada, gunakan 'Unknown'
  const priors = POPULATION_PRIORS[activityLabel] || POPULATION_PRIORS['Unknown'];
  // n_effective dari baseline, jika tidak tersedia, dekati dengan count / 2
  const n_eff = baseline.maturity_detail?.n_effective || ((baseline.segment_count || 0) / 2);
  const lam = n_eff / (n_eff + kappa);

  for (const [feature, weight] of Object.entries(FEATURE_WEIGHTS)) {
    if (weight <= 0) continue;
    const value = features[feature];
    if (value === null || value === undefined || !isFinite(value)) continue;

    // Untuk fitur tanpa population prior, fallback ke perhitungan personal biasa jika ada data
    const prior = priors[feature];
    const statKey = statKeyMap[feature] || feature;
    const stat = baseline.stats?.[statKey];

    let shrunk_mean, shrunk_sd;

    if (prior) {
      const prior_mean = prior.mean;
      const prior_var = prior.sd * prior.sd;

      const personal_mean = (stat && stat.n >= 1) ? stat.mean : prior_mean;
      const personal_var = (stat && stat.n >= 2) ? (stat.std * stat.std) : prior_var;

      shrunk_mean = lam * personal_mean + (1 - lam) * prior_mean;
      const shrunk_var = lam * personal_var + (1 - lam) * prior_var + lam * (1 - lam) * Math.pow(personal_mean - prior_mean, 2);
      shrunk_sd = Math.sqrt(Math.max(shrunk_var, eps));
    } else {
      // Tidak ada population prior untuk fitur ini (misal hr_delta, motion_index)
      if (!stat || stat.n < 2 || stat.std < 0.001) continue;
      shrunk_mean = stat.mean;
      shrunk_sd = stat.std;
    }

    const z = clip((value - shrunk_mean) / (shrunk_sd + eps), -MAX_ABS_Z, MAX_ABS_Z);
    z_scores[feature] = z;

    let d = 0;
    if (['hr_mean', 'hr_delta', 'hr_slope', 'motion_index'].includes(feature)) {
      d = Math.max(0, z); // Arah high
    } else if (['sdnn', 'rmssd'].includes(feature)) {
      d = Math.max(0, -z); // Arah low
    } else if (feature === 'dfa_alpha1') {
      d = Math.abs(z); // Two-sided
    }

    weightedSum += weight * d;
    usedWeight += weight;
  }

  if (usedWeight < MIN_SCORED_WEIGHT) {
    return { score: null, z_scores, used_weight: usedWeight };
  }

  return {
    score: weightedSum / usedWeight,
    z_scores,
    used_weight: usedWeight,
  };
}

// ── Temporal Status Machine ───────────────────────────────────────────────────

/**
 * Update state temporal dan kembalikan rr_status 9-state.
 *
 * Port dari TemporalTracker.update() Python.
 * CAPAR Section 8 — Physiological Episode State Machine with Hysteresis.
 *
 * @param {object} state - Mutable: { high_count, low_count, episode_active, cooldown }
 * @param {number} score
 * @param {string} maturityLevel
 * @param {object|null} tau - Learned thresholds: { tau_in, tau_out, tau_normal } atau null
 * @returns {{ rr_status, safe_to_update }}
 */
export function updateTemporalState(state, score, maturityLevel, tau = null) {
  const cfg = PERSISTENCE_CONFIG;
  const staticThr = getDynamicThreshold(maturityLevel);

  // Gunakan tau personal jika tersedia dan valid (Section 7.1 + 8.1 Hysteresis)
  // tau_normal <= tau_out < tau_in
  let tau_in, tau_out, tau_normal;
  if (tau && tau.tau_in && tau.tau_out && tau.tau_normal &&
    tau.tau_normal <= tau.tau_out && tau.tau_out < tau.tau_in) {
    tau_in = tau.tau_in;
    tau_out = tau.tau_out;
    tau_normal = tau.tau_normal;
  } else {
    // Fallback ke static threshold (maturity-based)
    tau_in = staticThr.CAUTION;  // entry threshold
    tau_out = staticThr.CAUTION * cfg.recovery_threshold_frac;
    tau_normal = tau_out * 0.7;
  }

  // Transisi BC → DEVIATION_CANDIDATE
  if (score >= tau_in) {
    state.high_count++;
    state.low_count = 0;
    if (state.high_count >= cfg.persistence_windows) {
      state.episode_active = true;
      state.cooldown = cfg.cooldown_windows;
      return { rr_status: 'PERSISTENT_DEVIATION', safe_to_update: false };
    }
    return { rr_status: 'DEVIATION_CANDIDATE', safe_to_update: false };
  }

  state.high_count = 0;

  if (state.episode_active) {
    // Dalam episode — cek recovery (score <= tau_out) dan recovered (score <= tau_normal)
    if (score <= tau_normal) {
      // Fast track: langsung cek recovered jika score sangat rendah
      state.low_count++;
      if (state.low_count >= cfg.recovery_windows) {
        state.episode_active = false;
        state.low_count = 0;
        state.cooldown = cfg.cooldown_windows;
        return { rr_status: 'RECOVERED', safe_to_update: false };
      }
    } else if (score <= tau_out) {
      // Dalam hysteresis band tau_normal < score <= tau_out — RECOVERING
      state.low_count++;
      if (state.low_count >= cfg.recovery_windows) {
        state.episode_active = false;
        state.low_count = 0;
        state.cooldown = cfg.cooldown_windows;
        return { rr_status: 'RECOVERED', safe_to_update: false };
      }
    } else {
      // score > tau_out tapi < tau_in — masih dalam hysteresis band, tahan state
      state.low_count = 0;
    }
    return { rr_status: 'RECOVERING', safe_to_update: false };
  }

  state.low_count = 0;
  if (state.cooldown > 0) {
    state.cooldown--;
    return { rr_status: 'NORMAL', safe_to_update: false };
  }
  return { rr_status: 'NORMAL', safe_to_update: true };
}

/** Buat state temporal baru. */
export function createTemporalState() {
  return { high_count: 0, low_count: 0, episode_active: false, cooldown: 0 };
}


// ── Baseline Update Builder ───────────────────────────────────────────────────

/**
 * Bangun objek $set MongoDB untuk update baseline dari satu window.
 *
 * Menggunakan Welford's Online Algorithm:
 *   delta  = x - mean_old
 *   mean   = mean_old + delta / n
 *   delta2 = x - mean_new
 *   M2     = M2_old + delta * delta2
 *   std    = sqrt(M2 / (n-1))
 *
 * @param {object} baseline - Mongoose Baseline doc
 * @param {{ hr_mean, sdnn, rmssd }} features
 * @param {{ q_signal, q_complete, q_context }} quality
 * @param {number} windowTimestamp - Epoch ms
 * @param {boolean} provisional
 * @returns {object|null} Objek untuk $set, atau null jika tidak ada update
 */
export function buildBaselineUpdateFields(baseline, features, quality, windowTimestamp, provisional) {
  if (baseline.is_frozen) return null;

  // Mapping fitur → stats key di baseline (extended untuk 7-fitur pipeline)
  const featureMap = {
    hr_mean: 'mean_hr',
    hr_delta: 'delta_hr',
    hr_slope: 'slope_hr',
    sdnn: 'sdnn',
    rmssd: 'rmssd',
    dfa_alpha1: 'dfa_alpha1',
    motion_index: 'motion_intensity',
  };
  const updateFields = {};
  let anyUpdated = false;

  for (const [featKey, statKey] of Object.entries(featureMap)) {
    const value = features[featKey];
    if (value === null || !isFinite(value)) continue;

    const stat = baseline.stats?.[statKey] || { n: 0, mean: 0, M2: 0, std: 0, min: null, max: null };

    // Outlier gate untuk mode provisional
    if (!isProvisionalCandidate(value, stat)) continue;

    // Welford update
    const newN = stat.n + 1;
    const delta = value - stat.mean;
    const newMean = stat.mean + delta / newN;
    const delta2 = value - newMean;
    const newM2 = stat.M2 + delta * delta2;
    const newStd = newN > 1 ? Math.sqrt(newM2 / (newN - 1)) : 0;

    updateFields[`stats.${statKey}`] = {
      n: newN,
      mean: r4(newMean),
      M2: r4(newM2),
      std: r4(newStd),
      min: stat.min === null ? value : Math.min(stat.min, value),
      max: stat.max === null ? value : Math.max(stat.max, value),
    };
    anyUpdated = true;
  }

  if (!anyUpdated) return null;

  const newCount = (baseline.segment_count || 0) + 1;
  return {
    ...updateFields,
    segment_count: newCount,
    is_mature: newCount >= 20,
    last_updated: new Date(),
  };
}


// ── Math Helpers ──────────────────────────────────────────────────────────────

function clip(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

/**
 * Regresi linear OLS: kembalikan [slope, intercept].
 * Digunakan untuk hr_slope.
 */
function _polyfit1(x, y) {
  const n = x.length;
  if (n < 2) return [0, y[0] || 0];
  const sumX = x.reduce((s, v) => s + v, 0);
  const sumY = y.reduce((s, v) => s + v, 0);
  const sumXY = x.reduce((s, v, i) => s + v * y[i], 0);
  const sumX2 = x.reduce((s, v) => s + v * v, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-12) return [0, sumY / n];
  const a = (n * sumXY - sumX * sumY) / denom;
  const b = (sumY - a * sumX) / n;
  return [a, b];
}
function r2(v) { return isFinite(v) ? parseFloat(v.toFixed(2)) : null; }
function r4(v) { return isFinite(v) ? parseFloat(v.toFixed(4)) : null; }

function medianOf(arr) {
  if (!arr || arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function linearInterp(x, xs, ys) {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  let lo = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    if (xs[i] <= x && x < xs[i + 1]) { lo = i; break; }
  }
  const t = (x - xs[lo]) / (xs[lo + 1] - xs[lo]);
  return ys[lo] + t * (ys[lo + 1] - ys[lo]);
}

function allClose(arr, tol = 1e-6) {
  if (arr.length < 2) return true;
  return arr.every(v => Math.abs(v - arr[0]) < tol);
}
