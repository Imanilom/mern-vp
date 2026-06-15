/**
 * analysis.controller.js — Layer 3: Analisis & Insight
 *
 * Pipeline per user:
 *  1. Ambil segment yang belum dianalisis (analyzed: false, is_valid: true)
 *  2. Ambil atau buat baseline untuk user+activity+time_period
 *  3. Hitung Z-score deviasi per fitur (context-aware)
 *  4. Hitung trajectory: delta_HR, slope, persistence, recovery, DFA α1
 *  5. Hitung composite anomaly score (weighted Z-scores)
 *  6. Klasifikasi: Normal / Caution / Alert
 *  7. Update segment dengan score & klasifikasi
 *  8. Generate / update AnomalyEvent
 *  9. Update baseline dengan data baru (Welford incremental)
 */

import Segment from '../models/segment.model.js';
import Baseline from '../models/baseline.model.js';
import AnomalyEvent from '../models/anomalyevent.model.js';
import User from '../models/user.model.js';

// ── Konfigurasi scoring ───────────────────────────────────────────────────────

/**
 * Bobot tiap fitur dalam composite score.
 * Total = 1.0
 */
const WEIGHTS = {
  z_hr:     0.30,
  z_rr:     0.20,
  z_sdnn:   0.15,
  z_rmssd:  0.15,
  z_motion: 0.10,
  z_dfa:    0.10,
};

/**
 * Threshold klasifikasi composite score.
 * Score dihitung sebagai weighted sum |Z-scores|.
 */
const THRESHOLD = {
  CAUTION: 1.5,   // ≥ 1.5 → Caution
  ALERT:   3.0,   // ≥ 3.0 → Alert
};

/**
 * Minimum window berturut-turut di atas threshold sebelum event dibuat.
 * Mengurangi false alarm dari artefak sesaat.
 */
const PERSISTENCE_MIN = {
  CAUTION: 2,   // 2 × 3 menit = 6 menit
  ALERT:   3,   // 3 × 3 menit = 9 menit
};

/**
 * Minimum sample baseline agar Z-score dipercaya.
 * Sebelum matang, score tetap dihitung tapi dengan confidence rendah.
 */
const BASELINE_MATURITY = 20;

/**
 * Referensi DFA α1 yang sehat.
 * Deviasi dari nilai ini dianggap sebagai anomali.
 * α1 ~ 1.0 = normal long-range correlations
 */
const DFA_HEALTHY_ALPHA1 = 1.0;
const DFA_NORM_FACTOR    = 0.5; // normalisasi deviasi DFA

// ── Entry point Layer 3 ───────────────────────────────────────────────────────

/**
 * Jalankan Layer 3 untuk semua user yang punya segment belum dianalisis.
 * Dipanggil dari cron job di index.js.
 */
export async function runAnalysisPipeline() {
  try {
    console.log('[Layer3] Memulai analisis...');

    // Ambil daftar user dengan segment yang belum dianalisis
    const pendingUserIds = await Segment.distinct('user_id', {
      analyzed: false,
      is_valid: true,
    });

    if (pendingUserIds.length === 0) {
      console.log('[Layer3] Tidak ada segment baru untuk dianalisis.');
      return { success: true, analyzed: 0, eventsCreated: 0 };
    }

    let totalAnalyzed = 0;
    let totalEvents = 0;

    for (const userId of pendingUserIds) {
      try {
        const result = await analyzeUser(userId);
        totalAnalyzed += result.analyzed;
        totalEvents   += result.events;
      } catch (err) {
        console.error(`[Layer3] Error user ${userId}:`, err.message);
      }
    }

    console.log(`[Layer3] Selesai: ${totalAnalyzed} segment dianalisis, ${totalEvents} event dibuat/diperbarui.`);
    return { success: true, analyzed: totalAnalyzed, eventsCreated: totalEvents };

  } catch (err) {
    console.error('[Layer3] Error utama:', err.message);
    return { success: false, error: err.message };
  }
}

// ── Analisis per user ─────────────────────────────────────────────────────────

