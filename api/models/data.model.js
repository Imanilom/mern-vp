import mongoose from 'mongoose';

const logSchema = new mongoose.Schema({
  timestamp: {
    type: Number,
      },
  date_created: {
    type: String,
      },
  time_created: {
    type: String,
      },
  hr: {
    type: Number,
      },
  rr: {
    type: Number,
      },
  rrms: {
    type: Number,
      },
  acc_x: {
    type: Number,
      },
  acc_y: {
    type: Number,
      },
  acc_z: {
    type: Number,
      },
  ecg: {
    type: Number,
      },
  activity: {
    type: String,
    enum: ["Rest", "Light", "Moderate", "Intense"] // Enum untuk aktivitas
  },
  isChecked: {
    type: Boolean,
    default: false
  },
  device_id: {
    type: String,
    default:"E4F82A29",
  }
}, { timestamps: true }); // timestamps akan otomatis menambahkan createdAt dan updatedAt

const PolarData = mongoose.model("PolarData", logSchema);

export default PolarData;
