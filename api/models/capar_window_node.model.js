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
    time_period: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'night', null],
      default: null,
    },
    raw_count: { type: Number, default: 0 },
    is_valid: { type: Boolean, default: true },
    rr_status: { type: String, default: null },
    signal_quality_detail: {
      q_signal: { type: Number, default: null },
      q_complete: { type: Number, default: null },
      q_context: { type: Number, default: null },
      reasons: { type: [String], default: undefined },
    },
    activity_label: { type: String, default: 'Unknown' },
    analyzed: { type: Boolean, default: false },
    classification: {
      type: String,
      enum: ['Normal', 'Caution', 'Alert', null],
      default: null,
    },
    anomaly_score: { type: Number, default: null },
    features: {
      mean_hr: { type: Number, default: null },
      mean_rr: { type: Number, default: null },
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
