import mongoose from 'mongoose';
import dotenv from 'dotenv';
import AnomalyEvent from '../models/anomalyevent.model.js';
import Segment from '../models/segment.model.js';
import Baseline from '../models/baseline.model.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  try {
    await mongoose.connect(process.env.MONGO);
    console.log('Connected to DB');

    const events = await AnomalyEvent.find({ peak_hr: { $exists: false } }).lean();
    console.log(`Found ${events.length} events to backfill.`);

    let count = 0;
    for (const ev of events) {
      let peakHr = null;
      let baselineHr = null;

      if (ev.segment_ids && ev.segment_ids.length > 0) {
        // Find peak segment
        const peakSeg = await Segment.findOne({ _id: { $in: ev.segment_ids }, window_start: new Date(ev.peak_time) }).lean();
        if (peakSeg) {
          peakHr = peakSeg.features?.mean_hr;
        } else {
          // fallback to first segment
          const firstSeg = await Segment.findById(ev.segment_ids[0]).lean();
          if (firstSeg) peakHr = firstSeg.features?.mean_hr;
        }
      }

      // Find baseline
      const timePeriodHour = new Date(ev.onset_time).getUTCHours() + 7;
      const h = timePeriodHour % 24;
      let timePeriod = 'night';
      if (h >= 6 && h < 12) timePeriod = 'morning';
      else if (h >= 12 && h < 18) timePeriod = 'afternoon';
      else if (h >= 18 && h < 24) timePeriod = 'evening';

      const baseline = await Baseline.findOne({ user_id: ev.user_id, activity: ev.activity, time_period: timePeriod }).lean();
      if (baseline) {
        baselineHr = baseline.stats?.mean_hr?.mean;
      }

      const update = {};
      if (peakHr !== null) update.peak_hr = peakHr;
      if (baselineHr !== null) update.baseline_hr = baselineHr;

      if (Object.keys(update).length > 0) {
        await AnomalyEvent.updateOne({ _id: ev._id }, { $set: update });
        count++;
      }
    }

    console.log(`Successfully backfilled ${count} events.`);
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
