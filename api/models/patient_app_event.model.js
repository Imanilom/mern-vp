import mongoose from 'mongoose';

const PatientAppEventSchema = new mongoose.Schema(
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
    event_type: {
      type: String,
      required: true,
      enum: [
        'exercise_started',
        'exercise_ended',
        'sleep_started',
        'woke_up',
        'meal',
        'medication',
        'stress',
        'symptom',
        'caffeine',
        'alcohol',
        'smoking',
        'hydration',
        'illness',
        'posture_change',
        'menstruation',
        'other',
      ],
    },
    occurred_at: { type: Date, required: true, default: Date.now },
    details: { type: String, trim: true, maxlength: 300, default: '' },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
    intensity: {
      type: String,
      enum: ['low', 'moderate', 'vigorous', 'none', 'high', 'severe', 'mild', null],
      default: null,
    },
    unit: { type: String, trim: true, maxlength: 32, default: '' },
    source: {
      type: String,
      enum: ['patient_reported', 'mobile_app', 'clinician_entry'],
      default: 'patient_reported',
    },
  },
  { timestamps: true, versionKey: false }
);

PatientAppEventSchema.index({ account_id: 1, account_type: 1, occurred_at: -1 });

export default mongoose.model('PatientAppEvent', PatientAppEventSchema);
