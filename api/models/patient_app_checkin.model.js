import mongoose from 'mongoose';

const PatientAppCheckInSchema = new mongoose.Schema(
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
    recorded_at: { type: Date, required: true, default: Date.now },
    feeling: {
      type: String,
      enum: ['good', 'fair', 'poor', 'very_poor', null],
      default: null,
    },
    activity: {
      type: String,
      enum: ['rest', 'sitting', 'standing', 'walking', 'exercise', 'work', 'meal', 'other', null],
      default: null,
    },
    posture: {
      type: String,
      enum: ['lying', 'sitting', 'standing', 'unknown', null],
      default: null,
    },
    symptoms: {
      type: [{
        type: String,
        enum: [
          'fatigue',
          'dizziness',
          'palpitations',
          'breathlessness',
          'chest_pain',
          'headache',
          'pain',
          'nausea',
          'weakness',
          'fever',
          'other',
        ],
      }],
      default: [],
    },
    symptom_severity: { type: Number, min: 1, max: 10, default: null },
    deviation_follow_up: {
      segment_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Segment',
        default: null,
      },
      perceived_factors: {
        type: [{
          type: String,
          enum: [
            'physical_activity',
            'stress',
            'poor_sleep',
            'medication',
            'food_or_caffeine',
            'illness',
            'pain',
            'other',
            'no_known_factor',
            'prefer_not_to_say',
          ],
        }],
        default: [],
      },
      symptom_onset: {
        type: String,
        enum: ['before_deviation', 'around_deviation', 'after_deviation', 'unknown', null],
        default: null,
      },
      note: { type: String, trim: true, maxlength: 500, default: '' },
      action_taken: { type: String, trim: true, maxlength: 300, default: '' },
      response_after_action: { type: String, trim: true, maxlength: 500, default: '' },
    },
    stress_level: { type: Number, min: 1, max: 3, default: null },
    hydration_ml: { type: Number, min: 0, max: 10000, default: null },
    lifestyle: {
      meal: { type: Boolean, default: null },
      caffeine: { type: Boolean, default: null },
      alcohol: { type: Boolean, default: null },
      smoking: { type: Boolean, default: null },
    },
    sleep: {
      duration_minutes: { type: Number, min: 0, max: 1440, default: null },
      quality: {
        type: String,
        enum: ['very_good', 'good', 'fair', 'poor', null],
        default: null,
      },
      bedtime: { type: String, match: /^(?:[01]\d|2[0-3]):[0-5]\d$/, default: null },
      wake_time: { type: String, match: /^(?:[01]\d|2[0-3]):[0-5]\d$/, default: null },
      disturbances: {
        woke_frequently: { type: Boolean, default: null },
        difficulty_falling_asleep: { type: Boolean, default: null },
        nightmares: { type: Boolean, default: null },
      },
    },
    medication_taken: { type: Boolean, default: null },
    medication_name: { type: String, trim: true, maxlength: 120, default: '' },
    medication_dosage: { type: String, trim: true, maxlength: 80, default: '' },
    medication_taken_at: { type: Date, default: null },
    medication_note: { type: String, trim: true, maxlength: 200, default: '' },
    measurements: {
      systolic_bp: { type: Number, min: 50, max: 300, default: null },
      diastolic_bp: { type: Number, min: 20, max: 200, default: null },
      temperature_c: { type: Number, min: 30, max: 45, default: null },
      weight_kg: { type: Number, min: 2, max: 350, default: null },
      spo2_pct: { type: Number, min: 50, max: 100, default: null },
      glucose_mg_dl: { type: Number, min: 20, max: 1000, default: null },
      additional: {
        type: [{
          name: { type: String, trim: true, maxlength: 80, required: true },
          unit: { type: String, trim: true, maxlength: 24, default: '' },
          value: { type: String, trim: true, maxlength: 80, required: true },
        }],
        default: [],
      },
    },
    note: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true, versionKey: false }
);

PatientAppCheckInSchema.index({ account_id: 1, account_type: 1, recorded_at: -1 });

export default mongoose.model('PatientAppCheckIn', PatientAppCheckInSchema);
