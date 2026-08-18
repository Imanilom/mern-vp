/**
 * state_transition.model.js
 *
 * Menyimpan transition counts N_(i,j,u,c) untuk Personal Experience Learning
 * CAPAR Section 7.2 — Pembelajaran transisi state.
 *
 * N_(i,j,u,c) = jumlah observasi transisi state S_i → S_j
 *               untuk pengguna u dan konteks c (activity).
 *
 * P(S_j | S_i, u, c) = (N_(i,j) + alpha_j) / (Σ_k N_(i,k) + Σ_k alpha_k)
 *
 * Satu document = satu kombinasi unik (user_id, activity).
 */
import mongoose from 'mongoose';

// Semua state yang valid dalam state machine CAPAR (Section 8)
const VALID_STATES = [
  'UNKNOWN',
  'BASELINE_COMPATIBLE',    // Normal
  'DEVIATION_CANDIDATE',    // Caution
  'PERSISTENT_DEVIATION',   // Alert, persistent
  'RECOVERY',               // Score kembali turun
  'RECOVERED',              // Confirmed kembali ke baseline
  'UNRESOLVED',             // Timeout T_max
];

// Transisi yang secara struktural diizinkan (Section 8 — state machine)
export const ALLOWED_TRANSITIONS = {
  UNKNOWN:               ['BASELINE_COMPATIBLE'],
  BASELINE_COMPATIBLE:   ['BASELINE_COMPATIBLE', 'DEVIATION_CANDIDATE'],
  DEVIATION_CANDIDATE:   ['BASELINE_COMPATIBLE', 'PERSISTENT_DEVIATION', 'DEVIATION_CANDIDATE'],
  PERSISTENT_DEVIATION:  ['RECOVERY', 'PERSISTENT_DEVIATION', 'UNRESOLVED'],
  RECOVERY:              ['PERSISTENT_DEVIATION', 'RECOVERED', 'RECOVERY'],
  RECOVERED:             ['BASELINE_COMPATIBLE', 'RECOVERED'],
  UNRESOLVED:            ['BASELINE_COMPATIBLE'],
};

// Schema untuk counts N_(i,j) dari satu state origin
const TransitionCountSchema = new mongoose.Schema({
  to_BASELINE_COMPATIBLE:  { type: Number, default: 0 },
  to_DEVIATION_CANDIDATE:  { type: Number, default: 0 },
  to_PERSISTENT_DEVIATION: { type: Number, default: 0 },
  to_RECOVERY:             { type: Number, default: 0 },
  to_RECOVERED:            { type: Number, default: 0 },
  to_UNRESOLVED:           { type: Number, default: 0 },
  total:                   { type: Number, default: 0 }, // sum untuk normalisasi
}, { _id: false });

const StateTransitionSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  activity: {
    type: String,
    enum: ['Rest', 'Light', 'Moderate', 'Intense', 'Unknown'],
    required: true,
  },

  // N_(i,j,u,c) per origin state
  from_UNKNOWN:              { type: TransitionCountSchema, default: () => ({}) },
  from_BASELINE_COMPATIBLE:  { type: TransitionCountSchema, default: () => ({}) },
  from_DEVIATION_CANDIDATE:  { type: TransitionCountSchema, default: () => ({}) },
  from_PERSISTENT_DEVIATION: { type: TransitionCountSchema, default: () => ({}) },
  from_RECOVERY:             { type: TransitionCountSchema, default: () => ({}) },
  from_RECOVERED:            { type: TransitionCountSchema, default: () => ({}) },

  // Total transisi tercatat
  total_transitions: { type: Number, default: 0 },
  last_updated: { type: Date, default: Date.now },

}, { timestamps: true });

// Unique per user + activity
StateTransitionSchema.index({ user_id: 1, activity: 1 }, { unique: true });

const StateTransition = mongoose.model('StateTransition', StateTransitionSchema);
export { VALID_STATES };
export default StateTransition;
