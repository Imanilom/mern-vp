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
    scenario: {
      type: String,
      required: true,
      enum: ['B', 'C'],
    },
    segment_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
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
    snapshot_version: { type: Number, required: true, default: 1 },
  },
  { timestamps: true, versionKey: false, collection: 'patient_hil_explanations' }
);

PatientHilExplanationSchema.index({
  account_id: 1,
  account_type: 1,
  createdAt: -1,
});

export default mongoose.model(
  'PatientHilExplanation',
  PatientHilExplanationSchema
);
