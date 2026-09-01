/**
 * zeroshot.controller.js  (v3 — User-Centric 360° Explain & Longitudinal Grounding)
 * ─────────────────────────────────────────────────────────────────────────────
 * Explain (Zero-Shot) Controller — Analisis Longitudinal Berpusat pada Pengguna (User-Centric)
 *
 * Menganalisis seluruh rekam jejak fisiologis pengguna:
 *   [1] Profil & Penggunaan Aplikasi (Frekuensi rekam, rentang waktu, total data, distribusi aktivitas)
 *   [2] Portofolio Baseline (Baseline yang dimiliki, yang sudah mature, dan baseline yang belum tercapai/gap)
 *   [3] Beban Anomali & Riwayat Disregulasi (Anomaly Burden, frekuensi Caution/Alert, relapse)
 *   [4] Sampel Monitoring Real-Time Terbaru
 *   [5] Experience Memory & Pola Pembelajaran Sistem
 *   [6] Prediksi Markov & Kinetik Pemulihan Otonom
 *   [7] Tri-Tier Clinical Grounding (State → Digital Autonomic Phenotype → Clinical Risk Stratification)
 */

import Baseline        from '../models/baseline.model.js';
import Segment         from '../models/segment.model.js';
import AnomalyEvent    from '../models/anomalyevent.model.js';
import StateTransition from '../models/state_transition.model.js';
import User            from '../models/user.model.js';
import PolarData       from '../models/data.model.js';
import EpisodeAnalysis from '../models/episode_analysis.model.js';
import EmaResponse     from '../models/ema.model.js';
import mongoose        from 'mongoose';
import fetch           from 'node-fetch';
import dns             from 'dns';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

// Utility functions untuk prediction
import { getTransitionMatrix }         from '../utils/capar.transitions.js';
import { getRecoveryDistribution }     from '../utils/capar.thresholds.js';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt      = (v) => (v !== undefined && v !== null ? v : 'N/A');
const fmtFloat = (v, d = 3) => (typeof v === 'number' && !isNaN(v) ? v.toFixed(d) : 'N/A');
const fmtMs    = (ms) => (typeof ms === 'number' && !isNaN(ms) ? Math.round(ms / 60000) + ' menit' : 'N/A');

const FSM_LABELS = {
  BASELINE_COMPATIBLE:   'Normal',
  DEVIATION_CANDIDATE:   'Kandidat Deviasi',
  PERSISTENT_DEVIATION:  'Deviasi Persisten',
  RECOVERY_ENTRY:        'Pemulihan',
  RESOLVED:              'Selesai',
  INSUFFICIENT_BASELINE: 'Baseline Kurang',
};
const fsmLabel = (s) => FSM_LABELS[s] || s || '?';

const MATURITY_LABELS = {
  cold_start:  'Cold Start (baru, provisional)',
  provisional: 'Provisional (estimasi awal)',
  maturing:    'Maturing (sedang berkembang)',
  mature:      'Mature (stabil & terkalibrasi)',
  frozen:      'Frozen (terkunci)',
};
const matLabel = (l) => MATURITY_LABELS[l] || l || 'N/A';

const STANDARD_ACTIVITIES = ['sitting', 'standing', 'walking', 'resting', 'sleeping', 'driving'];

