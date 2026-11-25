import mongoose from 'mongoose';

const SeriesPointSchema = new mongoose.Schema(
  {
    segment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Segment', required: true },
    window_start: { type: Number, required: true },
    window_end: { type: Number, required: true },
    is_valid: { type: Boolean, required: true },
    rr_status: { type: String, default: null },
    raw_count: { type: Number, default: 0 },
    mean_hr: { type: Number, default: null },
    mean_rr: { type: Number, default: null },
    motion_intensity: { type: Number, default: null },
    rmssd: { type: Number, default: null },
    dfa_alpha1: { type: Number, default: null },
  },
  { _id: false }
);

const SummarySchema = new mongoose.Schema(
  {
    window_count: { type: Number, required: true },
    valid_window_count: { type: Number, required: true },
    invalid_window_count: { type: Number, required: true },
    raw_sample_count: { type: Number, default: 0 },
    mean_hr: { type: Number, default: null },
    min_hr: { type: Number, default: null },
    max_hr: { type: Number, default: null },
    hr_variance: { type: Number, default: null },
    hr_rr_covariance: { type: Number, default: null },
    hr_rr_pair_count: { type: Number, default: 0 },
    mean_rr: { type: Number, default: null },
    mean_motion_intensity: { type: Number, default: null },
    mean_rmssd: { type: Number, default: null },
    mean_dfa_alpha1: { type: Number, default: null },
  },
  { _id: false }
);

const CaparActivityTimeSeriesSchema = new mongoose.Schema(
  {
    account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    episode_key: { type: String, required: true },
    device_id: { type: String, required: true },
    window_type: { type: String, enum: ['1min', '5min'], required: true },
    day_key: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    activity_label: { type: String, required: true },
    episode_start: { type: Number, required: true },
    episode_end: { type: Number, required: true },
    source_segment_ids: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Segment',
    }],
    summary: { type: SummarySchema, required: true },
    series_points: { type: [SeriesPointSchema], default: [] },
    generated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'capar_activity_time_series_aggregates',
  }
);

CaparActivityTimeSeriesSchema.index(
  { account_id: 1, episode_key: 1 },
  { unique: true }
);
CaparActivityTimeSeriesSchema.index({ account_id: 1, episode_start: 1 });
CaparActivityTimeSeriesSchema.index({
  account_id: 1,
  activity_label: 1,
  episode_start: 1,
});

export default mongoose.model(
  'CaparActivityTimeSeries',
  CaparActivityTimeSeriesSchema
);
