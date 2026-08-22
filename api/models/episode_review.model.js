import mongoose from 'mongoose';

const EpisodeReviewSchema = new mongoose.Schema({
  episode_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AnomalyEvent',
    required: true,
    index: true,
  },
  reviewer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  decision: {
    type: String,
    enum: ['VALID', 'INVALID', 'UNCERTAIN'],
    required: true,
  },
  note: {
    type: String,
    default: '',
  }
}, { timestamps: true });

const EpisodeReview = mongoose.model('EpisodeReview', EpisodeReviewSchema);
export default EpisodeReview;
