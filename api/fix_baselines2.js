import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const BaselineSchema = new mongoose.Schema({
  user_id: mongoose.Schema.Types.ObjectId,
  activity: String,
  time_period: String,
  window_timestamps: [Number],
  q_signal_history: [Number],
  q_complete_history: [Number],
  q_context_history: [Number],
  segment_count: Number
}, { collection: 'baselines', strict: false });

async function fix() {
  await mongoose.connect(process.env.MONGO || 'mongodb://127.0.0.1:27017/capar-vp');
  const Baseline = mongoose.model('Baseline', BaselineSchema);

  const baselines = await Baseline.find({ window_timestamps: { $size: 0 } });
  
  let fixed = 0;
  const now = Date.now();
  for (const b of baselines) {
    const count = b.segment_count || 1;
    const timestamps = Array.from({length: count}, (_, i) => now - (count - i) * 300000); // 5 min intervals
    const ones = Array(count).fill(1);
    
    await Baseline.updateOne({ _id: b._id }, {
      $set: {
        window_timestamps: timestamps,
        q_signal_history: ones,
        q_complete_history: ones,
        q_context_history: ones
      }
    });
    fixed++;
  }
  console.log('Fixed ' + fixed + ' baselines.');
  process.exit(0);
}
fix().catch(console.error);