// ── Aggregator: Kumpulkan Data Lengkap 360° User ──────────────────────────────
async function gatherUser360Context(userId, episodeId = null) {
  const uidStr = String(userId);
  const uidObj = mongoose.Types.ObjectId.isValid(uidStr) ? new mongoose.Types.ObjectId(uidStr) : null;
  const userQuery = uidObj
    ? { $or: [{ _id: uidObj }, { guid: uidStr }] }
    : { guid: uidStr };

  // 1. Ambil user profile dulu untuk mengekstrak ID asli
  const userDoc = await User.findOne(userQuery)
    .populate('docter', 'name email phone_number')
    .select('name email current_device role phone_number age gender weight height docter profilePicture created_at')
    .lean()
    .catch(() => null);

  const validObjectIds = [];
  if (userDoc?._id) validObjectIds.push(new mongoose.Types.ObjectId(String(userDoc._id)));
  if (uidObj) validObjectIds.push(uidObj);

  const uidFilter = validObjectIds.length > 0
    ? { user_id: { $in: Array.from(new Set(validObjectIds)) } }
    : { user_id: uidStr };

  const [
    polarRawStats,
    polarActDistribution,
    allBaselines,
    recentSegments,
    segmentsStats,
    activityDistribution,
    episodeHistory,
    anomaliesStats,
    episodeAnalysisSummary,
    emaHistory,
    stateLog,
    transitionData,
    recoveryData,
    selectedEventDoc,
  ] = await Promise.allSettled([
    // 2. Data Mentah Polar (PolarData: detik demi detik)
    PolarData.aggregate([
      { $match: uidFilter },
      { $group: {
          _id: null,
          total_raw_points: { $sum: 1 },
          min_timestamp:    { $min: '$timestamp' },
          max_timestamp:    { $max: '$timestamp' },
          avg_hr:           { $avg: '$hr' },
          min_hr:           { $min: '$hr' },
          max_hr:           { $max: '$hr' },
          avg_rr:           { $avg: '$rr' },
          avg_rrms:         { $avg: '$rrms' },
          total_steps:      { $sum: '$step_count' },
      }},
    ]).catch(() => []),

    // 2b. Distribusi Aktivitas pada Polar Raw Data
    PolarData.aggregate([
      { $match: uidFilter },
      { $group: {
          _id: '$activity',
          count: { $sum: 1 },
          avg_hr: { $avg: '$hr' },
      }},
      { $sort: { count: -1 } },
    ]).catch(() => []),

    // 3. Semua Baseline User
    Baseline.find(uidFilter).lean().catch(() => []),

    // 4. 10 Segmen Monitoring Terbaru
    Segment.find(uidFilter)
      .sort({ window_start: -1 })
      .limit(10)
      .select('window_start anomaly_score rr_status activity_label features.mean_hr features.sdnn features.rmssd features.dfa_alpha1 z_scores missing_data_info.confidence_score')
      .lean().catch(() => []),

    // 5. Statistik Keseluruhan Segmen (Window-level processing)
    Segment.aggregate([
      { $match: uidFilter },
      { $group: {
          _id: null,
          total_segments:   { $sum: 1 },
          min_time:         { $min: '$window_start' },
          max_time:         { $max: '$window_start' },
          avg_hr:           { $avg: '$features.mean_hr' },
          avg_sdnn:         { $avg: '$features.sdnn' },
          avg_rmssd:        { $avg: '$features.rmssd' },
          avg_dfa:          { $avg: '$features.dfa_alpha1' },
          avg_anomaly_score:{ $avg: '$anomaly_score' },
      }},
    ]).catch(() => []),

    // 6. Distribusi Aktivitas Segmen
    Segment.aggregate([
      { $match: uidFilter },
      { $group: {
          _id: '$activity_label',
          count: { $sum: 1 },
          avg_hr: { $avg: '$features.mean_hr' },
      }},
      { $sort: { count: -1 } },
    ]).catch(() => []),

    // 7. Riwayat 15 Episode Anomali Terakhir
    AnomalyEvent.find(uidFilter)
      .sort({ onset_time: -1 })
      .limit(15)
      .select('_id onset_time classification physiological_outcome duration_ms peak_score peak_hr relapse admin_status activity started_at')
      .lean().catch(() => []),

    // 8. Agregasi Beban Anomali (Anomaly Burden Stats)
    AnomalyEvent.aggregate([
      { $match: uidFilter },
      { $group: {
          _id: null,
          total_episodes:       { $sum: 1 },
          caution_count:        { $sum: { $cond: [{ $eq: ['$classification', 'Caution'] }, 1, 0] } },
          alert_count:          { $sum: { $cond: [{ $eq: ['$classification', 'Alert'] }, 1, 0] } },
          total_duration_ms:    { $sum: { $ifNull: ['$duration_ms', 0] } },
          avg_duration_ms:      { $avg: '$duration_ms' },
          relapse_count:        { $sum: { $cond: ['$relapse', 1, 0] } },
          avg_peak_hr:          { $avg: '$peak_hr' },
          max_peak_hr:          { $max: '$peak_hr' },
      }},
    ]).catch(() => []),

    // 9. Episode Analysis (Deviasi & Trajectory Klinis)
    EpisodeAnalysis.aggregate([
      { $match: uidFilter },
      { $group: {
          _id: null,
          total_analyzed:       { $sum: 1 },
          avg_ttr:              { $avg: '$ttr' },
          avg_deviation_burden: { $avg: '$deviation_burden' },
          avg_recovery_slope:   { $avg: '$recovery_slope' },
          avg_deviation_auc:    { $avg: '$deviation_auc' },
          avg_quality_score:    { $avg: '$quality_score' },
          relapse_episodes:     { $sum: { $cond: ['$relapse_detected', 1, 0] } },
      }},
    ]).catch(() => []),

    // 10. Ecological Momentary Assessment (EMA Diary Survey Subjektif Pasien)
    EmaResponse.find(uidFilter)
      .sort({ submitted_at: -1 })
      .limit(10)
      .select('step_completed ema1 ema2 ema3 ema4 submitted_at')
      .lean().catch(() => []),

    // 11. Log Transisi State FSM Terbaru
    StateTransition.find(uidFilter)
      .sort({ timestamp: -1 })
      .limit(30)
      .lean().catch(() => []),

    // 12. Markov Model & Transition Matrix
    getTransitionMatrix(uidStr, 'sitting').catch(() => ({ matrix: null, total_transitions: 0, source: 'error' })),

    // 13. Recovery Distribution
    getRecoveryDistribution(uidStr, 'sitting').catch(() => null),

    // 14. Optional: Episode spesifik jika dipilih
    episodeId ? AnomalyEvent.findById(episodeId).lean().catch(() => null) : Promise.resolve(null),
  ]);

  const val = (r) => (r.status === 'fulfilled' ? r.value : null);

  const baselines = val(allBaselines) || [];
  const segStatsRaw = (val(segmentsStats) || [])[0] || {};
  const polarStatsRaw = (val(polarRawStats) || [])[0] || {};
  const anomStatsRaw = (val(anomaliesStats) || [])[0] || {};
  const epAnalysisRaw = (val(episodeAnalysisSummary) || [])[0] || {};
  const actDist = val(activityDistribution) || [];
  const polarActDist = val(polarActDistribution) || [];

  // Evaluasi Portofolio Baseline: Mana yang mature/provisional vs gaps
  const recordedActivities = new Set(baselines.map(b => (b.activity || '').toLowerCase()));
  const matureBaselines = baselines.filter(b => ['mature', 'frozen', 'maturing'].includes(b?.maturity_detail?.level));
  const provisionalBaselines = baselines.filter(b => ['cold_start', 'provisional'].includes(b?.maturity_detail?.level));
  const missingActivities = STANDARD_ACTIVITIES.filter(act => !recordedActivities.has(act));

  // Anomaly Burden Calculation
  const totalSegs = segStatsRaw.total_segments || 0;
  const estimatedMonitoringMinutes = totalSegs > 0
    ? totalSegs * 1
    : ((polarStatsRaw.total_raw_points || 0) / 60);
  const totalAnomalyMinutes = (anomStatsRaw.total_duration_ms || 0) / 60000;
  const anomalyBurdenPct = estimatedMonitoringMinutes > 0
    ? Math.min(100, (totalAnomalyMinutes / estimatedMonitoringMinutes) * 100)
    : 0;

  return {
    user:                  val(userDoc),
    polarStats: {
      total_raw_points:    polarStatsRaw.total_raw_points || 0,
      min_timestamp:       polarStatsRaw.min_timestamp,
      max_timestamp:       polarStatsRaw.max_timestamp,
      avg_hr:              polarStatsRaw.avg_hr,
      min_hr:              polarStatsRaw.min_hr,
      max_hr:              polarStatsRaw.max_hr,
      avg_rr:              polarStatsRaw.avg_rr,
      avg_rrms:            polarStatsRaw.avg_rrms,
      total_steps:         polarStatsRaw.total_steps || 0,
    },
    polarActivityDistribution: polarActDist,
    allBaselines:          baselines,
    matureBaselines,
    provisionalBaselines,
    missingActivities,
    recentSegments:        val(recentSegments) || [],
    segmentsStats: {
      total_segments:      totalSegs,
      first_time:          segStatsRaw.min_time,
      last_time:           segStatsRaw.max_time,
      avg_hr:              segStatsRaw.avg_hr,
      avg_sdnn:            segStatsRaw.avg_sdnn,
      avg_rmssd:           segStatsRaw.avg_rmssd,
      avg_dfa:             segStatsRaw.avg_dfa,
      avg_anomaly_score:   segStatsRaw.avg_anomaly_score,
      monitoring_duration_minutes: estimatedMonitoringMinutes,
    },
    activityDistribution:  actDist,
    episodeHistory:        val(episodeHistory) || [],
    anomaliesStats: {
      total_episodes:      anomStatsRaw.total_episodes || 0,
      caution_count:       anomStatsRaw.caution_count || 0,
      alert_count:         anomStatsRaw.alert_count || 0,
      total_duration_ms:   anomStatsRaw.total_duration_ms || 0,
      avg_duration_ms:     anomStatsRaw.avg_duration_ms || 0,
      relapse_count:       anomStatsRaw.relapse_count || 0,
      avg_peak_hr:         anomStatsRaw.avg_peak_hr || 0,
      max_peak_hr:         anomStatsRaw.max_peak_hr || 0,
      anomaly_burden_pct:  anomalyBurdenPct,
    },
    episodeAnalysis: {
      total_analyzed:      epAnalysisRaw.total_analyzed || 0,
      avg_ttr:             epAnalysisRaw.avg_ttr,
      avg_deviation_burden:epAnalysisRaw.avg_deviation_burden,
      avg_recovery_slope:  epAnalysisRaw.avg_recovery_slope,
      avg_deviation_auc:   epAnalysisRaw.avg_deviation_auc,
      avg_quality_score:   epAnalysisRaw.avg_quality_score,
      relapse_episodes:    epAnalysisRaw.relapse_episodes || 0,
    },
    emaHistory:            val(emaHistory) || [],
    stateLog:              val(stateLog) || [],
    transitions:           val(transitionData),
    recovery:              val(recoveryData),
    selectedEpisode:       val(selectedEventDoc),
  };
}

