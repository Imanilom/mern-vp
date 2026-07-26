import mongoose from 'mongoose';

/**
 * ActivityContext Schema — Collection activity_context
 * Stores contextual features per time window for AI model training & prediction.
 */
const ActivityContextSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  start_time: {
    type: Number,
    required: true,
  },
  end_time: {
    type: Number,
    required: true,
  },
  activity: {
    posture: {
      type: String,
      enum: ['Sitting', 'Standing', 'Lying', 'Walking', 'Running', 'Unknown'],
      default: 'Sitting',
    },
    movement: {
      type: String,
      enum: ['Static', 'Low', 'Moderate', 'High'],
      default: 'Low',
    },
    location: {
      type: String,
      default: 'Home',
    },
    time_of_day: {
      type: String,
      enum: ['Morning', 'Afternoon', 'Evening', 'Night'],
      required: true,
    },
    stress_level: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Low',
    },
  },
}, { timestamps: true });

ActivityContextSchema.index({ user_id: 1, start_time: 1 });

const ActivityContext = mongoose.model('ActivityContext', ActivityContextSchema);
export default ActivityContext;
