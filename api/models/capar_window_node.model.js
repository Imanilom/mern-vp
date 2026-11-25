import mongoose from 'mongoose';

const CaparWindowNodeSchema = new mongoose.Schema(
  {
    account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    segment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Segment',
      required: true,
      unique: true,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    window_start: { type: Number, required: true },
    window_end: { type: Number, required: true },
    window_type: { type: String, enum: ['5min', '1min'], required: true },
    activity_label: {
      type: String,
      enum: ['Rest', 'Light', 'Moderate', 'Intense', 'Unknown'],
      default: 'Unknown',
    },
    analyzed: { type: Boolean, default: false },
    classification: {
      type: String,
      enum: ['Normal', 'Caution', 'Alert', null],
      default: null,
    },
    anomaly_score: { type: Number, default: null },
    features: {
      mean_hr: { type: Number, default: null },
      sdnn: { type: Number, default: null },
      rmssd: { type: Number, default: null },
      dfa_alpha1: { type: Number, default: null },
      motion_intensity: { type: Number, default: null },
    },
  },
  { timestamps: true, versionKey: false, collection: 'capar_window_nodes' }
);

CaparWindowNodeSchema.index({ account_id: 1, createdAt: -1 });

export default mongoose.model('CaparWindowNode', CaparWindowNodeSchema);
