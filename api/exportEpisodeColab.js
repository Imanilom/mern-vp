import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load models as reference
import AnomalyEvent from './models/anomalyevent.model.js';
import EpisodeAnalysis from './models/episode_analysis.model.js';
import Segment from './models/segment.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/mern-vp";

async function exportForColab(episodeId) {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    const ep = await AnomalyEvent.findById(episodeId).lean();
    if (!ep) {
      throw new Error(`Episode ${episodeId} not found`);
    }

    const analysis = await EpisodeAnalysis.findOne({ episode_id: ep._id }).lean();
    
    // Fetch segments matching episodes.controller.js logic
    let segments = [];
    if (ep.segment_ids && ep.segment_ids.length > 0) {
      segments = await Segment.find({ _id: { $in: ep.segment_ids } }).sort({ window_start: 1 }).lean();
    } else {
      const endTs = ep.resolved_time || Date.now();
      segments = await Segment.find({
        user_id: ep.user_id,
        window_start: { $gte: ep.onset_time, $lte: endTs }
      }).sort({ window_start: 1 }).limit(2880).lean();
    }

    console.log(`Found ${segments.length} segments.`);

    // Map ke format bersih
    // Map ke format bersih lengkap dengan fitur multimodal
    const points = segments.map(s => {
      let tsRaw = s.createdAt || s.window_start || Date.now();
      if (tsRaw && typeof tsRaw === 'object' && tsRaw.$date) tsRaw = tsRaw.$date;
      if (typeof tsRaw === 'number' && tsRaw < 20000000000) tsRaw *= 1000;
      if (typeof tsRaw === 'string' && tsRaw.endsWith('Z')) tsRaw = tsRaw.replace('Z', '');
      
      const dt = new Date(tsRaw);
      
      return {
        timestamp: dt.toISOString(),
        score: typeof s.anomaly_score === 'number' ? s.anomaly_score : 0,
        state: s.rr_status || s.classification || 'BASELINE_COMPATIBLE',
        hr: s.features?.mean_hr || null,
        hrv: {
           sdnn: s.features?.sdnn || null,
           rmssd: s.features?.rmssd || null,
           dfa: s.features?.dfa_alpha1 || null
        },
        z_scores: {
           z_hr: s.z_scores?.z_hr || null,
           z_rr: s.z_scores?.z_rr || null
        },
        signal_quality: s.signal_quality || 'Valid',
        q_signal: s.q_signal || 1.0
      };
    });

    const exportData = {
      episode_id: episodeId,
      tau_in: analysis?.tau_in || 1.86,
      tau_out: analysis?.tau_out || 1.20,
      onset_time: new Date(ep.onset_time).toISOString(),
      resolved_time: ep.resolved_time ? new Date(ep.resolved_time).toISOString() : null,
      analysis_results: {
         latent_severity: analysis?.latent_severity || 0,
         quality_score: analysis?.quality_score || 0,
         evaluations: analysis?.evaluations || {
            E1_Statistical: { result: 'N/A', score: 0 },
            E2_Personalized: { result: 'N/A', score: 0 },
            E6_FullCAPAR: { result: 'N/A', score: 0 }
         },
         z_scores_at_peak: analysis?.z_scores_at_peak || {}
      },
      trajectory: points
    };

    const outPath = path.join(__dirname, 'colab_export.json');
    fs.writeFileSync(outPath, JSON.stringify(exportData, null, 2));
    console.log(`\nBerhasil mengekstrak data ke ${outPath}!`);
    console.log(`Silakan unggah (upload) file colab_export.json ini ke Google Colab.`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
}

// Eksekusi (ganti ID dengan episode yang mau diexport)
const targetId = process.argv[2] || "6a8f5ce2fbb92650f6c53fac";
exportForColab(targetId);
