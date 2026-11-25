import mongoose from 'mongoose';

const ActivitySummarySchema = new mongoose.Schema(
  {
    activity: { type: String, required: true },
    window_count: { type: Number, required: true },
    valid_window_count: { type: Number, required: true },
    invalid_window_count: { type: Number, required: true },
    raw_sample_count: { type: Number, default: 0 },
    mean_hr: { type: Number, default: null },
    mean_rr: { type: Number, default: null },
    mean_motion_intensity: { type: Number, default: null },
    mean_dfa_alpha1: { type: Number, default: null },
    mean_rmssd: { type: Number, default: null },
    hr_variance: { type: Number, default: null },
    hr_rr_covariance: { type: Number, default: null },
    hr_rr_pair_count: { type: Number, default: 0 },
    min_hr: { type: Number, default: null },
    max_hr: { type: Number, default: null },
    paired_mean_hr: { type: Number, default: null },
    paired_mean_rr: { type: Number, default: null },
  },
  { _id: false }
);

const ActivityRunSchema = new mongoose.Schema(
  {
    activity: { type: String, required: true },
    start_time: { type: Number, required: true },
    end_time: { type: Number, required: true },
    duration_ms: { type: Number, required: true },
    window_count: { type: Number, required: true },
    first_segment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Segment' },
    last_segment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Segment' },
  },
  { _id: false }
);

const TransitionSchema = new mongoose.Schema(
  {
    from_activity: { type: String, required: true },
    to_activity: { type: String, required: true },
    from_segment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Segment' },
    to_segment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Segment' },
    from_start: { type: Number, required: true },
    from_end: { type: Number, required: true },
    to_start: { type: Number, required: true },
    activity_duration_ms: { type: Number, required: true },
    elapsed_between_activity_starts_ms: { type: Number, required: true },
    gap_ms: { type: Number, required: true },
  },
  { _id: false }
);

const BaselineSnapshotSchema = new mongoose.Schema(
  {
    activity: { type: String, required: true },
    time_period: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'night'],
      required: true,
    },
    segment_count: { type: Number, default: 0 },
    is_mature: { type: Boolean, default: false },
    maturity_level: { type: String, default: null },
    mean_hr: { type: Number, default: null },
    std_hr: { type: Number, default: null },
    mean_rr: { type: Number, default: null },
    mean_motion_intensity: { type: Number, default: null },
    mean_rmssd: { type: Number, default: null },
    mean_dfa_alpha1: { type: Number, default: null },
  },
  { _id: false }
);

const CaparWindowDailyAnalysisSchema = new mongoose.Schema(
  {
    account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    analysis_date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    source_window_count: { type: Number, required: true },
    valid_window_count: { type: Number, required: true },
    invalid_window_count: { type: Number, required: true },
    source_segment_ids: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Segment',
    }],
    activity_summaries: { type: [ActivitySummarySchema], default: [] },
    activity_runs: { type: [ActivityRunSchema], default: [] },
    transitions: { type: [TransitionSchema], default: [] },
    baseline_snapshots: { type: [BaselineSnapshotSchema], default: [] },
    analysis_version: { type: String, default: 'capar-window-daily-v1' },
    generated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'capar_window_daily_analyses',
  }
);

CaparWindowDailyAnalysisSchema.index(
  { account_id: 1, analysis_date: 1 },
  { unique: true }
);

export default mongoose.model(
  'CaparWindowDailyAnalysis',
  CaparWindowDailyAnalysisSchema
);
