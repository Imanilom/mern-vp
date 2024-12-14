import mongoose from "mongoose";

const logSchema = new mongoose.Schema({
  HR: {
    type: Number,
    required: true,
  },
  RR: {
    type: Number,
    required: true,
  },
  rrRMS: {
    type: Number,
    required: true,
  },
  date_created: {
    type: String,
    required: true,
  },
  time_created: {
    type: String,
    required: true,
  },
  aktivitas: {
    type: String,
    required: true,
  },
  isChecked: {
    type: Boolean,
    default: false,
  },
});

const Log = mongoose.model("log", logSchema); 

export default Log;