// ── Build User-Centric 360° Zero-Shot Prompt ──────────────────────────────────
function buildUser360Prompt(ctx) {
  const {
    user, polarStats, polarActivityDistribution, allBaselines, matureBaselines, provisionalBaselines, missingActivities,
    recentSegments, segmentsStats, activityDistribution, episodeHistory, anomaliesStats,
    episodeAnalysis, emaHistory, stateLog, transitions, selectedEpisode
  } = ctx;

  const userName = user?.name || user?.email || 'Peserta';
  const age = user?.age ? `${user.age} th` : 'N/A';
  const gender = user?.gender || 'N/A';
  const weight = user?.weight ? `${user.weight} kg` : 'N/A';
  const height = user?.height ? `${user.height} cm` : 'N/A';
  const device = user?.current_device || 'Polar H10';
  const docterInfo = user?.docter?.name ? `${user.docter.name} (${user.docter.email || ''})` : 'Belum Ditugaskan';

  // 1. App Usage & Activity Summary (Polar Data + Window Segments)
  const firstDateStr = segmentsStats.first_time ? new Date(segmentsStats.first_time).toLocaleDateString('id-ID') : 'N/A';
  const lastDateStr = segmentsStats.last_time ? new Date(segmentsStats.last_time).toLocaleDateString('id-ID') : 'N/A';
  
  const actLines = activityDistribution.map(a =>
    `  - ${a._id || 'Unknown'}: ${a.count} window (${Math.round((a.count / Math.max(1, segmentsStats.total_segments)) * 100)}%), Avg HR: ${fmtFloat(a.avg_hr, 1)} bpm`
  ).join('\n') || '  (Belum ada data aktivitas terdistribusi)';

  const polarActLines = (polarActivityDistribution || []).map(a =>
    `  - ${a._id || 'Lainnya'}: ${a.count} detik rekaman, Avg HR: ${fmtFloat(a.avg_hr, 1)} bpm`
  ).join('\n') || '';

  // 2. Baseline Portfolio Summary
  const blLines = allBaselines.map(b => {
    const tau = b.learned_tau || {};
    const st = b.stats || {};
    return `  - Aktivitas: ${b.activity || 'N/A'} [${b.time_period || 'all'}]
    Status: ${matLabel(b?.maturity_detail?.level)} | Total Data: ${b.segment_count || 0} window
    Tau: in=${fmtFloat(tau.tau_in)}, out=${fmtFloat(tau.tau_out)}, normal=${fmtFloat(tau.tau_normal)} (${tau.source || 'default'})
    Mean HR: ${fmtFloat(st.mean_hr?.mean, 1)} bpm, SDNN: ${fmtFloat(st.sdnn?.mean, 1)} ms, RMSSD: ${fmtFloat(st.rmssd?.mean, 1)} ms`;
  }).join('\n\n') || '  (Belum ada baseline tersimpan)';

  const matureList = matureBaselines.map(b => b.activity).join(', ') || 'Belum ada';
  const provList = provisionalBaselines.map(b => `${b.activity} (${b.segment_count || 0} win)`).join(', ') || 'Tidak ada';
  const missingList = missingActivities.join(', ') || 'Semua aktivitas standar tercakup';

  // 3. Anomaly & Episodic History
  const epLines = episodeHistory.slice(0, 8).map((ep, i) => {
    const onsetStr = ep.onset_time ? new Date(ep.onset_time < 1e12 ? ep.onset_time * 1000 : ep.onset_time).toLocaleString('id-ID') : 'N/A';
    return `  #${i + 1} [${ep.classification || 'Anomali'}] ${onsetStr} | Akt: ${ep.activity || 'N/A'} | Durasi: ${fmtMs(ep.duration_ms)} | Peak HR: ${fmtFloat(ep.peak_hr, 1)} bpm | Relapse: ${ep.relapse ? 'Ya' : 'Tidak'}`;
  }).join('\n') || '  (Tidak ada riwayat anomali tercatat — peserta stabil)';

  // 4. EMA Diary Surveys (Ecological Momentary Assessment)
  const emaLines = (emaHistory || []).slice(0, 4).map((e, i) => {
    const timeStr = e.submitted_at ? new Date(e.submitted_at).toLocaleString('id-ID') : 'N/A';
    return `  #${i + 1} [${timeStr}] Gejala: ${e.ema2?.symptom || 'Tidak ada'} (Intensitas: ${e.ema2?.intensity || 0}/10, Trigger: ${e.ema2?.trigger || 'N/A'}) | Pemulihan: ${e.ema3?.recovery_status || 'N/A'}`;
  }).join('\n') || '  (Belum ada pengisian kuesioner EMA oleh pasien)';

  // 5. Recent Segments Sample
  const segLines = recentSegments.slice(0, 5).map(s => {
    const f = s.features || {};
    const timeStr = s.window_start ? new Date(s.window_start).toLocaleTimeString('id-ID') : 'N/A';
    return `  [${timeStr}] Akt=${s.activity_label || 'N/A'}, State=${fsmLabel(s.rr_status)}, Score=${fmtFloat(s.anomaly_score)}, HR=${fmtFloat(f.mean_hr, 1)} bpm, RMSSD=${fmtFloat(f.rmssd, 1)} ms`;
  }).join('\n') || '  (Tidak ada data segmen)';

  return `Anda adalah asisten AI medis ahli sistem CAPAR (Continuous Anomaly Processing and Resolution). Tugas Anda adalah melakukan evaluasi klinis & otonom 360° secara menyeluruh (User-Centric Longitudinal Explain) untuk seorang pengguna/pasien berdasarkan rekam jejak sensor wearable.

══════════════════════════════════════════════════════════════
[BAGIAN 1] PROFIL PENGGUNA & PENGGUNAAN APLIKASI / WEARABLE
══════════════════════════════════════════════════════════════
Nama / ID Pengguna : ${userName} (${gender}, ${age}, BB: ${weight}, TB: ${height})
Dokter Pendamping  : ${docterInfo}
Perangkat Sensor   : ${device}
Total Titik Raw HR : ${polarStats.total_raw_points} sampel detik (Rentang HR: ${fmtFloat(polarStats.min_hr, 0)} - ${fmtFloat(polarStats.max_hr, 0)} bpm, Rata-rata RR: ${fmtFloat(polarStats.avg_rr, 1)} ms)
Total Segmen Window: ${segmentsStats.total_segments} window (± ${Math.round(segmentsStats.monitoring_duration_minutes)} menit pemantauan aktif)
Rentang Monitoring : ${firstDateStr} s/d ${lastDateStr}
Rata-rata Holistik : HR = ${fmtFloat(segmentsStats.avg_hr, 1)} bpm | SDNN = ${fmtFloat(segmentsStats.avg_sdnn, 1)} ms | RMSSD = ${fmtFloat(segmentsStats.avg_rmssd, 1)} ms | Skor Anomali Rata-rata = ${fmtFloat(segmentsStats.avg_anomaly_score, 2)}

Distribusi Aktivitas yang Terekam:
${actLines}
${polarActLines ? `\nDistribusi Log Mentah Polar:\n${polarActLines}` : ''}

══════════════════════════════════════════════════════════════
[BAGIAN 2] EVALUASI PORTOFOLIO BASELINE FISIOLOGIS
══════════════════════════════════════════════════════════════
- Baseline Mature / Terkalibrasi Baik : ${matureList}
- Baseline Provisional / Data Kurang   : ${provList}
- Baseline GAP (Belum Pernah Direkam)  : ${missingList}

Detail Baseline yang Dimiliki:
${blLines}

══════════════════════════════════════════════════════════════
[BAGIAN 3] RIWAYAT ANOMALI & BEBAN DISREGULASI (ANOMALY BURDEN)
══════════════════════════════════════════════════════════════
Total Kejadian Anomali  : ${anomaliesStats.total_episodes} episode (Caution: ${anomaliesStats.caution_count}, Alert: ${anomaliesStats.alert_count})
Anomaly Burden (AB)     : ${fmtFloat(anomaliesStats.anomaly_burden_pct, 1)}% dari total waktu monitoring
Total Durasi Anomali    : ${fmtMs(anomaliesStats.total_duration_ms)}
Rata-rata Waktu Pulih   : ${fmtMs(anomaliesStats.avg_duration_ms)}
Jumlah Relapse (Kambuh) : ${anomaliesStats.relapse_count} kali
Peak HR Tertinggi       : ${fmtFloat(anomaliesStats.max_peak_hr, 1)} bpm (Rata-rata peak: ${fmtFloat(anomaliesStats.avg_peak_hr, 1)} bpm)
${episodeAnalysis.total_analyzed > 0 ? `Metrik Lanjutan Trajectory: Avg TTR = ${fmtMs(episodeAnalysis.avg_ttr)}, Recovery Slope (v_rec) = ${fmtFloat(episodeAnalysis.avg_recovery_slope, 3)}, Deviation AUC = ${fmtFloat(episodeAnalysis.avg_deviation_auc, 1)}` : ''}

Daftar Episode Anomali Terakhir:
${epLines}

══════════════════════════════════════════════════════════════
[BAGIAN 4] CATATAN KUESIONER SUBJEKTIF PASIEN (EMA DIARY)
══════════════════════════════════════════════════════════════
${emaLines}

${selectedEpisode ? `
══════════════════════════════════════════════════════════════
[FOKUS EPISODE SPESIFIK] (Dipilih oleh Pengguna)
══════════════════════════════════════════════════════════════
Episode ID : ${selectedEpisode._id} | Klasifikasi : ${selectedEpisode.classification}
Aktivitas  : ${selectedEpisode.activity} | Durasi : ${fmtMs(selectedEpisode.duration_ms)} | Peak HR : ${fmtFloat(selectedEpisode.peak_hr, 1)} bpm
Outcome    : ${selectedEpisode.physiological_outcome || 'N/A'}
` : ''}

══════════════════════════════════════════════════════════════
[BAGIAN 5] SAMPEL MONITORING REAL-TIME TERAKHIR
══════════════════════════════════════════════════════════════
${segLines}

══════════════════════════════════════════════════════════════
[LANDASAN ILMIAH & BATASAN KLINIS]
══════════════════════════════════════════════════════════════
Prinsip Ilmiah:
  Signal → Anomaly → Recovery State → Trajectory → Phenotype → Risk Stratification → Clinical Confirmation

BATASAN KLINIS (CRITICAL RULE):
Data wearable longitudinal BUKAN diagnosis definitif penyakit jantung. DILARANG menyatakan diagnosis definitif (seperti "Anda terkena AFib / Penyakit Jantung Koroner").
Tugas Anda adalah:
1. Mengevaluasi apakah sistem otonom mampu mempertahankan/memperoleh kembali homeostasis secara konsisten sesuai konteks.
2. Membentuk "Digital Autonomic Phenotype" personal.
3. Melakukan "Risk Stratification" dan memberikan rekomendasi pemeriksaan medis konfirmasi jika diperlukan.

TAKSONOMI DIGITAL AUTONOMIC PHENOTYPE:
1. "Efficient Autonomic Recovery": TTR pendek konsisten, rebound vagal kuat, no relapse.
2. "Delayed Autonomic Recovery": TTR memanjang melampaui envelope personal pada aktivitas serupa.
3. "Unstable / Relapsing Recovery": Pola osilasi (Recovery → Relapse → Recovery) menunjukkan ketidakstabilan regulasi otonom.
4. "Persistent Autonomic Dysregulation": Anomali bertahan lama di atas operating region tanpa tanda resolusi cepat.
5. "Recurrent Unexplained Tachycardia": Lonjakan HR berulang pada kondisi istirahat/tidur tanpa penjelasan gerak/motion.
6. "Orthostatic Regulatory Dysregulation": Deviasi persisten khusus saat transisi posisi (duduk ke berdiri).
7. "Suspected Rhythm Irregularity": Variabilitas beat-to-beat (RR) ireguler tajam tanpa korelasi aktivitas fisik.
8. "Abnormal Activity-Response Coupling": Ketidaksesuaian tajam antara intensitas gerak dan respon chronotropic HR.

══════════════════════════════════════════════════════════════
INSTRUKSI OUTPUT (PENTING: HANYA JSON, tidak ada teks di luar JSON)
══════════════════════════════════════════════════════════════
Berikan analisis komprehensif 360° dalam format JSON berikut:

{
  "user_profile_summary": "Ringkasan profil dan pola pemakaian aplikasi/wearable oleh user: seberapa aktif merekam, rentang waktu monitoring, kepatuhan, dan rata-rata metrik kardiovaskular harian. (3-4 kalimat)",
  "baseline_portfolio_evaluation": "Evaluasi portofolio baseline: jelaskan baseline apa saja yang dimiliki dan sudah mature, baseline apa yang masih kurang/belum tercapai (gaps), kecukupan data, serta kesiapan ambang tau personal. (3-4 kalimat)",
  "anomaly_burden_analysis": "Analisis beban anomali (Anomaly Burden): jelaskan apakah user memiliki riwayat anomali, seberapa sering (Caution vs Alert), aktivitas apa yang paling rentan, dan apakah ada kecenderungan relapse atau pemulihan lambat. (3-4 kalimat)",
  "autonomic_phenotype": "Pilih 1 dari 8 nama taksonomi fenotipe otonom di atas yang paling tepat",
  "phenotype_explanation": "Penjelasan ilmiah mendalam mengenai alasan pemilihan fenotipe ini berdasarkan rekam jejak longitudinal, vektor pemulihan Re, dan konsistensi konteks. (3-4 kalimat)",
  "autonomic_recovery_analysis": "Analisis respons Sistem Saraf Otonom (ANS): keseimbangan simpatis vs parasimpatis (vagal tone), kinetik Heart Rate Recovery (HRR), dan efisiensi baroreflex peserta. (3-4 kalimat)",
  "patient_summary": "Ringkasan 360 LENGKAP dan RAMAH untuk pasien: jelaskan kondisi kesehatannya, kualitas baseline tubuhnya, seberapa baik jantungnya pulih pasca aktivitas, dan panduan pemakaian alat ke depan. (4-5 kalimat)",
  "clinical_suspicion": "Kecurigaan klinis terukur (Level 3 Risk Flag, BUKAN vonis diagnosis pasti). Indikasi fisiologis penting untuk dokter. (2-3 kalimat)",
  "confirmatory_recommendations": "Rekomendasi pemeriksaan konfirmasi klinis standar medis (misal: 12-lead ECG, Holter 24 jam, Stress test, dll). (2 kalimat)",
  "clinical_notes": "Catatan komprehensif untuk dokter/peneliti: evaluasi data longitudinal, risiko kardiovaskular otonom, dan reliabilitas baseline. (3-4 kalimat)",
  "risk_level": "rendah|sedang|tinggi|kritis",
  "risk_reason": "Alasan singkat level risiko berdasarkan beban anomali dan karakteristik pemulihan (1 kalimat).",
  "confidence": "tinggi|sedang|rendah",
  "confidence_reason": "Alasan level confidence berdasarkan kelengkapan baseline dan durasi rekaman data (1 kalimat)."
}`;
}

