import mongoose from 'mongoose';

const PhenotypeProfileSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    evaluator_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Answers for Q1 to Q10
    answers: {
      type: Map,
      of: new mongoose.Schema({
        q_id: { type: String, required: true },
        title: { type: String, default: '' },
        answer_label: { type: String, default: '' },
        narrative: { type: String, default: '' },
        evidence: { type: String, default: '' },
        metrics: { type: String, default: '' },
        confidence: { type: String, enum: ['tinggi', 'sedang', 'rendah'], default: 'tinggi' },
        confidence_score: { type: Number, default: 0.85 },
      }, { _id: false }),
      default: {},
    },
    // Vektor Fenotipe Phi = [F, M, D, R, S, C, T, K, U] & Continuous Phi Vector
    phenotype_vector: {
      F: { type: String, default: '' }, // Frequency
      M: { type: String, default: '' }, // Magnitude
      D: { type: String, default: '' }, // Duration
      R: { type: String, default: '' }, // Recovery
      S: { type: String, default: '' }, // Stability
      C: { type: String, default: '' }, // Context
      T: { type: String, default: '' }, // Time-of-day
      K: { type: String, default: '' }, // Consistency
      U: { type: String, default: '' }, // Unexplained
      // Quantitative Continuous Vector φ = [f_dev, M_dev, D_dev, V_rec, R_rel, C_cum, Δ_diurnal, K_day, N_unexp]
      phi_quantitative: {
        f_dev: { type: Number, default: 0 },
        m_dev: { type: Number, default: 0 },
        d_dev: { type: Number, default: 0 },
        v_rec: { type: Number, default: 0 },
        r_rel: { type: Number, default: 0 },
        c_cum: { type: Number, default: 0 },
        delta_diurnal: { type: Number, default: 0 },
        k_day: { type: Number, default: 0 },
        n_unexp: { type: Number, default: 0 },
      },
      // Dimension Scores (0 - 100)
      dimension_scores: {
        type: Map,
        of: Number,
        default: {},
      },
    },
    candidate_phenotype: {
      type: String,
      enum: [
        'Efficient / Stable Regulation',
        'Delayed Recovery Candidate',
        'Unstable Recovery Candidate',
        'Persistent Dysregulation Candidate',
        'Recurrent Unexplained Deviation',
        'Pending Evaluation',
        'Other',
      ],
      default: 'Pending Evaluation',
    },
    // RAG Behavioral Factors & Correlation Scoring (15 Human Behaviors)
    behavioral_scoring: {
      factors: [{
        id: { type: String, default: '' },
        factor_name: { type: String, default: '' },
        category: { type: String, default: '' },
        correlation_pct: { type: Number, default: 0 },
        rag_citation: { type: String, default: '' },
        description: { type: String, default: '' },
        positive_statement: { type: String, default: '' },
        negative_statement: { type: String, default: '' },
        rag_confidence: { type: Number, default: 0.9 },
        is_physical: { type: Boolean, default: false },
        patient_confirmed: { type: Boolean, default: false },
      }],
      average_correlation_pct: { type: Number, default: 0 },
      average_confidence: { type: Number, default: 0.9 },
      confirmed_at: { type: Date, default: null },
      is_patient_confirmed: { type: Boolean, default: false },
    },
    clinical_notes: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['draft', 'saved', 'active', 'validated'],
      default: 'saved',
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export default mongoose.model('PhenotypeProfile', PhenotypeProfileSchema);
