import mongoose from "mongoose";

const LogSchema = new mongoose.Schema(
  {
    guid: {
      // required: true,
      type: String,
    },
    guid_device: {
      type: String,
    },
    HR: {
      type: Number,
      default: null
    },
    RR: {
      type: Number,
      default: null
    },
    rrRMS: {
      type: Number,
      default: null
    },
    date_created: {
      type: String,
    },
    time_created: {
      type: String,
    },
    date_update: {
      type: String,
    },
    time_update: {
      type: String,
    },
    timestamp: {
      type: Number,
    },
    date: {
      type: String,
    },
    time: {
      type: String,
    },
    hour: {
      type: String,
    },
    month: {
      type: String,
    },
    year: {
      type: String,
    },
    datetime: {
      type: String,
    },
    create_at: {
      type: Date,
      default: Date.now,
    },
    activity_ref : {
      type : mongoose.Types.ObjectId,
      ref : 'aktivitas',
      required : false
    }, 
    activity : String,
    isChecked: { type: Boolean, default: false }  
  },
  {
    versionKey: false,
  }
);

const Raw = mongoose.model("raw", LogSchema); 

export default Raw;