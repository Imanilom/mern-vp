import mongoose from 'mongoose';

const InterpretationSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    scenario_id: { type: String, enum: ['a', 'b', 'c'], required: true },
    created_at: { type: Date, required: true },
    status: {
      type: String,
      enum: [
        'BASELINE_COMPATIBLE',
        'DEVIATION_CANDIDATE',
        'PERSISTENT_DEVIATION',
        'RECOVERY',
        'RECOVERED',
        'UNRESOLVED',
      ],
      required: true,
    },
    processing_state: {
      type: String,
      enum: ['APPLIED', 'NEEDS_REVIEW'],
      required: true,
    },
    reason_code: { type: String, default: null },
    context: { type: mongoose.Schema.Types.Mixed, required: true },
    observed_at: { type: Date, default: null },
    observation: { type: mongoose.Schema.Types.Mixed, required: true },
    baseline: { type: mongoose.Schema.Types.Mixed, required: true },
    statistical_evidence: { type: mongoose.Schema.Types.Mixed, default: null },
    uncertainty: { type: String, required: true },
    reason: { type: String, required: true },
    trigger_event_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    previous_version: { type: Number, default: null },
    rule_version: { type: String, required: true },
  },
  { _id: false }
);

const PatientScenarioSessionSchema = new mongoose.Schema(
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
    participant_pseudonym: { type: String, required: true },
    scenario_id: { type: String, enum: ['a', 'b', 'c'], required: true },
    consent: {
      given: { type: Boolean, required: true },
      recorded_at: { type: Date, required: true },
      version: { type: String, required: true },
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'COMPLETED'],
      default: 'ACTIVE',
    },
    source: {
      type: String,
      enum: [
        'CAPAR_ANALYTICS_SEGMENT',
        'NO_QUALIFIED_OBSERVATION',
        'RECORDED_POLAR_SAMPLE',
      ],
      required: true,
    },
    current_interpretation_version: { type: Number, required: true, default: 1 },
    interpretations: { type: [InterpretationSchema], default: [] },
  },
  { timestamps: true, versionKey: false }
);

PatientScenarioSessionSchema.index({
  account_id: 1,
  account_type: 1,
  scenario_id: 1,
  createdAt: -1,
});

export default mongoose.model(
  'PatientScenarioSession',
  PatientScenarioSessionSchema
);
