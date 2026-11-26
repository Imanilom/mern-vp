import mongoose from 'mongoose';

const CaparDynamicProfileSchema = new mongoose.Schema(
  {
    account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    patient_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    scope: {
      type: String,
      enum: ['person', 'day', 'activity', 'window'],
      required: true,
    },
    analysis_date: { type: String, default: '' },
    activity: { type: String, default: 'all' },
    episode_key: { type: String, default: '' },
    window_id: { type: String, default: '' },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    generated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    algorithm_version: { type: String, default: 'capar-dynamic-profile-v1' },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'capar_dynamic_profiles',
  },
);

CaparDynamicProfileSchema.index(
  {
    account_id: 1,
    scope: 1,
    analysis_date: 1,
    activity: 1,
    episode_key: 1,
    window_id: 1,
  },
  { unique: true },
);

export default mongoose.model('CaparDynamicProfile', CaparDynamicProfileSchema);
