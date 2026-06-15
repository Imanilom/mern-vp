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
    enum: ['Rest', 'Light', 'Moderate', 'Intense', 'Unknown'],
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

}, { timestamps: true });

// Unique: satu baseline per user + activity + time_period
BaselineSchema.index(
  { user_id: 1, activity: 1, time_period: 1 },
  { unique: true }
);

const Baseline = mongoose.model('Baseline', BaselineSchema);
export default Baseline;
