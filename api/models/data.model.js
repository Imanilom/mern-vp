import mongoose from "mongoose";

const polarDataSchema = new mongoose.Schema({
  timestamp: { type: Date, required: true },
  date_created: {
    type: String,
    required: true,
  },
  time_created: {
    type: String,
    required: true,
  },
  hr: { type: Number, required: true },
  rr: { type: Number, required: true },
  rrms: { type: Number, required: true },
  acc_x: { type: Number, required: true },
  acc_y: { type: Number, required: true },
  acc_z: { type: Number, required: true },
  ecg: { type: Number, required: true },
  device_id: { type: String, required: true },
  isChecked: {
    type: Boolean,
    default: false,
  },
  created_at: { type: Date, default: Date.now }
});

const PolarData = mongoose.model('PolarData', polarDataSchema);


export default PolarData;