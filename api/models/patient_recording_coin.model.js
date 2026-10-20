import mongoose from 'mongoose';

const PatientRecordingCoinSchema = new mongoose.Schema(
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
    recording_date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    timezone: { type: String, required: true, maxlength: 64 },
    awarded_at: { type: Date, required: true, default: Date.now },
    sample_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PatientAppWearableSample',
      required: true,
    },
  },
  { timestamps: false, versionKey: false }
);

PatientRecordingCoinSchema.index(
  { account_id: 1, account_type: 1, recording_date: 1 },
  { unique: true }
);

export default mongoose.model(
  'PatientRecordingCoin',
  PatientRecordingCoinSchema
);
