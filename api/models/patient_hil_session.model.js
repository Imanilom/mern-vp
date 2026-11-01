import mongoose from 'mongoose';

const PatientHilSessionSchema = new mongoose.Schema(
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
    run_id: { type: String, required: true, maxlength: 100 },
    scenario: { type: String, required: true, enum: ['B', 'C'] },
    source: {
      type: String,
      required: true,
      enum: ['recorded_polar_sample', 'realtime_wearable'],
    },
    activity: {
      type: String,
      required: true,
      enum: ['sitting', 'standing', 'walking'],
    },
    status: {
      type: String,
      required: true,
      enum: ['active', 'completed'],
      default: 'active',
    },
    started_at: { type: Date, required: true, default: Date.now },
    completed_at: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'patient_hil_sessions',
  }
);

PatientHilSessionSchema.index(
  { account_id: 1, account_type: 1, run_id: 1 },
  { unique: true }
);
PatientHilSessionSchema.index({
  account_id: 1,
  account_type: 1,
  createdAt: -1,
});

export default mongoose.model('PatientHilSession', PatientHilSessionSchema);
