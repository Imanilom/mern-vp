import mongoose from 'mongoose';

/**
 * Window Segment — hasil segmentasi dari data raw.
 * Satu document = satu window untuk satu user + device.
 *
 * window_type '5min' = pipeline lama (multi-feature, 5-menit)
 * window_type '1min' = pipeline RR-only context-aware (1-menit, paralel)
 *
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

  /**
   * Tipe pipeline:
   * '5min' = pipeline lama (default)
   * '1min' = pipeline RR-only context-aware (paralel)
   */
  window_type: {
    type: String,
    enum: ['5min', '1min'],
    default: '5min',
    index: true,
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
    
    // ADFA (Asymmetric DFA)
    adfa_plus: { type: Number, default: null },
    adfa_minus: { type: Number, default: null },

    // Additional HRV features
    nn50: { type: Number, default: null },
    pnn50: { type: Number, default: null },
    lf: { type: Number, default: null },
    hf: { type: Number, default: null },
    lfhfratio: { type: Number, default: null },
  },

  /**
   * Data RR mentah per window (hanya diisi pada window_type '1min').
   * Digunakan oleh RR pipeline untuk quality assessment & re-analysis.
   */
  rr_raw: {
    type: [Number],
    default: undefined,
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

  // --- Doctor Validation ---
  doctor_validation: {
    status: {
      type: String,
      enum: ['pending', 'validated', 'rejected'],
      default: 'pending',
    },
    validated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    doctor_notes: {
      type: String,
      default: '',
    },
    validated_at: {
      type: Date,
      default: null,
    },
  },

  // --- Missing Data Confidence Metric ---
  missing_data_info: {
    expected_count: { type: Number, default: 1000 },
    received_count: { type: Number, default: 995 },
    missing_count: { type: Number, default: 5 },
    missing_ratio: { type: Number, default: 0.005 },
    confidence_score: { type: Number, default: 99.5 },
  },

  // --- Signal Quality: Artifact vs Anomaly ---
  signal_quality: {
    is_artifact: { type: Boolean, default: false },
    is_anomaly: { type: Boolean, default: false },
    artifact_type: { type: String, default: null }, // e.g., 'contact_loss', 'spike_noise', 'dropout'
  },

  /**
   * Detail kualitas sinyal RR (diisi oleh RR pipeline 1-menit).
   * Port dari assess_and_correct_rr() Python.
   */
  signal_quality_detail: {
    artifact_fraction: { type: Number, default: null },
    missing_fraction:  { type: Number, default: null },
    q_signal:          { type: Number, default: null }, // 1 - artifact_fraction
    q_complete:        { type: Number, default: null }, // 1 - missing_fraction
    q_context:         { type: Number, default: null }, // activity_confidence
    reasons:           { type: [String], default: undefined },
  },

  /**
   * Status temporal 9-state dari pipeline RR context-aware (diisi oleh Layer 3 RR).
   * Port dari OutputStatus Python.
   * Hanya terisi jika window_type === '1min'.
   */
  rr_status: {
    type: String,
    enum: [
      'QUALITY_WARNING',
      'INSUFFICIENT_BASELINE',
      'PROVISIONAL_NORMAL',
      'PROVISIONAL_DEVIATION',
      'NORMAL',
      'DEVIATION_CANDIDATE',
      'PERSISTENT_DEVIATION',
      'RECOVERING',
      'RECOVERED',
      null,
    ],
    default: null,
  },

  // --- Polar Decision Tree Prediction ---
  dt_prediction: {
    predicted_activity: { type: String, default: null },
    confidence: { type: Number, default: null },
  },

}, { timestamps: true });

// Index untuk query per user + waktu (digunakan Layer 3)
SegmentSchema.index({ user_id: 1, window_start: 1 });
SegmentSchema.index({ user_id: 1, activity_label: 1, window_start: -1 });

// Index untuk RR pipeline (query berdasarkan window_type)
SegmentSchema.index({ user_id: 1, window_type: 1, analyzed: 1, window_start: 1 });

// Unique: satu window per user+device+type
// window_type dimasukkan agar 5-min dan 1-min window pada timestamp yang sama tidak konflik
SegmentSchema.index({ user_id: 1, device_id: 1, window_type: 1, window_start: 1 }, { unique: true });

const Segment = mongoose.model('Segment', SegmentSchema);

export default Segment;
