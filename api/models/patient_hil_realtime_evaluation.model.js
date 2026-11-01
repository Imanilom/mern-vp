import mongoose from 'mongoose';

const PatientHilRealtimeReadingSchema = new mongoose.Schema(
  {
    recorded_at: { type: Date, required: true },
    heart_rate_bpm: { type: Number, required: true, min: 20, max: 250 },
    rr_interval_ms: { type: Number, required: true, min: 250, max: 3000 },
    acceleration_g: {
      type: [{ type: Number, min: -16, max: 16 }],
      required: true,
      validate: (values) => values.length === 3,
    },
    sensor_contact: { type: Boolean, required: true },
    signal_confidence: { type: Number, required: true, min: 0, max: 1 },
  },
  { _id: false }
);

const PatientHilRealtimeEvaluationSchema = new mongoose.Schema(
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
    run_id: { type: String, required: true, maxlength: 100, index: true },
    activity: {
      type: String,
      required: true,
      enum: ['sitting', 'standing', 'walking'],
    },
    device_id: { type: String, required: true, maxlength: 120 },
    evaluation_kind: {
      type: String,
      required: true,
      enum: ['hr_window', 'five_minute_rr_batch'],
    },
    evaluated_at: { type: Date, required: true },
    readings: {
      type: [PatientHilRealtimeReadingSchema],
      required: true,
      validate: (values) => values.length >= 1 && values.length <= 100,
    },
    dfa_rr_intervals_ms: {
      type: [{ type: Number, min: 250, max: 3000 }],
      default: [],
      validate: (values) => values.length <= 1200,
    },
    previous_mean_hr: { type: Number, min: 20, max: 250, default: null },
    previous_elevated: { type: Boolean, default: false },
    analysis: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'patient_hil_realtime_evaluations',
  }
);

PatientHilRealtimeEvaluationSchema.index({
  account_id: 1,
  account_type: 1,
  run_id: 1,
  evaluated_at: 1,
});

export default mongoose.model(
  'PatientHilRealtimeEvaluation',
  PatientHilRealtimeEvaluationSchema
);
