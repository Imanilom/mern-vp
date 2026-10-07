import mongoose from 'mongoose';

const PatientAppWearableSampleSchema = new mongoose.Schema(
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
    provider: {
      type: String,
      required: true,
      enum: ['polar_h10', 'apple_watch', 'garmin', 'fitbit', 'other'],
    },
    recorded_at: { type: Date, required: true },
    heart_rate_bpm: { type: Number, min: 20, max: 250, default: null },
    rr_intervals_ms: {
      type: [{ type: Number, min: 250, max: 3000 }],
      default: [],
      validate: {
        validator: (values) => values.length <= 256,
        message: 'rr_intervals_ms supports up to 256 values per sample.',
      },
    },
    acceleration_g: {
      type: [{
        x: { type: Number, required: true, min: -16, max: 16 },
        y: { type: Number, required: true, min: -16, max: 16 },
        z: { type: Number, required: true, min: -16, max: 16 },
      }],
      required: true,
      validate: {
        validator: (values) => values.length > 0 && values.length <= 512,
        message: 'acceleration_g requires 1-512 tri-axial samples.',
      },
    },
    activity_intensity: {
      type: String,
      enum: ['low', 'moderate', 'vigorous', 'unknown'],
      default: 'unknown',
    },
    posture: {
      type: String,
      enum: ['lying', 'sitting', 'standing', 'unknown'],
      default: 'unknown',
    },
    sensor_contact: { type: Boolean, required: true },
    signal_confidence: { type: Number, min: 0, max: 1, required: true },
    expected_rr_count: { type: Number, min: 1, max: 1000, default: null },
    data_quality: {
      status: { type: String, enum: ['accepted', 'warning', 'rejected'], required: true },
      q_signal: { type: Number, min: 0, max: 1, required: true },
      q_complete: { type: Number, min: 0, max: 1, required: true },
      reasons: { type: [String], default: [] },
      feature_source: { type: String, enum: ['derived_from_rr', 'unavailable'], required: true },
    },
    device_id: { type: String, trim: true, maxlength: 120, required: true },
    ingestion_source: { type: String, enum: ['mobile_wearable_bridge'], default: 'mobile_wearable_bridge' },
    rmssd_ms: { type: Number, min: 0, max: 1000, default: null },
    sdnn_ms: { type: Number, min: 0, max: 1000, default: null },
    dfa_alpha1: { type: Number, min: 0, max: 3, default: null },
    spo2_pct: { type: Number, min: 50, max: 100, default: null },
    steps: { type: Number, min: 0, max: 100000, default: null },
    activity: {
      type: String,
      enum: ['rest', 'sitting', 'standing', 'walking', 'running', 'exercise', 'sleep', 'other', null],
      default: null,
    },
    sleep_duration_minutes: { type: Number, min: 0, max: 1440, default: null },
    sleep_quality: {
      type: String,
      enum: ['very_good', 'good', 'fair', 'poor', null],
      default: null,
    },
    skin_temperature_c: { type: Number, min: 20, max: 45, default: null },
    source: { type: String, enum: ['mobile_wearable_bridge'], default: 'mobile_wearable_bridge' },
  },
  { timestamps: true, versionKey: false }
);

PatientAppWearableSampleSchema.index({ account_id: 1, account_type: 1, recorded_at: -1 });

export default mongoose.model('PatientAppWearableSample', PatientAppWearableSampleSchema);
