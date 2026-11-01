import mongoose from 'mongoose';

const HiladWindowSchema = new mongoose.Schema({
  account_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  activity: { type: String, required: true, index: true },
  device_id: { type: String, required: true, maxlength: 120 },
  window_start: { type: Number, required: true },
  window_end: { type: Number, required: true },
  sequence: {
    type: [[Number]],
    required: true,
    validate: {
      validator: (rows) => rows.length === 60 && rows.every((row) => row.length === 5),
      message: 'HILAD sequences must contain 60 rows with five normalized features.',
    },
  },
  reconstruction_errors: { type: [[Number]], default: [] },
  reconstruction_score: { type: Number, default: null },
  anomaly_threshold: { type: Number, default: null },
  model_version: { type: Number, default: null },
  is_anomaly_candidate: { type: Boolean, default: null },
  feedback_label: {
    type: String,
    enum: ['normal', 'anomaly', 'spurious_attention', 'correct_attention', null],
    default: null,
  },
  feedback_by: { type: mongoose.Schema.Types.ObjectId, default: null },
  feedback_at: { type: Date, default: null },
  feedback_note: { type: String, trim: true, maxlength: 300, default: '' },
}, { timestamps: true, versionKey: false });

HiladWindowSchema.index(
  { account_id: 1, activity: 1, window_start: 1 },
  { unique: true }
);
HiladWindowSchema.index({ account_id: 1, activity: 1, window_end: -1 });

export default mongoose.model('HiladWindow', HiladWindowSchema);
