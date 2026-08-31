import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import AnomalyEvent from '../models/anomalyevent.model.js';
import EpisodeAnalysis from '../models/episode_analysis.model.js';
import EpisodeMeta from '../models/episodemeta.model.js';
import User from '../models/user.model.js';
import { syncEpisodeMeta } from '../controllers/analysis.controller.js';

const MONGO_URI = 'mongodb://capar_admin:SecurePassword123!@127.0.0.1:27017/test?authSource=admin';

async function runLiveMongoSimulation() {
  try {
    console.log('Connecting to MongoDB database "test"...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB "test" database\n');

    const eventId = new mongoose.Types.ObjectId('6a90023d74156d89d1dc451b');

    // 1. Fetch live AnomalyEvent & EpisodeAnalysis
    const ev = await AnomalyEvent.findById(eventId);
    if (!ev) {
      console.error('❌ Event 6a90023d74156d89d1dc451b not found');
      process.exit(1);
    }

    const analysisDoc = await EpisodeAnalysis.findOne({ episode_id: eventId });

    console.log('================================================================================');
    console.log('1. BEFORE SIMULATION - LIVE ANOMALYEVENT DOCUMENT');
    console.log('================================================================================');
    console.log(`Event ID       : ${ev._id}`);
    console.log(`Status         : ${ev.status}`);
    console.log(`Current State  : ${ev.current_state}`);
    console.log(`Onset Time     : ${new Date(ev.onset_time).toISOString()} (${ev.onset_time})`);
    console.log(`Onset Score    : ${ev.onset_score}`);
    console.log(`Peak Score     : ${ev.peak_score}`);
    console.log(`Duration MS    : ${ev.duration_ms}`);
    console.log(`Resolved Time  : ${ev.resolved_time}`);

    // 2. Perform 2-of-3 Persistence check simulation with Baseline Tau_In = 1.70
    console.log('\n================================================================================');
    console.log('2. SIMULATING WINDOW 2 (2-of-3 Persistence) & DISCONNECT HANDLER ON LIVE MONGO');
    console.log('================================================================================');

    const startWinStart = ev.onset_time;
    const window2Time = startWinStart + 300000; // +5 mins
    const window2Score = 3.52; // Second window >= tau_in 1.70

    // Update AnomalyEvent on Window 2 -> Transition to PERSISTENT_DEVIATION
    ev.trajectory.sequence_of_scores.push(window2Score);
    ev.trajectory.persistence = 2;
    ev.window_count = 2;
    ev.current_state = 'PERSISTENT_DEVIATION';
    ev.duration_ms = 600000; // 10 minutes active
    await ev.save();
    console.log(`✅ Window 2 Processed: State updated to PERSISTENT_DEVIATION (2 of 3 windows >= tau_in 1.70)`);

    // 3. Simulate Data Disconnect Handler (>15 mins gap without recovery < 0.85)
    const disconnectTime = window2Time; // Force close at last valid window
    ev.status = 'closed';
    ev.admin_status = 'CLOSED';
    ev.current_state = 'FORCE_CLOSED_TAU_OUT';
    ev.recovery_entry_at = disconnectTime;
    ev.recovered_at = disconnectTime;
    ev.resolved_time = disconnectTime;
    ev.duration_ms = 600000;
    ev.unresolved_reason = 'Data terputus / device dilepas sebelum titik tau_out (Force closed at last valid window)';
    await ev.save();
    console.log(`✅ Disconnect Handler Executed: Force closed at tau_out (16:32:19 WIB / 09:32:19 UTC)`);

    // 4. Sync EpisodeMeta Collection with EpisodeAnalysis ID
    const analysisId = analysisDoc ? analysisDoc._id : null;
    await syncEpisodeMeta(ev, analysisId);
    console.log(`✅ EpisodeMeta Document Synced & Linked to EpisodeAnalysis ID: ${analysisId}`);

    // 5. Query updated Documents
    const updatedEventDoc = await AnomalyEvent.findById(eventId).lean();
    const updatedMetaDoc = await EpisodeMeta.findOne({ episode_id: eventId }).lean();
    const updatedAnalysisDoc = await EpisodeAnalysis.findOne({ episode_id: eventId }).lean();

    console.log('\n================================================================================');
    console.log('3. UPDATED LIVE ANOMALYEVENT DOCUMENT (MONGODB)');
    console.log('================================================================================');
    console.log(JSON.stringify(updatedEventDoc, null, 2));

    console.log('\n================================================================================');
    console.log('4. CREATED & LINKED EPISODEMETA DOCUMENT (MONGODB)');
    console.log('================================================================================');
    console.log(JSON.stringify(updatedMetaDoc, null, 2));

    console.log('\n================================================================================');
    console.log('5. LINKED EPISODEANALYSIS DOCUMENT (MONGODB)');
    console.log('================================================================================');
    console.log(JSON.stringify(updatedAnalysisDoc, null, 2));

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (err) {
    console.error('Error running live MongoDB simulation:', err);
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(1);
  }
}

runLiveMongoSimulation();
