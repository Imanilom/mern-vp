import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import EpisodeAnalysis from '../models/episode_analysis.model.js';
import AnomalyEvent from '../models/anomalyevent.model.js';

async function runBackfill() {
  try {
    await mongoose.connect(process.env.MONGO);
    console.log('Connected to MongoDB.');

    // Find all EpisodeAnalysis records
    const analyses = await EpisodeAnalysis.find({}).lean();
    console.log(`Found ${analyses.length} total EpisodeAnalysis records.`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const ea of analyses) {
      // Check if episode_id is valid ObjectId and not 0
      let hasValidEpisodeId = false;
      
      if (ea.episode_id) {
        const strId = ea.episode_id.toString();
        if (strId !== '0' && strId !== '000000000000000000000000' && mongoose.Types.ObjectId.isValid(strId)) {
          hasValidEpisodeId = true;
        }
      }
      
      let needsEvent = false;
      if (hasValidEpisodeId) {
        // check if it actually exists in AnomalyEvent
        const existingEv = await AnomalyEvent.findById(ea.episode_id);
        if (!existingEv) needsEvent = true;
      } else {
        needsEvent = true;
      }

      if (!needsEvent) {
        skippedCount++;
        continue;
      }

      // Create dummy AnomalyEvent
      const onset = new Date(ea.start_time);
      const end = ea.end_time ? new Date(ea.end_time) : new Date(onset.getTime() + 120000);
      const duration_ms = end.getTime() - onset.getTime();
      const peakScore = ea.anomaly_score || 1.6;
      
      const newEv = await AnomalyEvent.create({
        user_id: ea.user_id,
        device_id: 'BACKFILLED-DEV',
        activity: ea.activity || 'sitting',
        onset_time: onset,
        started_at: onset,
        candidate_at: onset,
        peak_time: end,
        resolution_time: end,
        onset_score: peakScore * 0.8,
        peak_score: peakScore,
        classification: 'Alert',
        status: 'open',
        current_state: 'PERSISTENT_DEVIATION',
        duration_ms: duration_ms > 0 ? duration_ms : 120000,
        features: {
          mean_hr: ea.hr_mean || 80,
          rmssd: ea.rmssd || 25,
          sdnn: ea.sdnn || 35,
          dfa_alpha1: ea.dfa_alpha1 || 1.1
        },
        trajectory: {
          sequence_of_scores: [0.55, 0.70, peakScore * 0.85, peakScore, peakScore * 0.9, 1.2, 0.75],
          persistence: 3,
          delta_hr: 15,
          dfa_alpha1: ea.dfa_alpha1 || 1.1,
          dfa_alpha2: 0.95,
          recovery_time_ms: duration_ms > 0 ? duration_ms : 120000
        },
        window_count: 5,
        total_paused_ms: 0,
        relapse: ea.relapse_detected || false
      });

      // Update EpisodeAnalysis to point to the new AnomalyEvent
      await EpisodeAnalysis.findByIdAndUpdate(ea._id, {
        $set: { episode_id: newEv._id }
      });

      createdCount++;
      if (createdCount % 100 === 0) {
        console.log(`Created ${createdCount} events...`);
      }
    }

    console.log(`\nFinished!`);
    console.log(`Created new AnomalyEvents: ${createdCount}`);
    console.log(`Skipped (already linked): ${skippedCount}`);

  } catch (error) {
    console.error('Error during backfill:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

runBackfill();
