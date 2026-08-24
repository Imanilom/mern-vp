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
  sequence_of_scores: [{ type: Number }], // S = {s1, s2, s3, ..., sn} (anomaly scores pada setiap window)
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

  // ── Waktu Lifecycle Episode ───────────────────────────────────────────────
  onset_time:       { type: Number, required: true }, // epoch ms — window pertama anomali (sama dengan started_at)
  started_at:       { type: Number },                 // alias untuk onset_time (standardization)
  candidate_at:     { type: Number },                 // epoch ms — state menjadi DEVIATION_CANDIDATE
  persistent_at:    { type: Number },                 // epoch ms — state menjadi PERSISTENT_DEVIATION
  peak_time:        { type: Number },                 // epoch ms — window dengan score tertinggi
  recovery_started_at: { type: Number },              // epoch ms — mulai recovery
  recovered_at:     { type: Number },                 // epoch ms — benar-benar recovered
  resolved_time:    { type: Number, default: null },  // alias untuk recovered_at / selesai
  unresolved_at:    { type: Number },                 // epoch ms — timeout T_max
  
  // Waktu onset nyata (diisi anotasi klinisi) — untuk menghitung detection delay
  actual_onset_time: { type: Number, default: null },

  duration_ms: { type: Number, default: null }, // resolved_time - onset_time

  // ── Skor & Fitur Mentah ───────────────────────────────────────────────────
  onset_score:  { type: Number }, // score saat onset
  peak_score:   { type: Number }, // score tertinggi
  peak_hr:      { type: Number }, // raw HR saat peak
  baseline_hr:  { type: Number }, // raw baseline HR saat peak
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

  // Status lifecycle (CAPAR extended)
  status: {
    type: String,
    enum: ['open', 'paused', 'closed', 'transient', 'unresolved', 'recovered'],
    default: 'open',
  },

  // CAPAR Episode Metrics (Section 9)
  auc_score: { type: Number, default: null },      // ∫ S(t) dt trapezoidal integration
  window_count: { type: Number, default: 0 },      // jumlah windows dalam episode
  unresolved_reason: { type: String, default: null }, // alasan UNRESOLVED (e.g. 'duration_exceeded_T_max')
  
  // Episode Detail & State Machine Extended Fields
  admin_status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN' },
  physiological_outcome: { type: String, enum: ['RECOVERED', 'UNRESOLVED'], default: 'UNRESOLVED' },
  current_state: { type: String, default: 'BASELINE_COMPATIBLE' },
  recovery_entry_at: { type: Number, default: null },
  ttr_min: { type: Number, default: null },
  peak_count: { type: Number, default: 0 },
  relapse_count: { type: Number, default: 0 },
  relapse: { type: Boolean, default: false },
  relapse_at: { type: Number, default: null },
  parent_episode_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AnomalyEvent', default: null },
  rule_version: { type: String, default: '1.0.0' },

  // ── Pause / Gap Tracking ──────────────────────────────────────────────────
  total_paused_ms: { type: Number, default: 0 },
  last_paused_at: { type: Number, default: null },
  pause_history: [{
    paused_from: Number,  // epoch ms — window_start terakhir sebelum gap
    resumed_at:  Number,  // epoch ms — window_start pertama setelah gap
    gap_ms:      Number,
  }],

  // Anotasi manual dari dokter/user
  annotations: [{
    text: String,
    timestamp: Number, // epoch ms point on the chart
    created_at: { type: Date, default: Date.now }
  }],

  // ── Clinical Review Workflow ──────────────────────────────────────────────
  review_status: {
    type: String,
    enum: ['New', 'Under Review', 'Validated', 'False Positive', 'Closed'],
    default: 'New',
  },
  validation_label: {
    type: String,
    enum: [
      'None', 
      'Valid anomaly', 
      'False positive', 
      'Sensor artifact', 
      'Activity mislabeled', 
      'Insufficient data', 
      'Clinical follow-up needed'
    ],
    default: 'None'
  },
  reviewer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewer_notes: { type: String, default: '' },
  escalated: { type: Boolean, default: false }

}, { timestamps: true });

// Index untuk query dashboard
AnomalyEventSchema.index({ user_id: 1, onset_time: -1 });
AnomalyEventSchema.index({ user_id: 1, status: 1 });
AnomalyEventSchema.index({ user_id: 1, classification: 1, onset_time: -1 });

const AnomalyEvent = mongoose.model('AnomalyEvent', AnomalyEventSchema);
export default AnomalyEvent;
