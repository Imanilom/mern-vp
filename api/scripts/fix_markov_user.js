import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

import Segment from '../models/segment.model.js';
import MarkovModel from '../models/markov.model.js';
import { PersonalMarkovModel } from '../utils/capar.markov.js';

const mongoUri = process.env.MONGO || 'mongodb://capar_admin:SecurePassword123!@127.0.0.1:27017/test?authSource=admin';

async function fixMarkov() {
  console.log(`Connecting to MongoDB...`);
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    
    const userIdStr = '6a82ccd8483cdfd43096a96f';
    const userId = new mongoose.Types.ObjectId(userIdStr);

    console.log(`Fetching segments for user ${userIdStr}...`);
    const segments = await Segment.find({ user_id: userId }).sort({ window_start: 1 }).lean();
    
    if (segments.length === 0) {
      console.log('No segments found for user. Cannot build Markov model.');
      process.exit(1);
    }

    console.log(`Found ${segments.length} segments. Building Markov model...`);
    
    // Create a mock episode structure that PersonalMarkovModel expects
    const mockEpisode = {
      verified: true,
      status: 'VERIFIED',
      windows: segments.map(s => ({
        state: s.rr_status || 'UNKNOWN',
        quality_ok: true,
        quality_gated: true
      }))
    };

    const markovBuilder = new PersonalMarkovModel(0.5);
    const counts = markovBuilder.buildTransitionCounts([mockEpisode]);
    const matrix = markovBuilder.transitionMatrix(counts);
    const serializedMatrix = markovBuilder.serializeMatrix(matrix, counts);

    console.log('Generated Transition Matrix:');
    console.log(JSON.stringify(serializedMatrix, null, 2));

    // Save to DB
    console.log('Saving to DB...');
    await MarkovModel.findOneAndUpdate(
      { user_id: userId },
      {
        user_id: userId,
        alpha: 0.5,
        matrix: serializedMatrix,
        status: 'READY',
        total_transitions_learned: segments.length - 1,
        episode_count: 1,
        last_computed_at: new Date()
      },
      { upsert: true, new: true }
    );

    console.log('Markov model successfully generated and saved.');
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

fixMarkov();
