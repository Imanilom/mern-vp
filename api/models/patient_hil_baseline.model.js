import mongoose from 'mongoose';

const PatientHilBaselineSchema = new mongoose.Schema(
  {
    account_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    account_type: {
      type: String,
      required: true,
      enum: ['user', 'patient'],
    },
    recording_purpose: {
      type: String,
      required: true,
      enum: ['hil_baseline'],
    },
    activity: {
      type: String,
      required: true,
      enum: ['sitting', 'standing', 'walking'],
    },
    window_start: { type: Number, required: true },
    sample_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    recorded_at: { type: Date, required: true },
    quality: {
      q_signal: { type: Number, min: 0, max: 1, required: true },
      q_complete: { type: Number, min: 0, max: 1, required: true },
    },
    features: {
      mean_hr: { type: Number, default: null },
      mean_rr: { type: Number, default: null },
      rmssd: { type: Number, default: null },
      sdnn: { type: Number, default: null },
      dfa_alpha1: { type: Number, default: null },
      motion_intensity: { type: Number, default: null },
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'patient_hil_baselines',
  }
);

PatientHilBaselineSchema.index(
  { account_id: 1, account_type: 1, activity: 1, window_start: 1 },
  { unique: true }
);
PatientHilBaselineSchema.index(
  { account_id: 1, account_type: 1, activity: 1, recorded_at: -1 }
);

export default mongoose.model('PatientHilBaseline', PatientHilBaselineSchema);
