import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const BaselineSchema = new mongoose.Schema({
  user_id: mongoose.Schema.Types.ObjectId,
  activity: String,
  time_period: String,
  segment_count: Number,
  maturity_detail: Object,
  learned_tau: Object
}, { collection: 'baselines', strict: false });

const UserSchema = new mongoose.Schema({ name: String }, { collection: 'users', strict: false });
const PatientSchema = new mongoose.Schema({ name: String }, { collection: 'patients', strict: false });

async function exportThresholds() {
  const mongoUri = process.env.MONGO || 'mongodb://127.0.0.1:27017/capar-vp';
  console.log(`[Export] Connecting to MongoDB (${mongoUri})...`);
  
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('[Export] Connected to MongoDB.');

    const Baseline = mongoose.model('Baseline', BaselineSchema);
    const baselines = await Baseline.find({}).lean();
    
    console.log(`[Export] Found ${baselines.length} baselines. Writing to CSV...`);

    const User = mongoose.model('User', UserSchema);
    const Patient = mongoose.model('Patient', PatientSchema);
    
    const users = await User.find({}).lean();
    const patients = await Patient.find({}).lean();
    
    const userMap = {};
    for (const u of users) {
      if (u._id) userMap[u._id.toString()] = u.name;
    }
    for (const p of patients) {
      if (p._id) userMap[p._id.toString()] = p.name;
    }

    const headers = [
      'Baseline ID',
      'User Name',
      'User ID',
      'Activity',
      'Time Period',
      'Segment Count',
      'Maturity Level',
      'Tau In',
      'Tau Out',
      'Tau Normal',
      'Tau Source',
      'Stable Score Count',
      'Computed At'
    ];

    let csvContent = headers.join(',') + '\n';

    for (const b of baselines) {
      const tau = b.learned_tau || {};
      const maturity = b.maturity_detail || {};
      
      const userName = (b.user_id && userMap[b.user_id.toString()]) || 'Unknown User';
      
      const row = [
        b._id,
        userName,
        b.user_id,
        b.activity || 'Unknown',
        b.time_period || 'Unknown',
        b.segment_count || 0,
        maturity.level || 'cold_start',
        tau.tau_in ?? '',
        tau.tau_out ?? '',
        tau.tau_normal ?? '',
        tau.source ?? 'N/A',
        tau.stable_score_count ?? 0,
        tau.computed_at ? new Date(tau.computed_at).toISOString() : ''
      ];

      csvContent += row.map(v => `"${v}"`).join(',') + '\n';
    }

    const outputPath = path.resolve('threshold_logs.csv');
    fs.writeFileSync(outputPath, csvContent, 'utf-8');

    console.log(`[Export] Selesai! Data threshold berhasil diexport ke: ${outputPath}`);
  } catch (err) {
    console.error('[Export] Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

exportThresholds();
