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
const TEMPLATE_PATH = path.join(__dirname, '../../peserta4_markov_model (1).xlsx');
const OUTPUT_PATH = path.join(__dirname, `../../peserta_${USER_ID}_markov_model.xlsx`);

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
      return 'RECOVERY_START';
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
    console.log(`[Script] Reading template: ${TEMPLATE_PATH}`);
    await workbook.xlsx.readFile(TEMPLATE_PATH);
    
    // 1. Overview
    const wsOverview = workbook.getWorksheet('Overview');
    if (wsOverview) {
      wsOverview.spliceRows(2, 100);
      const totalSegs = await Segment.countDocuments({ user_id: objId });
      const events = await AnomalyEvent.find({ user_id: objId }).sort({ onset_time: 1 }).lean();
      const episodeAnalyses = await EpisodeAnalysis.find({ user_id: objId }).lean();
      wsOverview.addRow(['User ID', USER_ID]);
      wsOverview.addRow(['Total Segments', totalSegs]);
      wsOverview.addRow(['Total Episodes', events.length]);
      wsOverview.addRow(['Total Episode Analyses', episodeAnalyses.length]);
    }

    // 2. Episode Windows
    const wsEpisode = workbook.getWorksheet('Episode Windows');
    if (wsEpisode) {
      wsEpisode.spliceRows(2, 10000); // Clear data
      let allSegments = await Segment.find({ user_id: objId, is_valid: true }).sort({ window_start: 1 }).lean();
      const events = await AnomalyEvent.find({ user_id: objId }).sort({ onset_time: 1 }).lean();
      
      let epIdx = 0;
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
          let allowedTarget = normState === 'RECOVERY_START' ? 'RECOVERY' : normState;
          let nextTarget = nextNormState === 'RECOVERY_START' ? 'RECOVERY' : nextNormState;
          
          if (nextTarget && ALLOWED_TRANSITIONS[allowedTarget]) {
            isValid = ALLOWED_TRANSITIONS[allowedTarget].includes(nextTarget);
          }
          
          wsEpisode.addRow([
            epIdx,
            seq++,
            new Date(seg.window_start).toISOString(),
            new Date(seg.window_end).toISOString(),
            seg.rr_status || 'UNKNOWN',
            seg.signal_quality_detail?.q_signal >= 0.85 ? 1 : 0,
            1,
            normState,
            nextNormState || '-',
            nextNormState ? (isValid ? 1 : 0) : '-'
          ]);
        }
        epIdx++;
      }
    }

    // 3. Transition Counts
    const wsCounts = workbook.getWorksheet('Transition Counts');
    const states = ['BASELINE_COMPATIBLE', 'DEVIATION_CANDIDATE', 'PERSISTENT_DEVIATION', 'RECOVERY_START', 'RECOVERED'];
    
    if (wsCounts) {
      wsCounts.spliceRows(4, 100);
      const transitions = await StateTransition.find({ user_id: objId }).lean();
      const aggregateCounts = {};
      states.forEach(s => { aggregateCounts[s] = {}; states.forEach(to => aggregateCounts[s][to] = 0); });
      
      for (const t of transitions) {
        const from = t.from_state === 'RECOVERY' ? 'RECOVERY_START' : t.from_state;
        if (aggregateCounts[from]) {
          aggregateCounts[from]['BASELINE_COMPATIBLE'] += t.counts.to_BASELINE_COMPATIBLE || 0;
          aggregateCounts[from]['DEVIATION_CANDIDATE'] += t.counts.to_DEVIATION_CANDIDATE || 0;
          aggregateCounts[from]['PERSISTENT_DEVIATION'] += t.counts.to_PERSISTENT_DEVIATION || 0;
          aggregateCounts[from]['RECOVERY_START'] += t.counts.to_RECOVERY || 0;
          aggregateCounts[from]['RECOVERED'] += t.counts.to_RECOVERED || 0;
        }
      }
      
      states.forEach(fromState => {
        const row = [fromState];
        states.forEach(toState => {
          row.push(aggregateCounts[fromState][toState]);
        });
        wsCounts.addRow(row);
      });
    }

    // 4. Transition Matrix
    const wsMatrix = workbook.getWorksheet('Transition Matrix');
    if (wsMatrix) {
      wsMatrix.spliceRows(5, 100);
      const markov = await MarkovModel.findOne({ user_id: objId }).lean();
      if (markov && markov.matrix) {
        markov.matrix.forEach(rowInfo => {
          const from = rowInfo.current_state === 'RECOVERY' ? 'RECOVERY_START' : rowInfo.current_state;
          const row = [from];
          states.forEach(target => {
            const tr = rowInfo.transitions.find(t => {
               const tgt = t.next_state === 'RECOVERY' ? 'RECOVERY_START' : t.next_state;
               return tgt === target;
            });
            row.push(tr && tr.allowed ? (tr.probability || 0) : '—');
          });
          
          // Blank columns padding
          row.push('', '', from);
          
          states.forEach(target => {
             const tr = rowInfo.transitions.find(t => {
               const tgt = t.next_state === 'RECOVERY' ? 'RECOVERY_START' : t.next_state;
               return tgt === target;
            });
            row.push(tr && tr.allowed ? (tr.probability || 0) : 0);
          });
          wsMatrix.addRow(row);
        });
      }
    }
    
    // We will leave Predictions as is (or wipe it if we want)
    const wsPred = workbook.getWorksheet('Predictions');
    if (wsPred) wsPred.spliceRows(3, 1000);

    await workbook.xlsx.writeFile(OUTPUT_PATH);
    console.log(`[Script] Excel file successfully written to ${OUTPUT_PATH}`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
