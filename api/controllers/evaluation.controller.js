/**
 * evaluation.controller.js — Metrik Evaluasi Layer 3
 *
 * Menghitung:
 *  - Precision, Recall, F1-Score, False Positive Rate (FPR)
 *  - AUC (trapezoidal ROC curve dari threshold sweep)
 *  - Detection Delay (waktu rata-rata dari onset nyata ke onset terdeteksi)
 *  - Metrik hipotesis: TCR, MER, TCI, CFPR
 *
 * Dua mode:
 *  1. Annotated Ground Truth  — jika admin/dokter sudah memberi label TP/FP pada event
 *  2. Score-Based (threshold sweep) — menghitung ROC & AUC dari anomaly_score segment
 *
 * Ground truth disimpan di field `ground_truth` pada AnomalyEvent
 * (di-set via PATCH /api/analysis/events/:eventId/label)
 */

import Segment from '../models/segment.model.js';
import AnomalyEvent from '../models/anomalyevent.model.js';

// ── Threshold sweep untuk ROC ─────────────────────────────────────────────────
// 50 titik dari 0 → 5 (rentang composite score)
const ROC_THRESHOLDS = Array.from({ length: 51 }, (_, i) => parseFloat((i * 0.1).toFixed(1)));

// ── Klasifikasi binary untuk metrik ──────────────────────────────────────────
// "positif" = Caution atau Alert (anomali terdeteksi)
const isAnomaly = (classification) => classification === 'Caution' || classification === 'Alert';

// ─────────────────────────────────────────────────────────────────────────────
// 1. CONFUSION MATRIX dari segment yang sudah dianalisis
//    Memerlukan field `ground_truth_label` pada Segment (diisi via annotation API).
//    Jika belum ada ground truth, mode ini tidak bisa digunakan.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hitung confusion matrix dari segment beranotasi.
 *
 * @param {string} userId
 * @returns {{ TP, FP, FN, TN, labeled_count }}
 */
export async function computeConfusionMatrix(userId) {
  const segments = await Segment.find({
    user_id:   userId,
    analyzed:  true,
    is_valid:  true,
    ground_truth_label: { $exists: true, $ne: null },
  }).select('classification ground_truth_label').lean();

  let TP = 0, FP = 0, FN = 0, TN = 0;

  for (const seg of segments) {
    const predicted = isAnomaly(seg.classification);
    const actual    = seg.ground_truth_label === 'anomaly'; // 'anomaly' | 'normal'

    if (predicted && actual)  TP++;
    else if (predicted && !actual) FP++;
    else if (!predicted && actual) FN++;
    else TN++;
  }

  return { TP, FP, FN, TN, labeled_count: segments.length };
}

/**
 * Hitung Precision, Recall, F1, FPR dari confusion matrix.
 *
 *   Precision = TP / (TP + FP)
 *   Recall    = TP / (TP + FN)   [Sensitivity / True Positive Rate]
 *   F1        = 2 × P × R / (P + R)
 *   FPR       = FP / (FP + TN)   [1 - Specificity]
 *   Specificity = TN / (TN + FP)
 *
 * @param {{ TP, FP, FN, TN }} cm
 */
