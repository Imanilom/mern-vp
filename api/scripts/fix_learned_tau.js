import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Baseline from '../models/baseline.model.js';
import { getStableScores, computeTauFromStableScores, persistTauToBaseline } from '../utils/capar.thresholds.js';

dotenv.config();

async function run() {
  const mongoUri = process.env.MONGO || 'mongodb://127.0.0.1:27017/capar-vp';
  console.log(`[Script] Connecting to MongoDB (${mongoUri})...`);
  
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('[Script] Connected to MongoDB.');

    const baselines = await Baseline.find({});
    console.log(`[Script] Total baselines found: ${baselines.length}`);

    let updatedCount = 0;
    for (const b of baselines) {
      const scoresFromSeg = await getStableScores(b.user_id, b.activity);
      const combinedScores = (scoresFromSeg && scoresFromSeg.length > 0)
        ? scoresFromSeg
        : (b.stable_score_history || []);

      let tau = computeTauFromStableScores(combinedScores);

      // Fallback adaptif via std_hr jika score belum ada/configured
      if (tau.source === 'configured' && b.stats) {
        const stdHr = b.stats?.mean_hr?.std || b.stats?.std_hr?.mean || b.stats?.hr_mean?.std || 2.5;
        if (typeof stdHr === 'number' && stdHr > 0) {
          tau.tau_in = Number((1.5 + stdHr * 0.08).toFixed(2));
          tau.tau_out = Number((1.0 + stdHr * 0.04).toFixed(2));
          tau.tau_normal = 0.75;
          tau.source = 'provisional';
        }
      }

      await persistTauToBaseline(b._id, tau);
      updatedCount++;
      console.log(`[Script] Updated baseline ${b._id} (${b.activity} - ${b.time_period}): tau_in=${tau.tau_in}, tau_out=${tau.tau_out}, tau_normal=${tau.tau_normal}, source=${tau.source}`);
    }

    console.log(`[Script] Selesai! Berhasil memperbarui ${updatedCount} baseline.`);
  } catch (err) {
    console.error('[Script] Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