async function analyzeUser(userId) {
  const BATCH = 200;
  let totalAnalyzed = 0;
  let totalEvents = 0;

  // State persistence: track window berturut-turut di atas threshold
  // Key: activity, Value: { count, startSegment, scores, segIds, peakScore, peakSeg }
  const persistenceState = {};

  // Ambil 1 segment sebelumnya untuk hitung delta_HR antar window
  let prevSegment = await Segment.findOne({
    user_id: userId,
    is_valid: true,
    analyzed: true,
  }).sort({ window_start: -1 }).lean();

  // Proses segment berurutan (sorted by window_start ASC)
  let skip = 0;
  while (true) {
    const segments = await Segment.find({
      user_id: userId,
      is_valid: true,
      analyzed: false,
    })
      .sort({ window_start: 1 })
      .skip(skip)
      .limit(BATCH)
      .lean();

    if (segments.length === 0) break;

    const bulkOps = [];

    for (const seg of segments) {
      const activity   = seg.activity_label || 'Unknown';
      const timePeriod = getTimePeriod(seg.window_start);

      // ── Langkah 1: Ambil baseline ──────────────────────────────────────────
      const baseline = await getOrCreateBaseline(userId, activity, timePeriod);

      // ── Langkah 2: Hitung Z-scores ─────────────────────────────────────────
      const zScores = computeZScores(seg.features, baseline, seg);

      // ── Langkah 3: Trajectory ──────────────────────────────────────────────
      const trajectory = computeTrajectory(seg, prevSegment, persistenceState, activity);

      // ── Langkah 4: Composite anomaly score ────────────────────────────────
      const score = computeCompositeScore(zScores);

      // ── Langkah 5: Klasifikasi ─────────────────────────────────────────────
      const classification = classify(score);

      // ── Langkah 6: Update persistence state ───────────────────────────────
      const eventCreated = await updatePersistence(
        userId,
        seg,
        score,
        classification,
        zScores,
        trajectory,
        persistenceState,
        activity,
      );
      if (eventCreated) totalEvents++;

      // ── Langkah 7: Update baseline (Welford) ──────────────────────────────
      await updateBaseline(baseline, seg.features);

      // ── Langkah 8: Kumpulkan bulk update untuk segment ────────────────────
      bulkOps.push({
        updateOne: {
          filter: { _id: seg._id },
          update: {
            $set: {
              analyzed: true,
              anomaly_score: round2(score),
              classification,
              z_scores: {
                z_hr:     round2(zScores.z_hr),
                z_rr:     round2(zScores.z_rr),
                z_sdnn:   round2(zScores.z_sdnn),
                z_rmssd:  round2(zScores.z_rmssd),
                z_motion: round2(zScores.z_motion),
                z_dfa:    round2(zScores.z_dfa),
              },
            },
          },
        },
      });

      prevSegment = seg;
      totalAnalyzed++;
    }

    // Bulk write segment updates
    if (bulkOps.length > 0) {
      await Segment.bulkWrite(bulkOps, { ordered: false });
    }

    if (segments.length < BATCH) break;
    skip += BATCH;
  }

  // Tutup event yang masih open jika score sudah kembali Normal
  await closeResolvedEvents(userId, persistenceState);

  return { analyzed: totalAnalyzed, events: totalEvents };
}

// ── Baseline helpers ──────────────────────────────────────────────────────────

/**
 * Ambil baseline dari DB, atau buat baru jika belum ada.
 */
async function getOrCreateBaseline(userId, activity, timePeriod) {
  let baseline = await Baseline.findOne({ user_id: userId, activity, time_period: timePeriod });

  if (!baseline) {
    baseline = await Baseline.create({
      user_id: userId,
      activity,
      time_period: timePeriod,
    });
  }

  return baseline;
}

/**
 * Update baseline dengan data baru menggunakan Welford's Online Algorithm.
 * O(1) per update — tidak perlu menyimpan data historis.
 */
