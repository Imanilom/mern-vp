import mongoose from 'mongoose';

/**
 * EmaResponse Schema — Penyimpanan jawaban survey Ecological Momentary Assessment (EMA 1–4).
 */
const EmaResponseSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  event_id: {
    type: String,
    default: null,
  },
  step_completed: {
    type: Number,
    required: true,
    enum: [1, 2, 3, 4],
  },
  ema1: {
    activity: { type: String, default: null },
    planned: { type: String, default: null },
    note: { type: String, default: null },
    sleep_status: { type: String, default: null }, // 'Sangat Cukup (>7 jam)', 'Cukup (6-7 jam)', 'Kurang (4-5 jam)', 'Sangat Kurang (<4 jam)'
    sleep_hours: { type: Number, default: null },
    medication_intake: { type: String, default: null }, // 'Tidak Ada', 'Obat Jantung / Antihipertensi', 'Obat Flu / Dekongestan', 'Kafein / Suplemen', 'Lainnya'
    medication_detail: { type: String, default: null },
  },
  ema2: {
    symptom: { type: String, default: null },
    intensity: { type: Number, default: 0 },
    trigger: { type: String, default: null },
  },
  ema3: {
    recovery_status: { type: String, default: null },
    context_change: { type: String, default: null },
    intervention_note: { type: String, default: null },
  },
  ema4: {
    primary_trigger: { type: String, default: null },
    overall_condition: { type: String, default: null },
    disruption_score: { type: Number, default: 0 },
  },
  submitted_at: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

EmaResponseSchema.index({ user_id: 1, submitted_at: -1 });

const EmaResponse = mongoose.model('EmaResponse', EmaResponseSchema);
export default EmaResponse;
