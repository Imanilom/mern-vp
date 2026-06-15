import mongoose from 'mongoose';

/**
 * AnomalyEvent — satu "kejadian anomali" yang terdeteksi sistem.
 *
 * Event dibuat ketika anomaly score melewati threshold selama
 * beberapa window berturut-turut (persistence check).
 *
 * Lifecycle event:
 *   OPEN  → score pertama kali melewati threshold
 *   PEAK  → score tertinggi dalam event ini
 *   CLOSED → score kembali ke Normal selama N window berturut-turut
 */

// Z-score per fitur pada saat peak
const ZScoreSchema = new mongoose.Schema({
  z_hr:     { type: Number },  // (mean_hr - μ_HR) / σ_HR
  z_rr:     { type: Number },  // (mean_rr - μ_RR) / σ_RR
  z_sdnn:   { type: Number },  // (sdnn - μ_SDNN) / σ_SDNN
  z_rmssd:  { type: Number },  // (rmssd - μ_RMSSD) / σ_RMSSD
  z_motion: { type: Number },  // (motion - μ_motion) / σ_motion
  z_dfa:    { type: Number },  // |dfa_alpha1 - 1.0| / 0.5 (fixed reference)
}, { _id: false });

// Analisis trajectory saat event berlangsung
const TrajectorySchema = new mongoose.Schema({
  delta_hr:    { type: Number }, // selisih mean_hr onset vs peak
  slope_hr:    { type: Number }, // rata-rata slope_hr dalam event
  persistence: { type: Number }, // jumlah window berturut-turut di atas threshold
  dfa_alpha1:  { type: Number }, // DFA α1 saat peak (null jika tidak tersedia)
  dfa_alpha2:  { type: Number }, // DFA α2 placeholder (untuk Layer 4)
  recovery_time_ms: { type: Number, default: null }, // ms dari peak sampai Normal kembali
}, { _id: false });

const AnomalyEventSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  device_id: { type: String },
  activity:  { type: String }, // aktivitas saat onset

  // ── Waktu ─────────────────────────────────────────────────────────────────
  onset_time:       { type: Number, required: true }, // epoch ms — window pertama anomali
  peak_time:        { type: Number },                 // epoch ms — window dengan score tertinggi
  resolved_time:    { type: Number, default: null },  // epoch ms — kembali ke Normal

  // Waktu onset nyata (diisi anotasi klinisi) — untuk menghitung detection delay
  actual_onset_time: { type: Number, default: null },

  duration_ms: { type: Number, default: null }, // resolved_time - onset_time

  // ── Skor ──────────────────────────────────────────────────────────────────
  onset_score:  { type: Number }, // score saat onset
  peak_score:   { type: Number }, // score tertinggi
  classification: {
    type: String,
    enum: ['Normal', 'Caution', 'Alert'],
    required: true,
  },

  // ── Detail analitik ───────────────────────────────────────────────────────
  z_scores_at_peak: { type: ZScoreSchema, default: () => ({}) },
  trajectory:       { type: TrajectorySchema, default: () => ({}) },

  // ID segment yang terlibat dalam event ini
  segment_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Segment' }],

  // Status lifecycle
  status: {
    type: String,
    enum: ['open', 'closed'],
    default: 'open',
  },

}, { timestamps: true });

// Index untuk query dashboard
AnomalyEventSchema.index({ user_id: 1, onset_time: -1 });
AnomalyEventSchema.index({ user_id: 1, status: 1 });
AnomalyEventSchema.index({ user_id: 1, classification: 1, onset_time: -1 });

const AnomalyEvent = mongoose.model('AnomalyEvent', AnomalyEventSchema);
export default AnomalyEvent;
