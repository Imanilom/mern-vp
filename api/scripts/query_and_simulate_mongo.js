import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import AnomalyEvent from '../models/anomalyevent.model.js';
import Segment from '../models/segment.model.js';
import User from '../models/user.model.js';
import Baseline from '../models/baseline.model.js';
import EpisodeAnalysis from '../models/episode_analysis.model.js';
import EpisodeMeta from '../models/episodemeta.model.js';
import PolarData from '../models/data.model.js';

const MONGO_URI = process.env.MONGO || 'mongodb://capar_admin:SecurePassword123!@127.0.0.1:27017/test?authSource=admin';

async function runQueryAndSimulate() {
  try {
    console.log('Connecting to MongoDB:', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const eventId = new mongoose.Types.ObjectId('6a90023d74156d89d1dc451b');
    const userId = new mongoose.Types.ObjectId('6a7e4fc8a6e8c17678a91e8f');
    const segmentId = new mongoose.Types.ObjectId('6a9001cb8269202384f61737');

    console.log('\n================================================================================');
    console.log('1. QUERY USER DOCUMENT');
    console.log('================================================================================');
    const userDoc = await User.findById(userId).lean();
    console.log(userDoc ? JSON.stringify(userDoc, null, 2) : '❌ User not found by ID: ' + userId);

    console.log('\n================================================================================');
    console.log('2. QUERY ANOMALYEVENT DOCUMENT');
    console.log('================================================================================');
    const eventDoc = await AnomalyEvent.findById(eventId).lean();
    console.log(eventDoc ? JSON.stringify(eventDoc, null, 2) : '❌ Event not found by ID: ' + eventId);

    console.log('\n================================================================================');
    console.log('3. QUERY SEGMENT DOCUMENT');
    console.log('================================================================================');
    const segmentDoc = await Segment.findById(segmentId).lean();
    console.log(segmentDoc ? JSON.stringify(segmentDoc, null, 2) : '❌ Segment not found by ID: ' + segmentId);

    console.log('\n================================================================================');
    console.log('4. QUERY SURROUNDING SEGMENTS FOR USER (Activity: Duduk, Window around Onset)');
    console.log('================================================================================');
    const surroundingSegments = await Segment.find({ user_id: userId, activity: 'Duduk' })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    console.log(`Found ${surroundingSegments.length} surrounding segments:`);
    surroundingSegments.forEach(s => {
      console.log(`- ID: ${s._id} | Start: ${s.window_start} | HR: ${s.features?.mean_hr} | Analyzed: ${s.analyzed} | Status: ${s.rr_status}`);
    });

    console.log('\n================================================================================');
    console.log('5. QUERY BASELINE DOCUMENT (User ID, Activity: Duduk)');
    console.log('================================================================================');
    const baselines = await Baseline.find({ user_id: userId, activity: 'Duduk' }).lean();
    console.log(baselines.length > 0 ? JSON.stringify(baselines, null, 2) : '❌ Baseline not found for user & activity Duduk');

    console.log('\n================================================================================');
    console.log('6. QUERY EPISODEANALYSIS DOCUMENT');
    console.log('================================================================================');
    const analysisDoc = await EpisodeAnalysis.findOne({ episode_id: eventId }).lean();
    console.log(analysisDoc ? JSON.stringify(analysisDoc, null, 2) : '❌ EpisodeAnalysis not found for event: ' + eventId);

    console.log('\n================================================================================');
    console.log('7. QUERY EPISODEMETA DOCUMENT');
    console.log('================================================================================');
    const metaDoc = await EpisodeMeta.findOne({ episode_id: eventId }).lean();
    console.log(metaDoc ? JSON.stringify(metaDoc, null, 2) : '❌ EpisodeMeta not found for event: ' + eventId);

    console.log('\n================================================================================');
    console.log('8. SIMULATION RUN FOR THIS EVENT ON LIVE MONGODB');
    console.log('================================================================================');
    
    // Test baseline tau_in 1.70 calculation & sync
    if (eventDoc) {
      console.log(`Initial Event State  : ${eventDoc.current_state}`);
      console.log(`Initial Status         : ${eventDoc.status}`);
      console.log(`Initial Duration MS    : ${eventDoc.duration_ms}`);
      console.log(`Initial Sequence Scores: ${JSON.stringify(eventDoc.trajectory?.sequence_of_scores)}`);
    }

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (err) {
    console.error('Error querying MongoDB:', err);
    process.exit(1);
  }
}

runQueryAndSimulate();
