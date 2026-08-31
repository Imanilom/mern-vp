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

const MONGO_URI = 'mongodb://capar_admin:SecurePassword123!@127.0.0.1:27017/test?authSource=admin';

async function queryAndSimulateLive() {
  try {
    console.log('Connecting to MongoDB database "test"...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB "test" database\n');

    const eventId = new mongoose.Types.ObjectId('6a90023d74156d89d1dc451b');
    const userId = new mongoose.Types.ObjectId('6a7e4fc8a6e8c17678a91e8f');
    const segmentId = new mongoose.Types.ObjectId('6a9001cb8269202384f61737');

    console.log('================================================================================');
    console.log('1. LIVE USER DOCUMENT (ID: 6a7e4fc8a6e8c17678a91e8f)');
    console.log('================================================================================');
    const userDoc = await User.findById(userId).lean();
    console.log(userDoc ? JSON.stringify(userDoc, null, 2) : '❌ User not found');

    console.log('\n================================================================================');
    console.log('2. LIVE ANOMALYEVENT DOCUMENT (ID: 6a90023d74156d89d1dc451b)');
    console.log('================================================================================');
    const eventDoc = await AnomalyEvent.findById(eventId).lean();
    console.log(eventDoc ? JSON.stringify(eventDoc, null, 2) : '❌ AnomalyEvent not found');

    console.log('\n================================================================================');
    console.log('3. LIVE SEGMENT DOCUMENT (ID: 6a9001cb8269202384f61737)');
    console.log('================================================================================');
    const segmentDoc = await Segment.findById(segmentId).lean();
    console.log(segmentDoc ? JSON.stringify(segmentDoc, null, 2) : '❌ Segment not found');

    console.log('\n================================================================================');
    console.log('4. LIVE BASELINE DOCUMENT (User ID: 6a7e4fc8a6e8c17678a91e8f, Activity: Duduk)');
    console.log('================================================================================');
    const baselineDocs = await Baseline.find({ user_id: userId, activity: 'Duduk' }).lean();
    console.log(baselineDocs.length > 0 ? JSON.stringify(baselineDocs, null, 2) : '❌ Baseline not found');

    console.log('\n================================================================================');
    console.log('5. SURROUNDING SEGMENTS FOR USER (Activity: Duduk, around Onset 1787822539472)');
    console.log('================================================================================');
    const onsetMs = eventDoc?.onset_time || 1787822539472;
    const surroundingSegments = await Segment.find({
      user_id: userId,
      activity: 'Duduk'
    })
    .sort({ createdAt: 1 })
    .limit(20)
    .lean();

    console.log(`Found ${surroundingSegments.length} segments for user & activity Duduk:`);
    surroundingSegments.forEach(s => {
      const winStartMs = new Date(s.window_start || s.createdAt).getTime();
      console.log(`  - Seg ID: ${s._id} | Start: ${s.window_start} (${winStartMs}) | HR: ${s.features?.mean_hr} | Score: ${s.anomaly_score ?? s.score} | Status: ${s.rr_status}`);
    });

    console.log('\n================================================================================');
    console.log('6. RAW POLAR DATA SAMPLE AROUND ONSET');
    console.log('================================================================================');
    const polarSample = await PolarData.find({ user_id: userId })
      .sort({ timestamp: -1 })
      .limit(5)
      .lean();
    console.log(`Found ${polarSample.length} raw polar data samples for user:`);
    polarSample.forEach(p => {
      console.log(`  - Polar ID: ${p._id} | TS: ${p.timestamp} | HR: ${p.hr || p.heart_rate} | Device: ${p.device_id || p.deviceId}`);
    });

    console.log('\n================================================================================');
    console.log('7. LIVE EPISODEANALYSIS DOCUMENT FOR EVENT 6a90023d74156d89d1dc451b');
    console.log('================================================================================');
    const analysisDoc = await EpisodeAnalysis.findOne({ episode_id: eventId }).lean();
    console.log(analysisDoc ? JSON.stringify(analysisDoc, null, 2) : '❌ EpisodeAnalysis not found');

    console.log('\n================================================================================');
    console.log('8. LIVE EPISODEMETA DOCUMENT FOR EVENT 6a90023d74156d89d1dc451b');
    console.log('================================================================================');
    const metaDoc = await EpisodeMeta.findOne({ episode_id: eventId }).lean();
    console.log(metaDoc ? JSON.stringify(metaDoc, null, 2) : '❌ EpisodeMeta not found');

    await mongoose.disconnect();
    console.log('\n✅ Query Completed & Disconnected from MongoDB');
  } catch (err) {
    console.error('Error running live query:', err);
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(1);
  }
}

queryAndSimulateLive();
