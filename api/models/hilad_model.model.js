import mongoose from 'mongoose';

const HiladModelSchema = new mongoose.Schema({
  account_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  activity: { type: String, required: true, index: true },
  status: {
    type: String,
    enum: ['warming_up', 'training', 'ready', 'failed'],
    default: 'warming_up',
  },
  version: { type: Number, default: 0 },
  window_size: { type: Number, required: true, default: 60 },
  feature_count: { type: Number, required: true, default: 5 },
  weights: { type: [mongoose.Schema.Types.Mixed], default: [] },
  anomaly_threshold: { type: Number, default: null },
  training_window_count: { type: Number, default: 0 },
  last_trained_at: { type: Date, default: null },
  last_error: { type: String, default: null, maxlength: 500 },
}, { timestamps: true, versionKey: false });

HiladModelSchema.index({ account_id: 1, activity: 1 }, { unique: true });

export default mongoose.model('HiladModel', HiladModelSchema);