async function updateBaseline(baseline, features) {
  const featureKeys = ['mean_hr', 'std_hr', 'delta_hr', 'slope_hr',
    'mean_rr', 'sdnn', 'rmssd', 'rolling_variance', 'motion_intensity', 'dfa_alpha1'];

  const updateFields = {};

  for (const key of featureKeys) {
    const value = features?.[key];
    if (value === null || value === undefined || isNaN(value)) continue;

    const stat = baseline.stats[key] || { n: 0, mean: 0, M2: 0, std: 0, min: null, max: null };

    // Welford update
    stat.n += 1;
    const delta  = value - stat.mean;
    stat.mean   += delta / stat.n;
    const delta2 = value - stat.mean;
    stat.M2     += delta * delta2;
    stat.std     = stat.n > 1 ? Math.sqrt(stat.M2 / (stat.n - 1)) : 0;
    stat.min     = stat.min === null ? value : Math.min(stat.min, value);
    stat.max     = stat.max === null ? value : Math.max(stat.max, value);

    updateFields[`stats.${key}`] = stat;
  }

  const newCount   = baseline.segment_count + 1;
  const isMature   = newCount >= BASELINE_MATURITY;

  await Baseline.updateOne(
    { _id: baseline._id },
    {
      $set: {
        ...updateFields,
        segment_count: newCount,
        is_mature: isMature,
        last_updated: new Date(),
      },
    }
  );

  // Refresh in-memory untuk session saat ini
  baseline.segment_count = newCount;
  baseline.is_mature     = isMature;
  for (const [k, v] of Object.entries(updateFields)) {
    const shortKey = k.replace('stats.', '');
    if (baseline.stats) baseline.stats[shortKey] = v;
  }
}

// ── Z-score computation ───────────────────────────────────────────────────────

/**
 * Hitung Z-score context-aware untuk setiap fitur:
 *   Z_f = (f(t) - μ_f,a) / σ_f,a
 *
 * Jika baseline belum matang (n < MATURITY_THRESHOLD), Z-score dihitung
 * tapi diberi penalty factor 0.5 agar tidak terlalu agresif.
 */
function computeZScores(features, baseline, seg) {
  const maturityFactor = baseline.is_mature ? 1.0 : 0.5;

  const zScore = (value, key) => {
    if (value === null || value === undefined || isNaN(value)) return 0;
    const stat = baseline.stats?.[key];
    if (!stat || stat.n < 2 || stat.std < 0.001) return 0;
    return ((value - stat.mean) / stat.std) * maturityFactor;
  };

  // DFA α1: deviasi dari referensi sehat (1.0), tidak pakai baseline personal
  const dfaVal = features?.dfa_alpha1;
  const zDfa   = dfaVal !== null && dfaVal !== undefined && !isNaN(dfaVal)
    ? Math.min(Math.abs(dfaVal - DFA_HEALTHY_ALPHA1) / DFA_NORM_FACTOR, 4) * maturityFactor
    : 0;

  return {
    z_hr:     zScore(features?.mean_hr,          'mean_hr'),
    z_rr:     zScore(features?.mean_rr,           'mean_rr'),
    z_sdnn:   zScore(features?.sdnn,              'sdnn'),
    z_rmssd:  zScore(features?.rmssd,             'rmssd'),
    z_motion: zScore(features?.motion_intensity,  'motion_intensity'),
    z_dfa:    zDfa,
  };
}

// ── Composite score ───────────────────────────────────────────────────────────

/**
 * Hitung composite anomaly score dari Z-scores terbobot.
 *   score = Σ weight_f × |Z_f|
 *
 * Score ≥ THRESHOLD.CAUTION → Caution
 * Score ≥ THRESHOLD.ALERT   → Alert
 */
function computeCompositeScore(zScores) {
  return (
    WEIGHTS.z_hr     * Math.abs(zScores.z_hr)     +
    WEIGHTS.z_rr     * Math.abs(zScores.z_rr)     +
    WEIGHTS.z_sdnn   * Math.abs(zScores.z_sdnn)   +
    WEIGHTS.z_rmssd  * Math.abs(zScores.z_rmssd)  +
    WEIGHTS.z_motion * Math.abs(zScores.z_motion) +
    WEIGHTS.z_dfa    * Math.abs(zScores.z_dfa)
  );
}

