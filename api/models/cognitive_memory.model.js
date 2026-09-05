import mongoose from 'mongoose';

const CognitiveMemorySchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    week_id: {
      type: String,
      required: true,
      index: true,
    },
    week_number: {
      type: Number,
      default: 1,
    },
    epoch_timestamp: {
      type: Date,
      default: Date.now,
    },
    // Scores recorded for this participant epoch
    scores_snapshot: {
      q1_score: { type: Number, default: 85 },
      q2_score: { type: Number, default: 78 },
      q3_score: { type: Number, default: 80 },
      q4_score: { type: Number, default: 82 },
      q5_score: { type: Number, default: 75 },
      resilience_score: { type: Number, default: 78 },
      damping_ratio: { type: Number, default: 0.85 },
      residual_auc: { type: Number, default: 1.82 },
      ttr_sec: { type: Number, default: 70 },
      peak_1: { type: Number, default: 2.45 },
      ep_rate: { type: Number, default: 0.31 },
    },
    // Behavioral factors confirmed/unconfirmed by patient
    behavioral_factors_snapshot: [
      {
        factor_name: { type: String, required: true },
        category: { type: String, default: '' },
        correlation_pct: { type: Number, default: 0 },
        rag_citation: { type: String, default: '' },
        positive_statement: { type: String, default: '' },
        negative_statement: { type: String, default: '' },
        rag_confidence: { type: Number, default: 0.9 },
        is_physical: { type: Boolean, default: false },
        patient_confirmed: { type: Boolean, default: false },
      },
    ],
    average_behavioral_correlation: {
      type: Number,
      default: 20.0,
    },
    physical_factor_verdict: {
      type: String,
      default: 'BENAR (Faktor Fisik Terkonfirmasi sebagai Pemicu Utama)',
    },
    // Generated RAG Cognitive Feedback for Next Week (W+1)
    next_week_feedback: {
      target_week_id: { type: String, default: 'W02' },
      summary_headline: { type: String, default: '' },
      lifestyle_targets: [{ type: String }],
      clinical_action_items: [{ type: String }],
      projected_improvement_pct: { type: String, default: '15-20%' },
      rag_evidence_basis: { type: String, default: '' },
      generated_at: { type: Date, default: Date.now },
    },
    rag_memory_hash: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast queries per participant and week
CognitiveMemorySchema.index({ user_id: 1, week_id: 1 }, { unique: true });

export default mongoose.model('CognitiveMemory', CognitiveMemorySchema);
