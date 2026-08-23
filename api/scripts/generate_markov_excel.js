import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import Segment from '../models/segment.model.js';
import AnomalyEvent from '../models/anomalyevent.model.js';
import EpisodeAnalysis from '../models/episode_analysis.model.js';
import StateTransition from '../models/state_transition.model.js';
import MarkovModel from '../models/markov.model.js';
import { ALLOWED_TRANSITIONS } from '../models/state_transition.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const USER_ID = '6a6609326bf83196b1d73e97';

function mapToNormState(rr_status) {
  if (!rr_status) return 'UNKNOWN';
  switch (rr_status) {
    case 'NORMAL':
    case 'BASELINE_COMPATIBLE':
      return 'BASELINE_COMPATIBLE';
    case 'DEVIATION_CANDIDATE':
      return 'DEVIATION_CANDIDATE';
    case 'PERSISTENT_DEVIATION':
      return 'PERSISTENT_DEVIATION';
    case 'RECOVERING':
    case 'RECOVERY':
      return 'RECOVERY';
    case 'RECOVERED':
      return 'RECOVERED';
    case 'INSUFFICIENT_BASELINE':
    case 'BASELINE_PAUSED':
    case 'QUALITY_WARNING':
    case 'UNKNOWN':
      return 'UNKNOWN';
    default:
      return 'UNKNOWN';
  }
}

