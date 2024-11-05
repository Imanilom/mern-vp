import mongoose from "mongoose";

const lab_docSchema = mongoose.Schema({
  name_lab: String,
  location: String,
  user: {
    required: true,
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users'
  },

  Date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamp: true
});

const Labotariums = mongoose.model('labotariums', lab_docSchema);
export default Labotariums;