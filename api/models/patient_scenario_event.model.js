import mongoose from 'mongoose';

const PatientScenarioEventSchema = new mongoose.Schema(
  {
    session_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PatientScenarioSession',
      required: true,
      index: true,
    },
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
    participant_pseudonym: { type: String, required: true },
    scenario_id: { type: String, enum: ['a', 'b', 'c'], required: true },
    idempotency_key: { type: String, required: true, maxlength: 128 },
    actor_type: { type: String, enum: ['participant'], required: true },
    source: { type: String, enum: ['vidyamedic_app'], required: true },
    event_type: { type: String, enum: ['activity_correction'], required: true },
    event_time: { type: Date, required: true },
    report_time: { type: Date, required: true },
    input_type: { type: String, enum: ['activity', 'unsure'], required: true },
    value: { type: String, required: true },
    confidence: { type: String, enum: ['certain', 'unsure'], required: true },
    affected_interval: {
      start: { type: Date, required: true },
      end: { type: Date, required: true },
    },
    previous_context: { type: String, default: null },
    current_context: { type: String, default: null },
    previous_version: { type: Number, required: true },
    new_version: { type: Number, default: null },
    processing_state: {
      type: String,
      enum: [
        'RECEIVED',
        'APPLIED',
        'NEEDS_REVIEW',
        'REJECTED_WITH_REASON',
      ],
      required: true,
    },
    reason_code: { type: String, default: null },
    evidence_quality: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true, versionKey: false }
);

PatientScenarioEventSchema.index(
  { session_id: 1, idempotency_key: 1 },
  { unique: true }
);
PatientScenarioEventSchema.index({
  account_id: 1,
  account_type: 1,
  session_id: 1,
  event_time: 1,
});

export default mongoose.model(
  'PatientScenarioEvent',
  PatientScenarioEventSchema
);
