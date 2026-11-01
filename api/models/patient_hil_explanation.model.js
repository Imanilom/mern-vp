import mongoose from 'mongoose';

const PatientHilExplanationSchema = new mongoose.Schema(
  {
    account_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    account_type: {
      type: String,
      required: true,
      enum: ['user', 'patient'],
    },
    session_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PatientHilSession',
      required: true,
      index: true,
    },
    run_id: { type: String, required: true, maxlength: 100 },
    scenario: {
      type: String,
      required: true,
      enum: ['B', 'C'],
    },
    segment_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    sample_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    source_log_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PatientHilScenarioLog',
      required: true,
    },
    activity: { type: String, required: true, trim: true, maxlength: 48 },
    explanation: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1200,
    },
    status: { type: String, required: true, trim: true, maxlength: 64 },
    quality_status: {
      type: String,
      required: true,
      trim: true,
      maxlength: 48,
    },
    baseline_ready: { type: Boolean, required: true },
    factors: {
      type: [{ type: String, trim: true, maxlength: 80 }],
      default: [],
    },
    xai: {
      summary: { type: String, trim: true, maxlength: 500, default: '' },
      confidence: { type: Number, min: 0, max: 1, default: null },
      supporting_factors: {
        type: [{ type: String, trim: true, maxlength: 80 }],
        default: [],
      },
      contradicting_factors: {
        type: [{ type: String, trim: true, maxlength: 80 }],
        default: [],
      },
      trigger_context: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
      decision: { type: String, trim: true, maxlength: 200, default: '' },
    },
    snapshot_version: { type: Number, required: true, default: 1 },
  },
  { timestamps: true, versionKey: false, collection: 'patient_hil_explanations' }
);

PatientHilExplanationSchema.index({
  account_id: 1,
  account_type: 1,
  session_id: 1,
  createdAt: -1,
});
PatientHilExplanationSchema.index({
  account_id: 1,
  account_type: 1,
  createdAt: -1,
});

export default mongoose.model(
  'PatientHilExplanation',
  PatientHilExplanationSchema
);