// ── Robust JSON Parser ────────────────────────────────────────────────────────
function safeParseJSON(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Respons LLM kosong.');
  }

  let text = rawText.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  try {
    return JSON.parse(text);
  } catch (_) {}

  const firstBrace = text.indexOf('{');
  if (firstBrace !== -1) {
    const candidate = text.slice(firstBrace);
    try {
      return JSON.parse(candidate);
    } catch (_) {}

    let inString = false;
    let escaped = false;
    let openBraces = 0;

    for (let i = 0; i < candidate.length; i++) {
      const ch = candidate[i];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (!inString) {
        if (ch === '{') openBraces++;
        else if (ch === '}') openBraces--;
      }
    }

    let repaired = candidate;
    if (inString) repaired += '"';
    repaired = repaired.replace(/,\s*$/, '');
    while (openBraces > 0) {
      repaired += '}';
      openBraces--;
    }

    try {
      return JSON.parse(repaired);
    } catch (_) {}
  }

  throw new Error('Respons LLM bukan JSON yang valid: ' + text.slice(0, 200));
}

// ── Call Gemini LLM Engine ───────────────────────────────────────────────────
async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY tidak dikonfigurasi di environment.');

  const requestedModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const candidateModels = Array.from(new Set([
    requestedModel,
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.6-flash',
    'gemini-3.7-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest',
  ]));

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  };

  let lastError = null;
  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
        signal:  AbortSignal.timeout(90000),
      });

      if (!res.ok) {
        const errText = await res.text();
        lastError = new Error(`Gemini API (${model}) error ${res.status}: ${errText.slice(0, 300)}`);
        if (res.status === 404) {
          console.warn(`[Explain] Model ${model} not found (404), mencoba fallback berikutnya...`);
          continue;
        }
        throw lastError;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return safeParseJSON(text);
    } catch (err) {
      if (err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('timeout')) {
        lastError = new Error(`Koneksi ke Gemini API timeout setelah 90 detik (${model}).`);
        console.warn(`[Explain] Timeout pada model ${model}, mencoba model fallback...`);
        continue;
      }
      lastError = err;
      if (!err.message.includes('404')) {
        throw err;
      }
    }
  }

  throw lastError || new Error('Semua model Gemini candidate gagal.');
}