async function main() {
  try {
    const mongoUri = process.env.MONGO || 'mongodb://127.0.0.1:27017/test';
    console.log(`[Script] Connecting to DB: ${mongoUri}`);
    await mongoose.connect(mongoUri);
    const objId = new mongoose.Types.ObjectId(USER_ID);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CAPAR System';
    
    // 1. Sheet Overview
    const wsOverview = workbook.addWorksheet('Overview');
    wsOverview.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 30 }
    ];
    
    const totalSegs = await Segment.countDocuments({ user_id: objId });
    const events = await AnomalyEvent.find({ user_id: objId }).sort({ onset_time: 1 }).lean();
    const episodeAnalyses = await EpisodeAnalysis.find({ user_id: objId }).lean();
    
    wsOverview.addRow({ metric: 'User ID', value: USER_ID });
    wsOverview.addRow({ metric: 'Total Segments', value: totalSegs });
    wsOverview.addRow({ metric: 'Total Episodes', value: events.length });
    wsOverview.addRow({ metric: 'Total Episode Analyses', value: episodeAnalyses.length });

    // 2. Sheet Episode Window
    const wsEpisode = workbook.addWorksheet('Episode Window');
    wsEpisode.columns = [
      { header: 'episode_id', key: 'episode_id', width: 25 },
      { header: 'seq', key: 'seq', width: 10 },
      { header: 'start_time', key: 'start_time', width: 25 },
      { header: 'end_time', key: 'end_time', width: 25 },
      { header: 'raw_state', key: 'raw_state', width: 25 },
      { header: 'quality_gate_pass', key: 'quality_gate_pass', width: 15 },
      { header: 'included (quality_ok)', key: 'included', width: 15 },
      { header: 'norm_state', key: 'norm_state', width: 25 },
      { header: 'next_norm_state', key: 'next_norm_state', width: 25 },
      { header: 'transition_valid', key: 'transition_valid', width: 15 }
    ];

    let allSegments = await Segment.find({ user_id: objId, is_valid: true })
      .sort({ window_start: 1 }).lean();
      
    // Filter segments only inside episodes
    let episodeSegments = [];
    for (const ev of events) {
      const onsetMs = ev.onset_time;
      const resMs = ev.resolved_time ? ev.resolved_time : Date.now();
      
      const evSegs = allSegments.filter(s => {
        const ws = new Date(s.window_start).getTime();
        return ws >= onsetMs && ws <= resMs;
      });
      
      let seq = 1;
      for (let i = 0; i < evSegs.length; i++) {
        const seg = evSegs[i];
        const normState = mapToNormState(seg.rr_status);
        const nextSeg = evSegs[i+1];
        const nextNormState = nextSeg ? mapToNormState(nextSeg.rr_status) : null;
        
        let isValid = false;
        if (nextNormState && ALLOWED_TRANSITIONS[normState]) {
          isValid = ALLOWED_TRANSITIONS[normState].includes(nextNormState);
        }
        
        wsEpisode.addRow({
          episode_id: ev._id.toString(),
          seq: seq++,
          start_time: new Date(seg.window_start).toISOString(),
          end_time: new Date(seg.window_end).toISOString(),
          raw_state: seg.rr_status || 'UNKNOWN',
          quality_gate_pass: seg.signal_quality_detail?.q_signal >= 0.85 ? 'Yes' : 'No',
          included: 'Yes',
          norm_state: normState,
          next_norm_state: nextNormState || '-',
          transition_valid: nextNormState ? (isValid ? 'Yes' : 'No') : '-'
        });
      }
    }

    // 3. Sheet Jumlah Transisi
    const wsCounts = workbook.addWorksheet('Jumlah Transisi');
    const states = ['BASELINE_COMPATIBLE', 'DEVIATION_CANDIDATE', 'PERSISTENT_DEVIATION', 'RECOVERY', 'RECOVERED', 'UNRESOLVED'];
    
    wsCounts.columns = [
      { header: 'From \\ To', key: 'from', width: 25 },
      ...states.map(s => ({ header: s, key: s, width: 15 }))
    ];
    
    // We can pull the actual learned transition counts from StateTransition
    const transitions = await StateTransition.find({ user_id: objId }).lean();
    const aggregateCounts = {};
    states.forEach(s => {
      aggregateCounts[s] = {};
      states.forEach(to => aggregateCounts[s][to] = 0);
    });
    
    for (const t of transitions) {
      if (aggregateCounts[t.from_state]) {
        aggregateCounts[t.from_state]['BASELINE_COMPATIBLE'] += t.counts.to_BASELINE_COMPATIBLE || 0;
        aggregateCounts[t.from_state]['DEVIATION_CANDIDATE'] += t.counts.to_DEVIATION_CANDIDATE || 0;
        aggregateCounts[t.from_state]['PERSISTENT_DEVIATION'] += t.counts.to_PERSISTENT_DEVIATION || 0;
        aggregateCounts[t.from_state]['RECOVERY'] += t.counts.to_RECOVERY || 0;
        aggregateCounts[t.from_state]['RECOVERED'] += t.counts.to_RECOVERED || 0;
        aggregateCounts[t.from_state]['UNRESOLVED'] += t.counts.to_UNRESOLVED || 0;
      }
    }
    
    states.forEach(fromState => {
      const row = { from: fromState };
      states.forEach(toState => {
        row[toState] = aggregateCounts[fromState][toState];
      });
      wsCounts.addRow(row);
    });

    // 4. Sheet Matriks Transisi
    const wsMatrix = workbook.addWorksheet('Matriks Transisi (Markov)');
    wsMatrix.columns = [
      { header: 'Current State', key: 'current', width: 25 },
      ...states.map(s => ({ header: s, key: s, width: 15 }))
    ];
    
    const markov = await MarkovModel.findOne({ user_id: objId }).lean();
    if (markov && markov.matrix) {
      markov.matrix.forEach(rowInfo => {
        const row = { current: rowInfo.current_state };
        rowInfo.transitions.forEach(t => {
          row[t.next_state] = t.probability.toFixed(4); // limit precision for display
        });
        wsMatrix.addRow(row);
      });
    }

    const outPath = path.join(__dirname, `../../markov_analysis_${USER_ID}.xlsx`);
    await workbook.xlsx.writeFile(outPath);
    console.log(`[Script] Excel file successfully written to ${outPath}`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
