import mongoose from 'mongoose';

const PatientAppActionSchema = new mongoose.Schema(
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
    action_type: {
      type: String,
      required: true,
      enum: [
        'patient_guidance',
        'measurement',
        'clinical_review',
        'monitoring',
        'other',
      ],
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    details: { type: String, trim: true, maxlength: 500, default: '' },
    decision: {
      level: { type: String, trim: true, maxlength: 32, default: '' },
      title: { type: String, trim: true, maxlength: 160, default: '' },
      policy_version: { type: String, trim: true, maxlength: 80, default: '' },
    },
    status: {
      type: String,
      required: true,
      enum: ['CREATED', 'DELIVERED', 'ACKNOWLEDGED', 'COMPLETED', 'FAILED'],
      default: 'CREATED',
    },
    status_history: {
      type: [{
        status: {
          type: String,
          enum: ['CREATED', 'DELIVERED', 'ACKNOWLEDGED', 'COMPLETED', 'FAILED'],
          required: true,
        },
        changed_at: { type: Date, required: true },
        changed_by: { type: String, enum: ['patient_app'], required: true },
      }],
      default: [],
    },
  },
  { timestamps: true, versionKey: false }
);

PatientAppActionSchema.index({ account_id: 1, account_type: 1, createdAt: -1 });

export default mongoose.model('PatientAppAction', PatientAppActionSchema);
