import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ExcelJS from 'exceljs';
import path from 'path';

dotenv.config(); // load from cwd which is api/

const mongoUri = process.env.MONGO || 'mongodb://127.0.0.1:27017/capar-vp';

async function exportFullEpisode() {
  console.log(`[Export] Connecting to MongoDB (${mongoUri})...`);
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('[Export] Connected to MongoDB.');

    const userIdStr = '6a82ccd8483cdfd43096a96f';
    const userId = new mongoose.Types.ObjectId(userIdStr);

    const db = mongoose.connection.db;
    
    let startTime = null;
    let endTime = null;

    // 1. Try to find an EpisodeAnalysis
    console.log('[Export] Searching for EpisodeAnalysis...');
    const episodes = await db.collection('episodeanalyses').find({ user_id: userId }).sort({ start_time: -1 }).limit(1).toArray();
    
    if (episodes.length > 0) {
      startTime = new Date(episodes[0].start_time).getTime();
      endTime = new Date(episodes[0].end_time).getTime();
      console.log(`[Export] Found EpisodeAnalysis. Start: ${new Date(startTime)}, End: ${new Date(endTime)}`);
    } else {
      console.log('[Export] No EpisodeAnalysis found. Searching for AnomalyEvent...');
      // 2. Try to find AnomalyEvent
      const anomalyEvents = await db.collection('anomalievents').find({ user_id: userId }).sort({ onset_time: -1 }).limit(1).toArray();
      if (anomalyEvents.length > 0) {
        const event = anomalyEvents[0];
        startTime = event.onset_time;
        endTime = event.resolved_time || event.recovered_at || event.unresolved_at || Date.now();
        console.log(`[Export] Found AnomalyEvent. Start: ${new Date(startTime)}, End: ${new Date(endTime)}`);
      } else {
        console.log('[Export] No AnomalyEvent found. Searching for Segments...');
        // 3. Just take the last 30 mins of segments
        const lastSegment = await db.collection('segments').find({ user_id: userId }).sort({ window_start: -1 }).limit(1).toArray();
        if (lastSegment.length > 0) {
          endTime = lastSegment[0].window_start;
          startTime = endTime - (30 * 60 * 1000);
          console.log(`[Export] Found Segments. Using last 30 minutes block. Start: ${new Date(startTime)}, End: ${new Date(endTime)}`);
        } else {
          console.log('[Export] No data found for this user.');
          process.exit(0);
        }
      }
    }

    if (endTime - startTime < 300000) {
        endTime = startTime + (30 * 60 * 1000);
    }

    console.log('[Export] Fetching data between ranges...');
    const segments = await db.collection('segments').find({
      user_id: userId,
      window_start: { $gte: startTime, $lte: endTime }
    }).sort({ window_start: 1 }).toArray();
    
    console.log(`[Export] Found ${segments.length} segments.`);

    const rawData = await db.collection('polardatas').find({
      user_id: userId,
      timestamp: { $gte: startTime, $lte: endTime }
    }).sort({ timestamp: 1 }).toArray();

    console.log(`[Export] Found ${rawData.length} raw data points.`);

    const episodeAnalysis = await db.collection('episodeanalyses').find({
        user_id: userId,
        start_time: { $gte: new Date(startTime - 60000), $lte: new Date(endTime + 60000) }
    }).toArray();
    
    console.log(`[Export] Found ${episodeAnalysis.length} episode analyses.`);
    
    const markovModels = await db.collection('markovmodels').find({ user_id: userId }).toArray();
    const stateTransitions = await db.collection('statetransitions').find({ user_id: userId }).toArray();

    console.log('[Export] Creating Excel workbook...');
    const workbook = new ExcelJS.Workbook();
    
    const sheetRaw = workbook.addWorksheet('Raw Data');
    sheetRaw.columns = [
      { header: 'Time', key: 'timestamp', width: 25 },
      { header: 'HR', key: 'hr', width: 10 },
      { header: 'RR', key: 'rr', width: 10 },
      { header: 'Acc X', key: 'acc_x', width: 10 },
      { header: 'Acc Y', key: 'acc_y', width: 10 },
      { header: 'Acc Z', key: 'acc_z', width: 10 },
      { header: 'Step Count', key: 'step_count', width: 12 },
      { header: 'Activity', key: 'activity', width: 15 },
    ];
    rawData.forEach(d => {
      sheetRaw.addRow({
        timestamp: new Date(d.timestamp).toISOString(),
        hr: d.hr,
        rr: d.rr,
        acc_x: d.acc_x,
        acc_y: d.acc_y,
        acc_z: d.acc_z,
        step_count: d.step_count,
        activity: d.activity
      });
    });

    const sheetSeg = workbook.addWorksheet('Segments (Features & Scores)');
    sheetSeg.columns = [
      { header: 'Window Start', key: 'window_start', width: 25 },
      { header: 'Type', key: 'window_type', width: 10 },
      { header: 'Activity', key: 'activity_label', width: 15 },
      { header: 'Mean HR', key: 'mean_hr', width: 12 },
      { header: 'Std HR', key: 'std_hr', width: 12 },
      { header: 'Mean RR', key: 'mean_rr', width: 12 },
      { header: 'SDNN', key: 'sdnn', width: 12 },
      { header: 'RMSSD', key: 'rmssd', width: 12 },
      { header: 'Motion', key: 'motion', width: 12 },
      { header: 'DFA a1', key: 'dfa_a1', width: 12 },
      { header: 'Z HR', key: 'z_hr', width: 10 },
      { header: 'Z RR', key: 'z_rr', width: 10 },
      { header: 'Z SDNN', key: 'z_sdnn', width: 10 },
      { header: 'Z RMSSD', key: 'z_rmssd', width: 10 },
      { header: 'Z Motion', key: 'z_motion', width: 10 },
      { header: 'Anomaly Score', key: 'anomaly_score', width: 15 },
      { header: 'Classification', key: 'classification', width: 15 },
      { header: 'RR Status (State Transition)', key: 'rr_status', width: 25 },
    ];
    
    segments.forEach(s => {
      const f = s.features || {};
      const z = s.z_scores || {};
      sheetSeg.addRow({
        window_start: new Date(s.window_start).toISOString(),
        window_type: s.window_type,
        activity_label: s.activity_label,
        mean_hr: f.mean_hr,
        std_hr: f.std_hr,
        mean_rr: f.mean_rr,
        sdnn: f.sdnn,
        rmssd: f.rmssd,
        motion: f.motion_intensity,
        dfa_a1: f.dfa_alpha1,
        z_hr: z.z_hr,
        z_rr: z.z_rr,
        z_sdnn: z.z_sdnn,
        z_rmssd: z.z_rmssd,
        z_motion: z.z_motion,
        anomaly_score: s.anomaly_score,
        classification: s.classification,
        rr_status: s.rr_status
      });
    });

    const sheetEpi = workbook.addWorksheet('Episode & Thresholds');
    sheetEpi.columns = [
      { header: 'Start Time', key: 'start_time', width: 25 },
      { header: 'End Time', key: 'end_time', width: 25 },
      { header: 'Activity', key: 'activity', width: 15 },
      { header: 'Tau In', key: 'tau_in', width: 10 },
      { header: 'Tau Out', key: 'tau_out', width: 10 },
      { header: 'Tau Normal', key: 'tau_normal', width: 10 },
      { header: 'Anomaly Score', key: 'anomaly_score', width: 15 },
      { header: 'Physiological State', key: 'physiological_state', width: 20 },
      { header: 'Evidence State', key: 'evidence_state', width: 20 },
      { header: 'Pred E6 (Markov)', key: 'predicted_state_E6', width: 20 },
    ];
    
    episodeAnalysis.forEach(e => {
        sheetEpi.addRow({
            start_time: new Date(e.start_time).toISOString(),
            end_time: new Date(e.end_time).toISOString(),
            activity: e.activity,
            tau_in: e.tau_in,
            tau_out: e.tau_out,
            tau_normal: e.tau_normal,
            anomaly_score: e.anomaly_score,
            physiological_state: e.physiological_state,
            evidence_state: e.evidence_state,
            predicted_state_E6: e.predicted_state_E6
        });
    });
    
    const sheetMarkov = workbook.addWorksheet('Markov Model Info');
    sheetMarkov.columns = [
      { header: 'Status', key: 'status', width: 20 },
      { header: 'Matrix Row State', key: 'state', width: 25 },
      { header: 'Transitions', key: 'transitions', width: 50 },
    ];
    markovModels.forEach(m => {
        const matrix = m.matrix || [];
        matrix.forEach(row => {
            sheetMarkov.addRow({
                status: m.status,
                state: row.current_state,
                transitions: JSON.stringify(row.transitions.map(t => `${t.next_state}:${t.probability !== null ? t.probability.toFixed(2) : 'null'}`))
            });
        });
    });

    const outputPath = path.resolve(process.cwd(), `episode_user_${userIdStr}.xlsx`);
    await workbook.xlsx.writeFile(outputPath);
    console.log(`[Export] Success! Data exported to: ${outputPath}`);

  } catch (err) {
    console.error('[Export] Error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

exportFullEpisode();
