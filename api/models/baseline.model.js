import mongoose from 'mongoose';

/**
 * Baseline Per-Individu — disimpan per user + activity + time_period.
 *
 * Menggunakan Welford's Online Algorithm agar update incremental
 * tanpa menyimpan semua data historis (O(1) per update).
 *
 * Satu document = satu kombinasi unik (user_id, activity, time_period).
 * Baseline dipakai Layer 3 untuk menghitung Z-score deviasi.
 */

// Sub-schema untuk menyimpan statistik satu fitur (Welford state)
const FeatureStatSchema = new mongoose.Schema({
  n:    { type: Number, default: 0 },   // jumlah sample
  mean: { type: Number, default: 0 },   // running mean
  M2:   { type: Number, default: 0 },   // sum of squared deviations (Welford)
  std:  { type: Number, default: 0 },   // std deviation (diperbarui setiap update)
  min:  { type: Number, default: null },
  max:  { type: Number, default: null },
}, { _id: false });

const BaselineSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  /**
   * Label aktivitas: Rest | Light | Moderate | Intense | Unknown
   * Baseline terpisah per aktivitas agar deviasi context-aware.
   */
  activity: {
    type: String,
    required: true,
  },

  /**
   * Periode waktu dalam sehari — untuk menangkap variasi sirkadian.
   * morning: 06–12, afternoon: 12–18, evening: 18–24, night: 00–06
   */
  time_period: {
    type: String,
    enum: ['morning', 'afternoon', 'evening', 'night'],
    required: true,
  },

  // Statistik per fitur (Welford state)
  stats: {
    mean_hr:          { type: FeatureStatSchema, default: () => ({}) },
    std_hr:           { type: FeatureStatSchema, default: () => ({}) },
    delta_hr:         { type: FeatureStatSchema, default: () => ({}) },
    slope_hr:         { type: FeatureStatSchema, default: () => ({}) },
    mean_rr:          { type: FeatureStatSchema, default: () => ({}) },
    sdnn:             { type: FeatureStatSchema, default: () => ({}) },
    rmssd:            { type: FeatureStatSchema, default: () => ({}) },
    rolling_variance: { type: FeatureStatSchema, default: () => ({}) },
    motion_intensity: { type: FeatureStatSchema, default: () => ({}) },
    dfa_alpha1:       { type: FeatureStatSchema, default: () => ({}) },
  },

  // Total window yang sudah masuk ke baseline ini
  segment_count: { type: Number, default: 0 },

  // Baseline dianggap "mature" jika sudah ada cukup sample
  is_mature: { type: Boolean, default: false },

  // Minimum segment sebelum baseline dipercaya
  MATURITY_THRESHOLD: { type: Number, default: 20 },

  last_updated: { type: Date, default: Date.now },

  // Model management
  is_frozen: { type: Boolean, default: false },
  version: { type: Number, default: 2 },
  status: { type: String, enum: ['learning', 'approved', 'rejected'], default: 'learning' },

  /**
   * Detail maturity granular (diisi oleh RR pipeline 1-menit).
   * Port dari maturity_report() Python.
   */
  maturity_detail: {
    // n / (1 + 2*sum_autocorr) — jumlah window independen efektif
    n_effective: { type: Number, default: 0 },
    // Jumlah hari unik yang punya >= min_windows_per_day window
    distinct_days: { type: Number, default: 0 },
    // Proporsi window yang berasal dari satu hari terbanyak
    max_single_day_frac: { type: Number, default: 1 },
    // Quality components (rata-rata dari window yang masuk baseline)
    q_signal:   { type: Number, default: 0 },
    q_complete: { type: Number, default: 0 },
    q_context:  { type: Number, default: 0 },
    // Seberapa stabil mean harian (0=tidak stabil, 1=sangat stabil)
    q_stability: { type: Number, default: 0 },
    // Composite Baseline Quality: 0.35*q_signal + 0.25*q_complete + 0.20*q_context + 0.20*q_stability
    bq: { type: Number, default: 0 },
    // Label tingkat kematangan baseline
    level: {
      type: String,
      enum: ['cold_start', 'provisional', 'maturing', 'mature'],
      default: 'cold_start',
    },
    // Gate yang gagal (array string), kosong jika mature
    failed_gates: { type: [String], default: [] },
    last_computed: { type: Date, default: null },
  },

  /**
   * History arrays untuk komputasi maturity (diisi oleh RR pipeline).
   * Disimpan agar bisa menghitung rata-rata quality dan stability tanpa menyimpan
   * semua data historis penuh.
   */
  // Array timestamp window (epoch ms) — untuk distinct days & day dominance
  window_timestamps: { type: [Number], default: [] },
  // Quality scores per window
  q_signal_history:   { type: [Number], default: [] },
  q_complete_history: { type: [Number], default: [] },
  q_context_history:  { type: [Number], default: [] },

  // Adaptive threshold learned dari Stable Score Memory (CAPAR Section 7.1)
  // Disimpan setelah threshold dipelajari dari cukup BC→BC windows
  learned_tau: {
    tau_in:             { type: Number, default: 1.50 }, // Q_0.99 dari StableScore atau default 1.50
    tau_out:            { type: Number, default: 1.00 }, // Q_0.95 dari StableScore atau default 1.00
    tau_normal:         { type: Number, default: 0.75 }, // Q_0.90 dari StableScore atau default 0.75
    source:             { type: String, enum: ['learned', 'provisional', 'configured'], default: 'configured' },
    stable_score_count: { type: Number, default: 0 },   // jumlah stable scores yang dipakai
    computed_at:        { type: Date, default: Date.now },
  },

  /**
   * History stable scores (BC→BC) untuk komputasi tau.
   * Hanya scores dari window yang aman (tidak dalam deviation/recovery).
   */
  stable_score_history: { type: [Number], default: [] },

}, { timestamps: true });

// Unique: satu baseline per user + activity + time_period
BaselineSchema.index(
  { user_id: 1, activity: 1, time_period: 1 },
  { unique: true }
);

const Baseline = mongoose.model('Baseline', BaselineSchema);
export default Baseline;
