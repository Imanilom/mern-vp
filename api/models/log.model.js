// import mongoose from "mongoose";

// const LogSchema = new mongoose.Schema(
//   {
//     guid: {
//       // required: true,
//       type: String,
//     },
//     guid_device: {
//       type: String,
//     },
//     HR: {
//       type: Number,
//       default: null
//     },
//     RR: {
//       type: Number,
//       default: null
//     },
//     rrRMS: {
//       type: Number,
//       default: null
//     },
//     date_created: {
//       type: String,
//     },
//     time_created: {
//       type: String,
//     },
//     date_update: {
//       type: String,
//     },
//     time_update: {
//       type: String,
//     },
//     timestamp: {
//       type: Number,
//     },
//     date: {
//       type: String,
//     },
//     time: {
//       type: String,
//     },
//     hour: {
//       type: String,
//     },
//     month: {
//       type: String,
//     },
//     year: {
//       type: String,
//     },
//     datetime: {
//       type: String,
//     },
//     create_at: {
//       type: Date,
//       default: Date.now,
//     },
//     activity_ref : {
//       type : mongoose.Types.ObjectId,
//       ref : 'aktivitas',
//       required : false
//     }, 
//     activity : String,
//     isChecked: { type: Boolean, default: false }  
//   },
//   {
//     versionKey: false,
//   }
// );

// const Log = mongoose.model("log", LogSchema); 

// export default Log;


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
