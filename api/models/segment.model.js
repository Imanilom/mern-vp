import mongoose from 'mongoose';

/**
 * Window Segment — hasil segmentasi 3-menit dari data raw.
 * Satu document = satu window 3 menit untuk satu user + device.
 * Digunakan sebagai input Layer 3 (anomaly detection & baseline).
 */
const SegmentSchema = new mongoose.Schema({
  // --- Identitas ---
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  device_id: {
    type: String,
    required: true,
  },

  // --- Rentang waktu window (epoch ms) ---
  window_start: {
    type: Number,
    required: true,
  },
  window_end: {
    type: Number,
    required: true,
  },

  // --- Label aktivitas (dari diary manual di CSV) ---
  activity_label: {
    type: String,
    enum: ['Rest', 'Light', 'Moderate', 'Intense', 'Unknown'],
    default: 'Unknown',
  },

  // --- Fitur yang dihitung per window ---
  features: {
    // Heart Rate features
    mean_hr: { type: Number },
    std_hr: { type: Number },
    delta_hr: { type: Number },    // max_hr - min_hr dalam window
    slope_hr: { type: Number },    // slope regresi linear HR terhadap waktu

    // HRV features (dari RR interval)
    mean_rr: { type: Number },
    sdnn: { type: Number },
    rmssd: { type: Number },
    rolling_variance: { type: Number }, // variance HR dalam window

    // Motion features (dari accelerometer)
    motion_intensity: { type: Number }, // rata-rata magnitude acc
    step_count: { type: Number },

    // DFA (opsional, dihitung jika RR >= 16 titik)
    dfa_alpha1: { type: Number, default: null }, // short-range (window 4–16)
    dfa_alpha2: { type: Number, default: null }, // long-range  (window 17+)
  },

  // --- Metadata kualitas ---
  raw_count: {
    type: Number,
    required: true,
  },
  is_valid: {
    type: Boolean,
    default: true,
  },

  // --- Layer 3 Analysis Output ---
  // Flag apakah segment ini sudah dianalisis oleh Layer 3
  analyzed: {
    type: Boolean,
    default: false,
    index: true,
  },

  // Composite anomaly score hasil Layer 3
  anomaly_score: {
    type: Number,
    default: null,
  },

  // Klasifikasi output Layer 3
  classification: {
    type: String,
    enum: ['Normal', 'Caution', 'Alert', null],
    default: null,
  },

  // Label anotasi manual (dokter/admin) — untuk metrik evaluasi
  // 'anomaly' | 'normal' | null (belum dianotasi)
  ground_truth_label: {
    type: String,
    enum: ['anomaly', 'normal', null],
    default: null,
    index: true,
  },

  // Z-scores per fitur (untuk dashboard)
  z_scores: {
    z_hr:     { type: Number, default: null },
    z_rr:     { type: Number, default: null },
    z_sdnn:   { type: Number, default: null },
    z_rmssd:  { type: Number, default: null },
    z_motion: { type: Number, default: null },
    z_dfa:    { type: Number, default: null },
  },

}, { timestamps: true });

// Index untuk query per user + waktu (digunakan Layer 3)
SegmentSchema.index({ user_id: 1, window_start: 1 });
SegmentSchema.index({ user_id: 1, activity_label: 1, window_start: -1 });

// Unique: satu window per user+device
SegmentSchema.index({ user_id: 1, device_id: 1, window_start: 1 }, { unique: true });

const Segment = mongoose.model('Segment', SegmentSchema);

export default Segment;
