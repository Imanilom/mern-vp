import mongoose from 'mongoose';

const ReportSchema = mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: false, // Optional for global reports
  },
  report_type: {
    type: String,
    required: true,
  },
  summary: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  filters: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  }
}, {
  timestamps: true
});

const Report = mongoose.model('Report', ReportSchema);
export default Report;
