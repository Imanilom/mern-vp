import mongoose from 'mongoose';

const MarkovTransitionSchema = new mongoose.Schema({
  next_state: { type: String, required: true },
  probability: { type: Number, default: 0.0 }, // Computed probability P(j|i)
  count: { type: Number, default: 0 },         // Raw occurrences
  allowed: { type: Boolean, default: true }    // Structurally allowed by CAPAR state machine
}, { _id: false });

const MarkovMatrixRowSchema = new mongoose.Schema({
  current_state: { type: String, required: true },
  transitions: [MarkovTransitionSchema]
}, { _id: false });

const MarkovModelSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  // Parameter Dirichlet smoothing
  alpha: { 
    type: Number, 
    default: 0.5 
  },
  
  // The serialized 2D Matrix of transition probabilities
  matrix: [MarkovMatrixRowSchema],
  
  // Prediction status (INSUFFICIENT_DATA means using global/fallback weights)
  status: {
    type: String,
    enum: ['INSUFFICIENT_DATA', 'LEARNING', 'READY'],
    default: 'INSUFFICIENT_DATA'
  },
  
  // Metadata for tracing and dashboard display
  total_transitions_learned: { type: Number, default: 0 },
  episode_count: { type: Number, default: 0 },
  anomaly_event_count: { type: Number, default: 0 },
  
  last_computed_at: { type: Date, default: Date.now },

}, { timestamps: true });

// Ensure fast lookup per user

const MarkovModel = mongoose.model('MarkovModel', MarkovModelSchema);
export default MarkovModel;
