import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Segment from '../models/segment.model.js';
import Baseline from '../models/baseline.model.js';
import AnomalyEvent from '../models/anomalyevent.model.js';
import EpisodeAnalysis from '../models/episode_analysis.model.js';
import StateTransition from '../models/state_transition.model.js';
import MarkovModel from '../models/markov.model.js';
import { runRRAnalysisPipeline } from '../controllers/analysis.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const USER_ID = '6a6609326bf83196b1d73e97';

async function main() {
  try {
    const mongoUri = process.env.MONGO || 'mongodb://127.0.0.1:27017/healthdevice';
    console.log(`[Script] Connecting to DB: ${mongoUri}`);
    await mongoose.connect(mongoUri);
    console.log('[Script] Connected to MongoDB.');

    console.log(`\n[Script] 1. Mereset data turunan untuk user: ${USER_ID}`);
    const objId = new mongoose.Types.ObjectId(USER_ID);
    
    await AnomalyEvent.deleteMany({ user_id: objId });
    await EpisodeAnalysis.deleteMany({ user_id: objId });
    await StateTransition.deleteMany({ user_id: objId });
    await Baseline.deleteMany({ user_id: objId });
    await MarkovModel.deleteMany({ user_id: objId });
    
    console.log(`[Script] Berhasil menghapus AnomalyEvent, EpisodeAnalysis, StateTransition, Baseline.`);

    console.log(`\n[Script] 2. Menghitung total segment untuk user ini...`);
    const totalSeg = await Segment.countDocuments({ user_id: objId });
    console.log(`[Script] Total segment: ${totalSeg}`);

    console.log(`\n[Script] 3. Set ulang semua segment menjadi analyzed: false dan window_type: 1min`);
    const updateResult = await Segment.updateMany(
      { user_id: objId },
      { $set: { analyzed: false, window_type: '1min' } }
    );
    console.log(`[Script] Berhasil mereset ${updateResult.modifiedCount} segment.`);

    console.log(`\n[Script] 4. Menjalankan pipeline CAPAR (runRRAnalysisPipeline)...`);
    // Memaksa jalankan pipeline
    const result = await runRRAnalysisPipeline('CRON');
    console.log('[Script] Pipeline selesai:', result);

    console.log(`\n[Script] 5. Generate CSV (Excel) Z-Score...`);
    const segments = await Segment.find({ user_id: objId }).sort({ window_start: 1 }).lean();
    
    if (segments.length === 0) {
      console.log('[Script] Tidak ada data segment untuk user ini.');
    } else {
      const csvHeader = [
        'Waktu', 'Aktivitas', 'Valid', 'Q_Signal', 'RR_Status', 'Anomaly_Score', 
        'HR_Mean', 'Z_HR', 
        'RMSSD', 'Z_RMSSD', 
        'SDNN', 'Z_SDNN'
      ].join(',') + '\n';
      
      let csvContent = csvHeader;
      
      for (const s of segments) {
        const t = new Date(s.window_start).toISOString();
        const act = s.activity_label || 'Unknown';
        const valid = s.is_valid ? 'Yes' : 'No';
        const qSig = s.quality_detail?.q_signal ?? '';
        const rrStat = s.rr_status || 'UNKNOWN';
        const score = s.anomaly_score ?? '';
        
        const hr = s.features?.mean_hr ?? '';
        const zhr = s.z_scores?.z_hr ?? '';
        const rmssd = s.features?.rmssd ?? '';
        const zrmssd = s.z_scores?.z_rmssd ?? '';
        const sdnn = s.features?.sdnn ?? '';
        const zsdnn = s.z_scores?.z_sdnn ?? '';

        const row = [t, act, valid, qSig, rrStat, score, hr, zhr, rmssd, zrmssd, sdnn, zsdnn].join(',');
        csvContent += row + '\n';
      }
      
      const outPath = path.join(__dirname, `../../zscore_${USER_ID}.csv`);
      fs.writeFileSync(outPath, csvContent);
      console.log(`[Script] File CSV berhasil dibuat di: ${outPath}`);
    }

    console.log('\n[Script] Selesai!');
    process.exit(0);
  } catch (err) {
    console.error('[Script] Error:', err);
    process.exit(1);
  }
}

main();
