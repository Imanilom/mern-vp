import mongoose from 'mongoose';

const MedicationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    dosage: { type: String, default: '', trim: true, maxlength: 80 },
    schedule: { type: String, default: '', trim: true, maxlength: 120 },
  },
  { _id: false }
);

const PatientAppProfileSchema = new mongoose.Schema(
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
    timezone: { type: String, trim: true, maxlength: 64, default: 'Asia/Jakarta' },
    date_of_birth: { type: Date, default: null },
    sex: {
      type: String,
      enum: ['female', 'male', 'other', null],
      default: null,
    },
    height_cm: { type: Number, min: 50, max: 250, default: null },
    weight_kg: { type: Number, min: 2, max: 350, default: null },
    blood_type: { type: String, trim: true, maxlength: 3, default: '' },
    emergency_contact_name: { type: String, trim: true, maxlength: 120, default: '' },
    emergency_contact_phone: { type: String, trim: true, maxlength: 30, default: '' },
    conditions: {
      type: [{ type: String, trim: true, maxlength: 120 }],
      default: [],
    },
    allergies: {
      type: [{ type: String, trim: true, maxlength: 120 }],
      default: [],
    },
    allergies_reviewed: { type: Boolean, default: false },
    special_conditions: {
      type: [{ type: String, trim: true, maxlength: 120 }],
      default: [],
    },
    clinical_note: { type: String, trim: true, maxlength: 500, default: '' },
    medications: { type: [MedicationSchema], default: [] },
    medication_reviewed: { type: Boolean, default: false },
    data_sharing: {
      share_with_clinician: { type: Boolean, default: false },
      share_with_family: { type: Boolean, default: false },
      consent_updated_at: { type: Date, default: null },
    },
    goal: {
      type: String,
      enum: ['daily_monitoring', 'early_awareness', 'fitness', 'other'],
      default: 'daily_monitoring',
    },
    notification_preferences: {
      morning_summary: { type: Boolean, default: true },
      important_alerts: { type: Boolean, default: true },
      health_education: { type: Boolean, default: true },
      quiet_start: { type: String, default: '22:00' },
      quiet_end: { type: String, default: '07:00' },
    },
    wearable_provider: {
      type: String,
      enum: ['none', 'polar_h10', 'apple_watch', 'garmin', 'fitbit', 'other'],
      default: 'none',
    },
  },
  { timestamps: true, versionKey: false }
);

PatientAppProfileSchema.index(
  { account_id: 1, account_type: 1 },
  { unique: true }
);

export default mongoose.model('PatientAppProfile', PatientAppProfileSchema);
