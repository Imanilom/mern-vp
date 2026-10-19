import mongoose from 'mongoose';

const PatientScenarioQuestionnaireSchema = new mongoose.Schema(
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
    scenario_id: { type: String, enum: ['c'], required: true },
    instrument: { type: String, enum: ['SUS', 'NASA_TLX'], required: true },
    responses: { type: mongoose.Schema.Types.Mixed, required: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    score_unit: { type: String, required: true },
    score_summary: { type: String, required: true },
    submitted_at: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false }
);

PatientScenarioQuestionnaireSchema.index(
  { session_id: 1, instrument: 1 },
  { unique: true }
);
PatientScenarioQuestionnaireSchema.index({
  account_id: 1,
  account_type: 1,
  session_id: 1,
  submitted_at: 1,
});

export default mongoose.model(
  'PatientScenarioQuestionnaire',
  PatientScenarioQuestionnaireSchema
);