// ── Call OpenAI Fallback ──────────────────────────────────────────────────────
async function callOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY tidak dikonfigurasi di environment.');

  const url   = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions';
  const model = process.env.OPENAI_MODEL    || 'gpt-4o-mini';

  const payload = {
    model,
    messages: [
      { role: 'system', content: 'Anda adalah asisten AI medis ahli CAPAR. Selalu balas dalam JSON valid.' },
      { role: 'user',   content: prompt },
    ],
    temperature:     0.2,
    max_tokens:      4096,
    response_format: { type: 'json_object' },
  };

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body:    JSON.stringify(payload),
    signal:  AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  return safeParseJSON(data?.choices?.[0]?.message?.content || '{}');
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLLER EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

// ── POST /api/ai/zero-shot/analyze ───────────────────────────────────────────
export async function zeroShotAnalyze(req, res) {
  try {
    const { userId, episodeId, useExported } = req.body;

    // Mode 1: Data exported (manual testing)
    if (useExported && req.body.raw_data) {
      const raw      = req.body.raw_data;
      const baseline = raw.baseline_doc;
      const segment  = raw.segment_doc;
      const event    = raw.event_doc || {};
      const fsmStates  = req.body.fsm_states || [];
      const thresholds = req.body.thresholds  || {};

      const prompt = buildExportedPrompt({ baseline, segment, event, fsmStates, thresholds });
      const provider = process.env.LLM_PROVIDER || 'gemini';
      let result;
      try {
        result = provider === 'openai' ? await callOpenAI(prompt) : await callGemini(prompt);
      } catch (llmErr) {
        return res.status(502).json({ success: false, message: `LLM Error: ${llmErr.message}`, prompt_preview: prompt.slice(0, 500) });
      }
      return res.json({ success: true, provider, mode: 'exported', episode_id: event._id, result, prompt_length: prompt.length });
    }

    // Mode 2: User-Centric 360° Explain (Primary)
    if (!userId && !episodeId) {
      return res.status(400).json({ success: false, message: 'Sediakan userId atau episodeId untuk analisis.' });
    }

    let targetUserId = userId;
    // Jika hanya episodeId yang disediakan, temukan userId dari episode tersebut
    if (!targetUserId && episodeId) {
      const ep = await AnomalyEvent.findById(episodeId).select('user_id').lean();
      if (ep) targetUserId = ep.user_id?.toString();
    }

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'User ID tidak valid atau tidak ditemukan.' });
    }

    // Kumpulkan seluruh data holistik user
    const ctx = await gatherUser360Context(targetUserId, episodeId);

    // Bangun comprehensive user prompt
    const prompt = buildUser360Prompt(ctx);
    const provider = process.env.LLM_PROVIDER || 'gemini';

    let result;
    try {
      result = provider === 'openai' ? await callOpenAI(prompt) : await callGemini(prompt);
    } catch (llmErr) {
      return res.status(502).json({
        success:        false,
        message:        `LLM Error: ${llmErr.message}`,
        prompt_preview: prompt.slice(0, 500) + '...',
      });
    }

    return res.json({
      success:    true,
      provider,
      mode:       'user_centric_360',
      user_id:    targetUserId,
      episode_id: episodeId || null,
      profile_summary: {
        total_segments:       ctx.segmentsStats.total_segments,
        total_episodes:       ctx.anomaliesStats.total_episodes,
        anomaly_burden_pct:   ctx.anomaliesStats.anomaly_burden_pct,
        mature_baselines:     ctx.matureBaselines.length,
        total_baselines:      ctx.allBaselines.length,
        missing_baselines:    ctx.missingActivities.length,
      },
      data_sources: {
        total_segments:       ctx.segmentsStats.total_segments,
        all_baselines:        ctx.allBaselines.length,
        mature_baselines:     ctx.matureBaselines.length,
        provisional_baselines:ctx.provisionalBaselines.length,
        episode_history:      ctx.episodeHistory.length,
        state_log_entries:    ctx.stateLog.length,
        has_transitions:      !!ctx.transitions,
      },
      result,
      prompt_length: prompt.length,
    });

  } catch (err) {
    console.error('[Explain] Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ── GET /api/ai/zero-shot/participants — Daftar User dengan Ringkasan Metrik ───
export async function listZeroShotParticipants(req, res) {
  try {
    const users = await User.find({}, { _id: 1, guid: 1, name: 1, email: 1, current_device: 1, role: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .lean();

    // Ambil ringkasan segmen, baseline, dan episode untuk tiap user secara paralel
    const userListWithSummary = await Promise.all(
      users.map(async (u) => {
        const validObjectIds = [u._id];
        const uidFilter = { user_id: { $in: validObjectIds } };

        const [segCount, baseCount, anomCount, matureCount, polarCount] = await Promise.all([
          Segment.countDocuments(uidFilter).catch(() => 0),
          Baseline.countDocuments(uidFilter).catch(() => 0),
          AnomalyEvent.countDocuments(uidFilter).catch(() => 0),
          Baseline.countDocuments({ ...uidFilter, 'maturity_detail.level': { $in: ['mature', 'frozen', 'maturing'] } }).catch(() => 0),
          PolarData.countDocuments(uidFilter).catch(() => 0),
        ]);

        return {
          id:                 String(u._id),
          _id:                u._id,
          guid:               u.guid || null,
          name:               u.name || u.email,
          email:              u.email,
          device:             u.current_device || 'Polar H10',
          role:               u.role || 'user',
          total_segments:     segCount,
          total_raw_polar:    polarCount,
          total_baselines:    baseCount,
          mature_baselines:   matureCount,
          total_episodes:     anomCount,
          has_data:           segCount > 0 || baseCount > 0 || polarCount > 0,
        };
      })
    );

    return res.json({ success: true, data: userListWithSummary });
  } catch (err) {
    console.error('[Explain] listParticipants error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ── GET /api/ai/zero-shot/episodes ────────────────────────────────────────────
export async function listZeroShotEpisodes(req, res) {
  try {
    const userId = req.query.userId;
    let filter = {};
    if (userId && userId !== 'ALL') {
      const uidStr = String(userId);
      const uidObj = mongoose.Types.ObjectId.isValid(uidStr) ? new mongoose.Types.ObjectId(uidStr) : null;
      const user = await User.findOne(uidObj ? { $or: [{ _id: uidObj }, { guid: uidStr }] } : { guid: uidStr }).lean();

      const validObjectIds = [];
      if (user?._id) validObjectIds.push(new mongoose.Types.ObjectId(String(user._id)));
      if (uidObj) validObjectIds.push(uidObj);

      filter = validObjectIds.length > 0 ? { user_id: { $in: validObjectIds } } : { user_id: uidStr };
    }

    const episodes = await AnomalyEvent
      .find(filter, {
        _id: 1, user_id: 1, activity: 1, classification: 1,
        physiological_outcome: 1, current_state: 1,
        onset_time: 1, duration_ms: 1,
        peak_score: 1, peak_hr: 1,
        baseline_hr: 1, relapse: 1,
        status: 1, admin_status: 1,
      })
      .sort({ onset_time: -1 })
      .limit(50)
      .lean();

    return res.json({ success: true, data: episodes });
  } catch (err) {
    console.error('[Explain] listEpisodes error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ── GET /api/ai/zero-shot/prompt-preview ─────────────────────────────────────
export async function promptPreview(req, res) {
  try {
    const { userId, episodeId } = req.query;
    if (!userId && !episodeId) {
      return res.status(400).json({ success: false, message: 'userId atau episodeId diperlukan.' });
    }

    let targetUserId = userId;
    if (!targetUserId && episodeId) {
      const ep = await AnomalyEvent.findById(episodeId).select('user_id').lean();
      if (ep) targetUserId = ep.user_id?.toString();
    }

    const ctx = await gatherUser360Context(targetUserId, episodeId);
    const prompt = buildUser360Prompt(ctx);

    return res.json({
      success:      true,
      user_id:      targetUserId,
      episode_id:   episodeId || null,
      prompt,
      prompt_length: prompt.length,
      data_summary: {
        total_segments:    ctx.segmentsStats.total_segments,
        all_baselines:     ctx.allBaselines.length,
        mature_baselines:  ctx.matureBaselines.length,
        missing_baselines: ctx.missingActivities.length,
        total_episodes:    ctx.anomaliesStats.total_episodes,
        anomaly_burden_pct:ctx.anomaliesStats.anomaly_burden_pct,
      },
    });
  } catch (err) {
    console.error('[Explain] promptPreview error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ── Helper: prompt exported ──────────────────────────────────────────────────
function buildExportedPrompt({ baseline, segment, event, fsmStates, thresholds }) {
  return `Anda adalah asisten AI medis CAPAR. Analisis data exported secara zero-shot:
[BASELINE] Activity=${fmt(baseline?.activity)}, TauIn=${fmtFloat(baseline?.learned_tau?.tau_in ?? thresholds?.TAU_IN)}
[SEGMEN] Score=${fmtFloat(segment?.anomaly_score)}, State=${fsmLabel(segment?.rr_status)}
[EPISODE] Class=${fmt(event?.classification)}, Peak HR=${fmtFloat(event?.peak_hr)} bpm

Output JSON:
{
  "user_profile_summary": "Data manual exported.",
  "baseline_portfolio_evaluation": "Baseline parsial untuk aktivitas ${fmt(baseline?.activity)}.",
  "anomaly_burden_analysis": "Episode terisolasi dari file export.",
  "autonomic_phenotype": "Efficient Autonomic Recovery",
  "phenotype_explanation": "Analisis berbasis data parsial exported.",
  "autonomic_recovery_analysis": "Pemulihan otonom dievaluasi dari episode tunggal.",
  "patient_summary": "Kondisi Anda terpantau stabil pada sesi ini.",
  "clinical_suspicion": "Perlu pengumpulan data longitudinal berkelanjutan.",
  "confirmatory_recommendations": "Lanjutkan pemantauan harian.",
  "clinical_notes": "Data terbatas dari export manual.",
  "risk_level": "rendah",
  "risk_reason": "Data terkontrol.",
  "confidence": "rendah",
  "confidence_reason": "Data parsial exported."
}`;
}