export function computeClassificationMetrics(cm) {
  const { TP, FP, FN, TN } = cm;

  const precision    = (TP + FP) > 0 ? TP / (TP + FP) : 0;
  const recall       = (TP + FN) > 0 ? TP / (TP + FN) : 0;
  const specificity  = (TN + FP) > 0 ? TN / (TN + FP) : 0;
  const f1           = (precision + recall) > 0
    ? (2 * precision * recall) / (precision + recall)
    : 0;
  const fpr          = 1 - specificity; // False Positive Rate
  const accuracy     = (TP + TN + FP + FN) > 0
    ? (TP + TN) / (TP + FP + FN + TN)
    : 0;

  return {
    precision:   round4(precision),
    recall:      round4(recall),       // = sensitivity = TPR
    specificity: round4(specificity),
    f1:          round4(f1),
    fpr:         round4(fpr),
    accuracy:    round4(accuracy),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ROC CURVE & AUC dari threshold sweep (Score-Based)
//    Tidak memerlukan external ground truth.
//    Gunakan ground_truth_label jika tersedia, otherwise tidak bisa compute AUC.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hitung kurva ROC dengan sweep threshold pada anomaly_score.
 * Setiap titik threshold → (FPR, TPR) satu titik di kurva ROC.
 *
 * @param {string} userId
 * @returns {{ roc: [{threshold, fpr, tpr}], auc: number }}
 */
export async function computeROCandAUC(userId) {
  // Ambil semua segment beranotasi dengan anomaly_score
  const segments = await Segment.find({
    user_id:   userId,
    analyzed:  true,
    is_valid:  true,
    ground_truth_label: { $exists: true, $ne: null },
    anomaly_score:      { $ne: null },
  }).select('anomaly_score ground_truth_label').lean();

  if (segments.length === 0) {
    return { roc: [], auc: null, message: 'Belum ada data beranotasi untuk AUC.' };
  }

  const rocPoints = [];

  for (const threshold of ROC_THRESHOLDS) {
    let TP = 0, FP = 0, FN = 0, TN = 0;

    for (const seg of segments) {
      const predicted = (seg.anomaly_score ?? 0) >= threshold;
      const actual    = seg.ground_truth_label === 'anomaly';

      if (predicted && actual)  TP++;
      else if (predicted && !actual) FP++;
      else if (!predicted && actual) FN++;
      else TN++;
    }

    const tpr = (TP + FN) > 0 ? TP / (TP + FN) : 0; // Recall / Sensitivity
    const fpr = (FP + TN) > 0 ? FP / (FP + TN) : 0; // False Positive Rate

    rocPoints.push({ threshold, fpr: round4(fpr), tpr: round4(tpr) });
  }

  // Sort by FPR untuk integrasi trapezoid
  rocPoints.sort((a, b) => a.fpr - b.fpr);

  const auc = computeAUCTrapezoid(rocPoints);

  return { roc: rocPoints, auc: round4(auc) };
}

/**
 * AUC dengan metode trapezoidal rule.
 *
 * AUC = Σ (FPR_i - FPR_i-1) × (TPR_i + TPR_i-1) / 2
 *
 * @param {Array<{fpr, tpr}>} rocPoints - sorted by fpr ASC
 */
function computeAUCTrapezoid(rocPoints) {
  let auc = 0;
  for (let i = 1; i < rocPoints.length; i++) {
    const dx   = rocPoints[i].fpr - rocPoints[i - 1].fpr;
    const avgY = (rocPoints[i].tpr + rocPoints[i - 1].tpr) / 2;
    auc += dx * avgY;
  }
  return Math.abs(auc); // abs agar negatif area tidak masalah
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. DETECTION DELAY
//    Jika event anotasi memiliki `actual_onset_time` (waktu nyata onset),
//    kita bisa hitung rata-rata selisih deteksi sistem vs onset nyata.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hitung rata-rata detection delay dari event yang beranotasi.
 *
 * Detection Delay = onset_time_detected - actual_onset_time
 *
 * Negatif = sistem deteksi lebih awal (early warning)
 * Positif = sistem deteksi terlambat
 *
 * @param {string} userId
 * @returns {{ mean_delay_ms, min_delay_ms, max_delay_ms, count }}
 */
export async function computeDetectionDelay(userId) {
  const events = await AnomalyEvent.find({
    user_id: userId,
    actual_onset_time: { $exists: true, $ne: null },
  }).select('onset_time actual_onset_time').lean();

  if (events.length === 0) {
    return { mean_delay_ms: null, count: 0, message: 'Belum ada event beranotasi dengan actual_onset_time.' };
  }

  const delays = events.map(e => e.onset_time - e.actual_onset_time);

  return {
    mean_delay_ms: round2(delays.reduce((s, v) => s + v, 0) / delays.length),
    min_delay_ms:  Math.min(...delays),
    max_delay_ms:  Math.max(...delays),
    count:         delays.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. METRIK HIPOTESIS (H1a, H2a, H3a) — tidak butuh ground truth eksternal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * H1a — Temporal Coverage Ratio (TCR), Missed Event Rate (MER),
 *        Trajectory Continuity Index (TCI)
 *
 * Semua dihitung dari data segment yang ada di DB.
 * MER: bandingkan event yang terdeteksi continuous vs jika sampling setiap N menit.
 *
 * @param {string} userId
 * @param {number} intermittentIntervalMin - interval sampling simulasi intermiten (default 15 menit)
 */
export async function computeH1aMetrics(userId, intermittentIntervalMin = 15) {
  const WINDOW_MS = 3 * 60 * 1000;
  const INTERMITTEN_MS = intermittentIntervalMin * 60 * 1000;

  const [allSegments, anomalyEvents] = await Promise.all([
    Segment.find({ user_id: userId, is_valid: true })
      .sort({ window_start: 1 })
      .select('window_start window_end analyzed')
      .lean(),
    AnomalyEvent.find({ user_id: userId })
      .select('onset_time')
      .lean(),
  ]);

  if (allSegments.length === 0) return { error: 'Tidak ada segment' };

  const totalWindows   = allSegments.length;
  const validWindows   = allSegments.filter(s => s.analyzed).length;
  const firstTs        = allSegments[0].window_start;
  const lastTs         = allSegments[allSegments.length - 1].window_end;
  const totalDuration  = lastTs - firstTs;
  const observedDuration = totalWindows * WINDOW_MS;

  // TCR
  const TCR = totalDuration > 0 ? observedDuration / totalDuration : 0;

  // TCI
  const TCI = totalWindows > 0 ? validWindows / totalWindows : 0;

  // Simulasi intermiten: ambil hanya setiap N menit
  const intermittentTimestamps = new Set();
  for (let t = firstTs; t <= lastTs; t += INTERMITTEN_MS) {
    intermittentTimestamps.add(Math.floor(t / WINDOW_MS) * WINDOW_MS);
  }

  // Event yang "hilang" = event yang onset-nya tidak jatuh di window intermiten
  const missedEvents = anomalyEvents.filter(ev => {
    const windowKey = Math.floor(ev.onset_time / WINDOW_MS) * WINDOW_MS;
    return !intermittentTimestamps.has(windowKey);
  });

  const MER = anomalyEvents.length > 0
    ? missedEvents.length / anomalyEvents.length
    : 0;

  return {
    TCR: round4(TCR),
    TCI: round4(TCI),
    MER: round4(MER),
    total_windows:             totalWindows,
    valid_analyzed_windows:    validWindows,
    total_events_continuous:   anomalyEvents.length,
    missed_events_intermittent: missedEvents.length,
    intermittent_interval_min:  intermittentIntervalMin,
  };
}

/**
 * H2a — Contextual False Positive Reduction (CFPR)
 *
 * Bandingkan: berapa banyak segment yang akan di-flag jika pakai Z-score global
 * vs Z-score kontekstual.
 *
 * Z_global dihitung dari mean & std SEMUA segment user (tanpa split aktivitas).
 * Z_context sudah tersimpan di segment.anomaly_score.
 *
 * @param {string} userId
 * @param {number} threshold - sama dengan THRESHOLD.CAUTION (default 1.5)
 */
export async function computeH2aMetrics(userId, threshold = 1.5) {
  const segments = await Segment.find({
    user_id:  userId,
    analyzed: true,
    is_valid: true,
  }).select('anomaly_score classification z_scores activity_label').lean();

  if (segments.length === 0) return { error: 'Tidak ada segment teranalisis' };

  // Hitung global Z_HR dari semua segment (tanpa konteks aktivitas)
  const hrZScores = segments
    .map(s => s.z_scores?.z_hr)
    .filter(z => z !== null && z !== undefined && !isNaN(z));

  if (hrZScores.length === 0) return { error: 'Tidak ada z_hr tersedia' };

  const globalMean = hrZScores.reduce((s, v) => s + v, 0) / hrZScores.length;
  const globalStd  = Math.sqrt(hrZScores.reduce((s, v) => s + (v - globalMean) ** 2, 0) / hrZScores.length);

  // Flag dengan Z_global
  const FP_global = segments.filter(s => {
    if (s.z_scores?.z_hr === null) return false;
    const zGlobal = globalStd > 0 ? Math.abs((s.z_scores.z_hr - globalMean) / globalStd) : 0;
    return zGlobal >= threshold && s.classification === 'Normal'; // flagged by global but actually Normal
  }).length;

  // Flag dengan Z_context (sudah tersimpan)
  const FP_context = segments.filter(s =>
    isAnomaly(s.classification) && s.anomaly_score < threshold
  ).length;

  const CFPR = FP_global > 0
    ? (FP_global - FP_context) / FP_global
    : 0;

  return {
    FP_global,
    FP_context,
    CFPR:             round4(CFPR),
    total_segments:   segments.length,
    threshold_used:   threshold,
    interpretation:   CFPR > 0
      ? `Konteks aktivitas mengurangi false positive sebesar ${(CFPR * 100).toFixed(1)}%`
      : 'Tidak ada pengurangan false positive signifikan',
  };
}

/**
 * H3a — Trajectory Relevance Score (TRS)
 *
 * TRS = 0.4 × TDM + 0.4 × APD_norm + 0.2 × Recovery_norm
 *
 * Bandingkan antara point-based anomaly (hanya score >= threshold di window tunggal)
 * vs trajectory-aware (event dengan persistence >= 2).
 *
 * @param {string} userId
 */
export async function computeH3aMetrics(userId) {
  const WINDOW_MS = 3 * 60 * 1000;

  const [segments, events] = await Promise.all([
    Segment.find({ user_id: userId, analyzed: true, is_valid: true })
      .select('anomaly_score classification z_scores window_start window_end')
      .sort({ window_start: 1 })
      .lean(),
    AnomalyEvent.find({ user_id: userId })
      .select('onset_time peak_score duration_ms trajectory classification')
      .lean(),
  ]);

  // Point-based anomaly: window tunggal di atas threshold (tanpa persistence check)
  const THRESHOLD_CAUTION = 1.5;
  const pointAnomalies     = segments.filter(s => (s.anomaly_score ?? 0) >= THRESHOLD_CAUTION);
  const trajectoryAnomalies = events.filter(e => e.trajectory?.persistence >= 2);

  // TDM: rata-rata |z-score| dari seluruh anomaly window
  const zScoreAbs = segments
    .filter(s => isAnomaly(s.classification))
    .map(s => s.anomaly_score ?? 0);
  const TDM = zScoreAbs.length > 0
    ? zScoreAbs.reduce((s, v) => s + v, 0) / zScoreAbs.length
    : 0;

  // APD: rata-rata durasi persistensi (dalam satuan window)
  const maxPersistence = Math.max(...events.map(e => e.trajectory?.persistence ?? 1), 1);
  const avgPersistence = events.length > 0
    ? events.reduce((s, e) => s + (e.trajectory?.persistence ?? 0), 0) / events.length
    : 0;
  const APD_norm = maxPersistence > 0 ? avgPersistence / maxPersistence : 0;

  // Recovery: rata-rata recovery time yang dinormalisasi
  const recoveries = events
    .map(e => e.trajectory?.recovery_time_ms)
    .filter(r => r !== null && r !== undefined && r > 0);
  const maxRecovery = Math.max(...recoveries, 1);
  const avgRecovery = recoveries.length > 0
    ? recoveries.reduce((s, v) => s + v, 0) / recoveries.length
    : 0;
  const Recovery_norm = maxRecovery > 0 ? avgRecovery / maxRecovery : 0;

  // TRS
  const TRS = (0.4 * TDM) + (0.4 * APD_norm) + (0.2 * Recovery_norm);

  return {
    TRS:                    round4(TRS),
    TDM:                    round4(TDM),
    APD_norm:               round4(APD_norm),
    Recovery_norm:          round4(Recovery_norm),
    point_anomaly_count:    pointAnomalies.length,
    trajectory_event_count: trajectoryAnomalies.length,
    false_alarm_reduction:  pointAnomalies.length > 0
      ? round4((pointAnomalies.length - trajectoryAnomalies.length) / pointAnomalies.length)
      : 0,
    avg_persistence_windows: round2(avgPersistence),
    avg_recovery_ms:         round2(avgRecovery),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. RINGKASAN METRIK LENGKAP (dipanggil dari route)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ambil semua metrik evaluasi untuk satu user sekaligus.
 * Endpoint: GET /api/analysis/metrics/:userId
 */
export async function getFullMetrics(userId) {
  const [cm, roc, delay, h1a, h2a, h3a] = await Promise.allSettled([
    computeConfusionMatrix(userId),
    computeROCandAUC(userId),
    computeDetectionDelay(userId),
    computeH1aMetrics(userId),
    computeH2aMetrics(userId),
    computeH3aMetrics(userId),
  ]);

  const resolve = (settled) =>
    settled.status === 'fulfilled' ? settled.value : { error: settled.reason?.message };

  const cmData = resolve(cm);
  const classMetrics = cmData.TP !== undefined
    ? computeClassificationMetrics(cmData)
    : null;

  return {
    confusion_matrix:       cmData,
    classification_metrics: classMetrics, // precision, recall, f1, fpr, accuracy
    roc_and_auc:            resolve(roc),
    detection_delay:        resolve(delay),
    hypothesis: {
      H1a: resolve(h1a), // TCR, TCI, MER
      H2a: resolve(h2a), // CFPR
      H3a: resolve(h3a), // TRS
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const round2 = (v) => typeof v === 'number' && !isNaN(v) ? parseFloat(v.toFixed(2)) : null;
const round4 = (v) => typeof v === 'number' && !isNaN(v) ? parseFloat(v.toFixed(4)) : null;
