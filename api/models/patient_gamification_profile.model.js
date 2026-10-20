import mongoose from 'mongoose';

const PatientGamificationProfileSchema = new mongoose.Schema(
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
    nickname: { type: String, trim: true, minlength: 2, maxlength: 24, required: true },
    leaderboard_opt_in: { type: Boolean, default: false },
    location_opt_in: { type: Boolean, default: false },
    recording_history_backfilled_at: { type: Date, default: null },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: undefined,
      },
      coordinates: {
        type: [Number],
        default: undefined,
        validate: {
          validator: (coordinates) =>
            coordinates === undefined
            || (coordinates.length === 2
              && coordinates.every(Number.isFinite)
              && coordinates[0] >= -180
              && coordinates[0] <= 180
              && coordinates[1] >= -90
              && coordinates[1] <= 90),
          message: 'Location coordinates are invalid.',
        },
      },
    },
  },
  { timestamps: true, versionKey: false }
);

PatientGamificationProfileSchema.index(
  { account_id: 1, account_type: 1 },
  { unique: true }
);
PatientGamificationProfileSchema.index({ location: '2dsphere' });

export default mongoose.model(
  'PatientGamificationProfile',
  PatientGamificationProfileSchema
);
