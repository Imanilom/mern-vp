import mongoose from 'mongoose';

const EpisodeAnalysisSchema = new mongoose.Schema({
  start_time: { type: Date, required: true },
  end_time: { type: Date, required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  profile: { type: String },
  activity: { type: String },
  context: { type: String },
  episode_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AnomalyEvent' },
  
  // States & Scores
  evidence_state: { type: String },
  physiological_state: { type: String },
  y_true: { type: String },
  latent_severity: { type: Number },
  anomaly_score: { type: Number },
  
  // ── Timing & Duration ─────────────────────────────────────────────────────
  candidate_duration: { type: Number, default: 0 },
  persistent_duration: { type: Number, default: 0 },
  recovery_duration: { type: Number, default: 0 },
  total_duration: { type: Number, default: 0 },
  ttr: { type: Number, default: null }, // Time To Recovery
  
  // ── Deviation Metrics ─────────────────────────────────────────────────────
  peak_deviation: { type: Number },
  mean_deviation: { type: Number },
  deviation_auc: { type: Number },
  deviation_burden: { type: Number },
  recovery_slope: { type: Number },
  
  // ── Quality Metrics ───────────────────────────────────────────────────────
  mean_quality: { type: Number },
  min_quality: { type: Number },
  valid_fraction: { type: Number },
  abstention_count: { type: Number, default: 0 },
  
  // ── Context Metrics ───────────────────────────────────────────────────────
  dominant_context: { type: String },
  context_changes: [{
    context: String,
    duration_ms: Number
  }],
  
  // ── Relapse Tracking ──────────────────────────────────────────────────────
  relapse_detected: { type: Boolean, default: false },
  relapse_count: { type: Number, default: 0 },
  time_to_relapse: { type: Number, default: null },

  // Thresholds
  tau_in: { type: Number },
  tau_out: { type: Number },
  tau_normal: { type: Number },

  // Physiological Features
  hr_mean: { type: Number },
  rmssd: { type: Number },
  sdnn: { type: Number },
  dfa_alpha1: { type: Number },

  // Signal Quality
  quality_score: { type: Number },
  artifact_fraction: { type: Number },
  context_confidence: { type: Number },
  activity_purity: { type: Number },
  quality_gate_pass: { type: Boolean },

  // Evaluations E1-E6
  score_E1: { type: Number },
  pred_E1: { type: String },
  result_E1: { type: String },

  score_E2: { type: Number },
  pred_E2: { type: String },
  result_E2: { type: String },

  score_E3: { type: Number },
  pred_E3: { type: String },
  result_E3: { type: String },

  score_E4: { type: Number },
  pred_E4: { type: String },
  result_E4: { type: String },

  score_E5: { type: Number },
  pred_E5: { type: String },
  result_E5: { type: String },

  score_E6: { type: Number },
  pred_E6: { type: String },
  result_E6: { type: String },
  predicted_state_E6: { type: String },

  // Z-Scores
  z_E1: { type: Number },
  z_E2: { type: Number },
  z_E3: { type: Number },
  z_E4: { type: Number },
}, { timestamps: true });

// Index for query optimization
EpisodeAnalysisSchema.index({ user_id: 1, start_time: -1 });

const EpisodeAnalysis = mongoose.model('EpisodeAnalysis', EpisodeAnalysisSchema);
export default EpisodeAnalysis;
