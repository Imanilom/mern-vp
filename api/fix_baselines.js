import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const SegmentSchema = new mongoose.Schema({
  user_id: mongoose.Schema.Types.ObjectId,
  activity_label: String,
  window_start: Number,
}, { collection: 'segments', strict: false });

const BaselineSchema = new mongoose.Schema({
  user_id: mongoose.Schema.Types.ObjectId,
  activity: String,
  time_period: String,
  window_timestamps: [Number],
  q_signal_history: [Number],
  q_complete_history: [Number],
  q_context_history: [Number],
}, { collection: 'baselines', strict: false });

async function fix() {
  await mongoose.connect(process.env.MONGO || 'mongodb://127.0.0.1:27017/capar-vp');
  const Segment = mongoose.model('Segment', SegmentSchema);
  const Baseline = mongoose.model('Baseline', BaselineSchema);

  const baselines = await Baseline.find({ window_timestamps: { $size: 0 } });
  console.log('Found ' + baselines.length + ' baselines with empty timestamps.');
  
  let fixed = 0;
  for (const b of baselines) {
    const act = b.activity;
    // Map time_period to hours
    let startHr = 0, endHr = 24;
    if (b.time_period === 'morning') { startHr = 5; endHr = 11; }
    else if (b.time_period === 'afternoon') { startHr = 11; endHr = 17; }
    else if (b.time_period === 'evening') { startHr = 17; endHr = 22; }
    else if (b.time_period === 'night') { startHr = 22; endHr = 29; } // approx

    const segments = await Segment.find({ user_id: b.user_id, activity_label: act }).sort({ window_start: 1 }).lean();
    
    // Filter by time period
    const matched = segments.filter(s => {
      const d = new Date(s.window_start);
      let h = d.getHours();
      if (b.time_period === 'night' && h < 5) h += 24;
      return h >= startHr && h < endHr;
    });

    if (matched.length > 0) {
      const timestamps = matched.map(s => s.window_start);
      const ones = Array(timestamps.length).fill(1);
      await Baseline.updateOne({ _id: b._id }, {
        $set: {
          window_timestamps: timestamps,
          q_signal_history: ones,
          q_complete_history: ones,
          q_context_history: ones,
          'stats.segment_count': timestamps.length,
          segment_count: timestamps.length
        }
      });
      fixed++;
    }
  }
  console.log('Fixed ' + fixed + ' baselines.');
  process.exit(0);
}
fix().catch(console.error);
