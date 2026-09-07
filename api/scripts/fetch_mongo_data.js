import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Segment from '../models/segment.model.js';
import User from '../models/user.model.js';
import Patient from '../models/patient.model.js';
import EpisodeAnalysis from '../models/episode_analysis.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO || 'mongodb://127.0.0.1:27017/healthdevice';
console.log(`Connecting to MongoDB at: ${MONGO_URI}`);

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // 1. Populasi (Agregat)
    console.log('Fetching population data...');
    const populationData = await Segment.aggregate([
      { $match: { 'features.mean_hr': { $exists: true, $ne: null } } },
      { $sort: { window_start: 1 } },
      { $limit: 1000 },
      { $project: { time: '$window_start', hr: '$features.mean_hr' } }
    ]);

    // 2. Populasi Per-Aktivitas
    const activities = ['Rest', 'Light', 'Moderate', 'Intense'];
    let popActivityData = {};
    for (const act of activities) {
      console.log(`Fetching population activity data for: ${act}`);
      const actData = await Segment.find({ 
          activity_label: act,
          'features.mean_hr': { $ne: null } 
        })
        .sort({ window_start: 1 })
        .limit(300)
        .select('window_start features.mean_hr')
        .lean();
      popActivityData[act] = actData.map(d => ({ hr: d.features.mean_hr }));
    }

    // 3. Personal (Find user with most episodes)
    const userStats = await EpisodeAnalysis.aggregate([
      { $group: { _id: '$user_id', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);
    
    let targetUserId = null;
    let personalData = [];
    let personalActivityData = {};
    let userDetails = {};

    if (userStats.length > 0) {
      targetUserId = userStats[0]._id;
      console.log(`Fetching personal data for user: ${targetUserId} (Count: ${userStats[0].count})`);
      
      // Get User Details
      const user = await User.findById(targetUserId).lean();
      const patient = await Patient.findOne({ user: targetUserId }).lean();
      
      userDetails = {
        _id: targetUserId,
        email: user?.email || 'Unknown',
        role: user?.role || 'Unknown',
        gender: patient?.gender || 'Unknown',
        age: patient?.date_of_birth ? new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear() : 'Unknown',
        episodes_count: userStats[0].count
      };
      
      // Personal General
      personalData = await Segment.find({ user_id: targetUserId, 'features.mean_hr': { $ne: null } })
        .sort({ window_start: 1 })
        .limit(1000)
        .select('window_start features.mean_hr activity_label')
        .lean();

      // Personal Per-Aktivitas
      for (const act of activities) {
        console.log(`Fetching personal activity data for: ${act}`);
        const actData = await Segment.find({ 
            user_id: targetUserId, 
            activity_label: act,
            'features.mean_hr': { $ne: null } 
          })
          .sort({ window_start: 1 })
          .limit(300)
          .select('features.mean_hr')
          .lean();
        
        personalActivityData[act] = actData.map(d => ({ hr: d.features.mean_hr }));
      }
    }

    const output = {
      user_details: userDetails,
      population: populationData,
      population_per_activity: popActivityData,
      personal: personalData.map(d => ({ hr: d.features.mean_hr })),
      personal_per_activity: personalActivityData
    };

    const outPath = path.join(__dirname, 'mongo_sim_data.json');
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`Data saved to ${outPath}`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    mongoose.connection.close();
  }
}

run();