// ── Klasifikasi ───────────────────────────────────────────────────────────────

function classify(score) {
  if (score >= THRESHOLD.ALERT)   return 'Alert';
  if (score >= THRESHOLD.CAUTION) return 'Caution';
  return 'Normal';
}

// ── Trajectory analysis ───────────────────────────────────────────────────────

/**
 * Hitung fitur trajectory untuk satu window.
 *
 * - delta_hr:   perubahan mean_hr dari window sebelumnya
 * - slope_hr:   slope HR di dalam window (dari features.slope_hr)
 * - persistence: dihitung dari persistenceState (diupdate oleh updatePersistence)
 * - dfa_alpha1: dari features
 * - dfa_alpha2: placeholder (null — untuk implementasi future)
 */
function computeTrajectory(seg, prevSeg, persistenceState, activity) {
  const currHr = seg.features?.mean_hr ?? 0;
  const prevHr = prevSeg?.features?.mean_hr ?? currHr;
  const deltaHr = currHr - prevHr;

  const state = persistenceState[activity];

  return {
    delta_hr:         round2(deltaHr),
    slope_hr:         round4(seg.features?.slope_hr ?? 0),
    persistence:      state?.count ?? 0,
    dfa_alpha1:       seg.features?.dfa_alpha1 ?? null,
    dfa_alpha2:       seg.features?.dfa_alpha2 ?? null, // long-range correlation
    recovery_time_ms: null, // diisi saat event di-close
  };
}

// ── Persistence & Event generation ───────────────────────────────────────────

/**
 * Update state persistence per aktivitas dan buat AnomalyEvent jika perlu.
 *
 * Logic:
 *  - Jika score >= CAUTION: tambah counter, jika counter >= PERSISTENCE_MIN → buat/update event
 *  - Jika score < CAUTION: reset counter, tutup event open jika ada
 *
 * @returns {boolean} true jika event baru dibuat
 */
async function updatePersistence(
  userId, seg, score, classification,
  zScores, trajectory, persistenceState, activity
) {
  if (!persistenceState[activity]) {
    persistenceState[activity] = {
      count: 0,
      segIds: [],
      scores: [],
      peakScore: 0,
      peakSeg: null,
      startSeg: null,
      openEventId: null,
    };
  }

  const state = persistenceState[activity];
  let eventCreated = false;

  if (classification !== 'Normal') {
    // Akumulasi window anomali
    state.count++;
    state.segIds.push(seg._id);
    state.scores.push(score);

    if (score > state.peakScore) {
      state.peakScore = score;
      state.peakSeg   = seg;
    }
    if (!state.startSeg) {
      state.startSeg = seg;
    }

    // Cek persistence threshold
    const minRequired = classification === 'Alert'
      ? PERSISTENCE_MIN.ALERT
      : PERSISTENCE_MIN.CAUTION;

    if (state.count >= minRequired && !state.openEventId) {
      // Buat event baru
      const event = await AnomalyEvent.create({
        user_id:        userId,
        device_id:      seg.device_id,
        activity:       activity,
        onset_time:     state.startSeg.window_start,
        onset_score:    state.scores[0],
        peak_time:      state.peakSeg.window_start,
        peak_score:     state.peakScore,
        classification: classify(state.peakScore),
        z_scores_at_peak: zScores,
        trajectory: {
          delta_hr:    trajectory.delta_hr,
          slope_hr:    trajectory.slope_hr,
          persistence: state.count,
          dfa_alpha1:  state.peakSeg.features?.dfa_alpha1 ?? null,
          dfa_alpha2:  state.peakSeg.features?.dfa_alpha2 ?? null,
          recovery_time_ms: null,
        },
        segment_ids: state.segIds,
        status: 'open',
      });

      state.openEventId = event._id;
      eventCreated = true;
      console.log(`[Layer3] Event ${classify(state.peakScore)} dibuat untuk user=${userId} aktivitas=${activity}`);

    } else if (state.openEventId) {
      // Update event yang sudah ada (peak score mungkin naik)
      await AnomalyEvent.updateOne(
        { _id: state.openEventId },
        {
          $set: {
            peak_time:      state.peakSeg.window_start,
            peak_score:     state.peakScore,
            classification: classify(state.peakScore),
            'trajectory.persistence': state.count,
            'trajectory.dfa_alpha1':  state.peakSeg.features?.dfa_alpha1 ?? null,
            'z_scores_at_peak':       zScores,
          },
          $push: { segment_ids: seg._id },
        }
      );
    }

  } else {
    // Score kembali Normal — reset state
    if (state.openEventId && state.count > 0) {
      // Hitung recovery time: dari peak sampai window Normal ini
      const recoveryMs = seg.window_end - (state.peakSeg?.window_start ?? seg.window_start);

      await AnomalyEvent.updateOne(
        { _id: state.openEventId },
        {
          $set: {
            resolved_time:              seg.window_start,
            duration_ms:                seg.window_start - (state.startSeg?.window_start ?? seg.window_start),
            status:                     'closed',
            'trajectory.recovery_time_ms': Math.max(recoveryMs, 0),
          },
        }
      );

      console.log(`[Layer3] Event closed untuk user=${userId} aktivitas=${activity}, recovery=${recoveryMs}ms`);
    }

    // Reset state
    state.count      = 0;
    state.segIds     = [];
    state.scores     = [];
    state.peakScore  = 0;
    state.peakSeg    = null;
    state.startSeg   = null;
    state.openEventId = null;
  }

  return eventCreated;
}

