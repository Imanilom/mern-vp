import mongoose from 'mongoose';

const PatientHilScenarioHistorySchema = new mongoose.Schema(
  {
    sample_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    recorded_at: { type: Date, required: true },
    activity: {
      type: String,
      required: true,
      enum: ['sitting', 'standing', 'walking'],
    },
    heart_rate_bpm: { type: Number, required: true, min: 20, max: 250 },
    q_signal: { type: Number, min: 0, max: 1, default: null },
    q_complete: { type: Number, min: 0, max: 1, default: null },
    quality_status: {
      type: String,
      required: true,
      enum: ['accepted', 'warning'],
    },
  },
  { _id: false }
);

const PatientHilScenarioLogSchema = new mongoose.Schema(
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
    session_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PatientHilSession',
      required: true,
      index: true,
    },
    run_id: { type: String, required: true, maxlength: 80, index: true },
    scenario: { type: String, required: true, enum: ['B', 'C'] },
    event_type: {
      type: String,
      required: true,
      enum: [
        'scenario_started',
        'activity_selected',
        'live_recording_started',
        'live_recording_stopped',
        'live_recording_interrupted',
        'records_loaded',
        'deviation_detected',
        'feedback_presented',
        'clarification_requested',
        'clarification_submitted',
        'zero_shot_generated',
        'zero_shot_failed',
        'activity_repeat_selected',
        'activity_context_sufficient',
        'activity_repeat_skipped',
        'observation_frozen',
      ],
    },
    activity: {
      type: String,
      required: true,
      enum: ['sitting', 'standing', 'walking'],
    },
    history: { type: [PatientHilScenarioHistorySchema], default: [] },
    sample_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    observed_at: { type: Date, default: null },
    heart_rate_bpm: { type: Number, min: 20, max: 250, default: null },
    raw_hr: { type: Number, min: 20, max: 250, default: null },
    raw_recorded_at: { type: Date, default: null },
    baseline_mean_hr: { type: Number, min: 20, max: 250, default: null },
    baseline_std_hr: { type: Number, min: 0, max: 100, default: null },
    threshold_bpm: { type: Number, min: 0, max: 200, default: null },
    z_score: { type: Number, min: -100, max: 100, default: null },
    q_signal: { type: Number, min: 0, max: 1, default: null },
    raw_signal_quality: { type: Number, min: 0, max: 1, default: null },
    q_complete: { type: Number, min: 0, max: 1, default: null },
    quality_status: {
      type: String,
      enum: ['accepted', 'warning', 'unavailable', null],
      default: null,
    },
    algorithm_status: {
      type: String,
      enum: ['candidate_deviation', 'normal', 'not_assessable', null],
      default: null,
    },
    recommendation: { type: String, trim: true, maxlength: 500, default: '' },
    clarification: { type: String, trim: true, maxlength: 500, default: '' },
    explanation: { type: String, trim: true, maxlength: 1200, default: '' },
    source: {
      type: String,
      required: true,
      enum: ['patient_app_wearable_sample'],
      default: 'patient_app_wearable_sample',
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'patient_hil_scenario_logs',
  }
);

PatientHilScenarioLogSchema.index({
  account_id: 1,
  account_type: 1,
  run_id: 1,
  createdAt: 1,
});

export default mongoose.model(
  'PatientHilScenarioLog',
  PatientHilScenarioLogSchema
);