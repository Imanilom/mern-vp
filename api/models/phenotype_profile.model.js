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
      }, { _id: false }),
      default: {},
    },
    // Vektor Fenotipe Phi = [F, M, D, R, S, C, T, K, U]
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