/**
 * Tutup semua event yang masih open di akhir batch
 * (jika tidak ada window Normal yang menutupnya dalam batch ini).
 */
async function closeResolvedEvents(userId, persistenceState) {
  for (const [activity, state] of Object.entries(persistenceState)) {
    if (state.openEventId && state.count === 0) {
      await AnomalyEvent.updateOne(
        { _id: state.openEventId, status: 'open' },
        { $set: { status: 'closed' } }
      );
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Tentukan periode waktu dari epoch ms.
 * night: 00–06, morning: 06–12, afternoon: 12–18, evening: 18–24
 */
export function getTimePeriod(timestampMs) {
  const hour = new Date(timestampMs).getUTCHours() + 7; // WIB offset
  const h    = hour % 24;
  if (h >= 6  && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  if (h >= 18 && h < 24) return 'evening';
  return 'night';
}

const round2 = (v) => typeof v === 'number' && !isNaN(v) ? parseFloat(v.toFixed(2)) : null;
const round4 = (v) => typeof v === 'number' && !isNaN(v) ? parseFloat(v.toFixed(4)) : null;

// ── Query helpers untuk dashboard ─────────────────────────────────────────────

/**
 * Ambil event terbaru untuk satu user (untuk dashboard).
 */
export async function getRecentEvents(userId, limit = 20) {
  return AnomalyEvent.find({ user_id: userId })
    .sort({ onset_time: -1 })
    .limit(limit)
    .lean();
}

/**
 * Ambil baseline semua aktivitas untuk satu user (untuk dashboard).
 */
export async function getUserBaselines(userId) {
  return Baseline.find({ user_id: userId })
    .select('-stats.mean_hr.M2 -stats.mean_rr.M2 -stats.sdnn.M2 -stats.rmssd.M2') // Sembunyikan internal Welford state
    .lean();
}

/**
 * Ambil N segment terbaru beserta score & klasifikasi (untuk grafik dashboard).
 */
export async function getAnalyzedSegments(userId, limit = 100) {
  return Segment.find({
    user_id: userId,
    analyzed: true,
    is_valid: true,
  })
    .sort({ window_start: -1 })
    .limit(limit)
    .select('window_start window_end activity_label anomaly_score classification z_scores features.mean_hr features.mean_rr features.dfa_alpha1 features.dfa_alpha2')
    .lean();
}
