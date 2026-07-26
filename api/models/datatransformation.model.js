import mongoose from 'mongoose';

/**
 * DataTransformation Schema — Collection data_transformation (DT Layer)
 * Transformed Polar sensor stream (RR, HR, Accelerometer, Temperature, Activity)
 */
const DataTransformationSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  rr_interval: {
    type: Number,
    required: true,
  },
  hr: {
    type: Number,
    required: true,
  },
  accelerometer: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    z: { type: Number, default: 0 },
    magnitude: { type: Number, default: 0 },
  },
  temperature: {
    type: Number,
    default: 36.5,
  },
  activity: {
    type: String,
    default: 'Rest',
  },
}, { timestamps: true });

DataTransformationSchema.index({ user_id: 1, timestamp: 1 });

const DataTransformation = mongoose.model('DataTransformation', DataTransformationSchema);
export default DataTransformation;
