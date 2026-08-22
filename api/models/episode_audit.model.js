import mongoose from 'mongoose';

const EpisodeAuditSchema = new mongoose.Schema({
  episode_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AnomalyEvent',
    required: true,
    index: true,
  },
  action: {
    type: String,
    required: true,
  },
  actor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null, // null means system
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  algorithm_version: {
    type: String,
    default: 'capar-engine-2.3.1',
  },
  rule_version: {
    type: String,
    default: '1.0.0',
  }
}, { timestamps: true });

const EpisodeAudit = mongoose.model('EpisodeAudit', EpisodeAuditSchema);
export default EpisodeAudit;
