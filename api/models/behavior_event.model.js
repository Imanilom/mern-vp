import mongoose from 'mongoose';

const behaviorEventSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  timestamp_start: {
    type: Number, // epoch ms
    required: true,
    index: true
  },
  timestamp_end: {
    type: Number, // epoch ms
    required: true
  },
  behavior_type: {
    type: String,
    required: true,
    enum: [
      'physical_activity',
      'mental_stress',
      'pain_discomfort',
      'environmental_factor',
      'caffeine',
      'sedentary',
      'smoking',
      'alcohol',
      'sleep_duration',
      'sleep_regularity',
      'diet_quality',
      'ultra_processed_food',
      'stress_job_strain',
      'shift_work',
      'working_hours',
      'meal_timing',
      'other'
    ],
    index: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  intensity: {
    type: String,
    enum: ['low', 'moderate', 'vigorous', 'none', 'high', 'severe', 'mild'],
    default: 'moderate'
  },
  unit: {
    type: String,
    default: 'minutes'
  },
  source: {
    type: String,
    enum: ['user_reported', 'wearable_inferred', 'ema', 'clinician_entry', 'participant_context_confirmation', 'mobile_app'],
    default: 'user_reported'
  },
  confidence: {
    type: Number,
    min: 0.0,
    max: 1.0,
    default: 0.90
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

export default mongoose.model('BehaviorEvent', behaviorEventSchema);
