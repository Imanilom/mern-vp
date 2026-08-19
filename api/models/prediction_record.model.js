import mongoose from 'mongoose';

const PredictionRecordSchema = new mongoose.Schema({
  participant_id: {
    type: String,
    required: true,
    index: true,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  prediction_time: {
    type: Date,
    default: Date.now,
    index: true,
  },
  current_state: {
    type: String,
    required: true,
  },
  horizon_windows: {
    type: Number,
    default: 3,
  },
  probabilities: {
    BASELINE_COMPATIBLE: { type: Number, required: true },
    DEVIATION_CANDIDATE: { type: Number, required: true },
    PERSISTENT_DEVIATION: { type: Number, required: true },
    RECOVERY_START: { type: Number, required: true },
    RECOVERED: { type: Number, required: true },
  },
  predicted_state: {
    type: String,
    required: true,
  },
  actual_state: {
    type: String,
    default: null,
  },
  model_version: {
    type: String,
    default: 'MK-P00-01',
  },
  evaluated: {
    type: Boolean,
    default: false,
  },
  evaluated_at: {
    type: Date,
  },
}, { timestamps: true });

export default mongoose.model('PredictionRecord', PredictionRecordSchema);
