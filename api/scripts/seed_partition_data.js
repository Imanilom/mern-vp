import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Load Models
import User from '../models/user.model.js';
import Segment from '../models/segment.model.js';
import Baseline from '../models/baseline.model.js';
import PolarData from '../models/data.model.js';

const CANDIDATE_URIS = [
  process.env.MONGO_URI,
  process.env.MONGO,
  process.env.MONGODB_URI,
  'mongodb://capar_admin:SecurePassword123!@127.0.0.1:27017/healthdevice?authSource=admin',
  'mongodb://capar_admin:SecurePassword123!@mongodb:27017/healthdevice?authSource=admin',
  'mongodb://capar_admin:SecurePassword123!@127.0.0.1:27017/mern-vp?authSource=admin',
  'mongodb://127.0.0.1:27017/healthdevice',
  'mongodb://127.0.0.1:27017/mern-vp',
  'mongodb://localhost:27017/healthdevice',
  'mongodb://localhost:27017/mern-vp',
].filter(Boolean);

async function connectToMongo() {
  for (const uri of CANDIDATE_URIS) {
    try {
      console.log(` Attempting connection to MongoDB: ${uri}`);
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
      console.log(` SUCCESS: Connected to MongoDB via ${uri}`);
      return uri;
    } catch (err) {
      console.warn(` Failed connecting to ${uri}: ${err.message}`);
    }
  }
  throw new Error('Unable to connect to any MongoDB URIs!');
}

function parseCSVLine(line) {
  const parts = line.split(';');
  if (parts.length < 6) return null;

  const hr = parseFloat(parts[0]);
  const rr = parseFloat(parts[1]);
  const dateStr = parts[2] ? parts[2].trim() : ''; // DD/MM/YYYY
  const deviceId = parts[3] ? parts[3].trim() : 'C0680226';
  const rrms = parts[4] ? parseFloat(parts[4]) : rr;
  const timeStr = parts[5] ? parts[5].trim() : ''; // HH:MM:SS

  if (isNaN(hr) || isNaN(rr) || !dateStr || !timeStr) return null;

  // Parse DD/MM/YYYY HH:MM:SS
  const dParts = dateStr.split('/');
  const tParts = timeStr.split(':');

  if (dParts.length < 3 || tParts.length < 3) return null;

  const day = parseInt(dParts[0], 10);
  const month = parseInt(dParts[1], 10) - 1;
  const year = parseInt(dParts[2], 10);

  const hour = parseInt(tParts[0], 10);
  const minute = parseInt(tParts[1], 10);
  const second = parseInt(tParts[2], 10);

  const dt = new Date(Date.UTC(year, month, day, hour, minute, second));
  return {
    hr,
    rr,
    rrms,
    deviceId,
    dateStr,
    timeStr,
    timestamp: dt.getTime()
  };
}

// Calculate standard HRV statistics for a window of samples
function calculateWindowFeatures(samples) {
  if (!samples || samples.length === 0) return null;

  const N = samples.length;
  const hrVals = samples.map(s => s.hr);
  const rrVals = samples.map(s => s.rr);

  const meanHr = hrVals.reduce((a, b) => a + b, 0) / N;
  const varHr = hrVals.reduce((a, b) => a + Math.pow(b - meanHr, 2), 0) / Math.max(1, N - 1);
  const stdHr = Math.sqrt(varHr);

  const minHr = Math.min(...hrVals);
  const maxHr = Math.max(...hrVals);
  const deltaHr = maxHr - minHr;

  // Slope linear regression HR
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < N; i++) {
    sumX += i;
    sumY += hrVals[i];
    sumXY += i * hrVals[i];
    sumX2 += i * i;
  }
  const denominator = (N * sumX2 - sumX * sumX);
  const slopeHr = denominator !== 0 ? (N * sumXY - sumX * sumY) / denominator : 0.0;

  const meanRr = rrVals.reduce((a, b) => a + b, 0) / N;
  const varRr = rrVals.reduce((a, b) => a + Math.pow(b - meanRr, 2), 0) / Math.max(1, N - 1);
  const sdnn = Math.sqrt(varRr);

  let sumDiffSq = 0;
  for (let i = 0; i < N - 1; i++) {
    sumDiffSq += Math.pow(rrVals[i + 1] - rrVals[i], 2);
  }
  const rmssd = N > 1 ? Math.sqrt(sumDiffSq / (N - 1)) : sdnn * 0.8;

  // DFA Alpha 1 estimate
  const ratio = sdnn > 0 ? rmssd / sdnn : 0.7;
  const dfaAlpha1 = Number((0.65 + ratio * 0.45).toFixed(4));

  return {
    mean_hr: Number(meanHr.toFixed(2)),
    std_hr: Number(stdHr.toFixed(2)),
    delta_hr: Number(deltaHr.toFixed(2)),
    slope_hr: Number(slopeHr.toFixed(4)),
    mean_rr: Number(meanRr.toFixed(2)),
    sdnn: Number(sdnn.toFixed(2)),
    rmssd: Number(rmssd.toFixed(2)),
    dfa_alpha1: dfaAlpha1,
    rr_raw: rrVals,
    raw_count: N
  };
}

function mapActivityToIndonesian(act) {
  switch (act.toLowerCase()) {
    case 'sitting': return 'Duduk';
    case 'standing': return 'Berdiri';
    case 'walking': return 'Berjalan';
    case 'resting': return 'Berbaring';
    case 'driving': return 'Berkendara';
    default: return 'Duduk';
  }
}

async function run() {
  await connectToMongo();

  // 1. Read data/data.csv
  const possiblePaths = [
    path.resolve(process.cwd(), 'data', 'data.csv'),
    path.resolve(process.cwd(), '..', 'data', 'data.csv'),
    path.resolve(__dirname, '..', '..', 'data', 'data.csv'),
    path.resolve(__dirname, '..', 'data', 'data.csv'),
    '/app/data/data.csv',
    '/data/data.csv',
    './data/data.csv',
    '../data/data.csv'
  ];

  let csvPath = possiblePaths.find(p => fs.existsSync(p));
  const parsedSamples = [];

  if (csvPath) {
    console.log(' Reading raw sensor data from:', csvPath);
    const rawContent = fs.readFileSync(csvPath, 'utf8');
    const lines = rawContent.split(/\r?\n/);
    console.log(` Read ${lines.length} lines from CSV.`);

    for (let i = 1; i < lines.length; i++) {
      const item = parseCSVLine(lines[i]);
      if (item) parsedSamples.push(item);
    }
    console.log(` Parsed ${parsedSamples.length} valid HR/RR samples.`);
  } else {
    console.warn(' data/data.csv not found in candidate paths:', possiblePaths);
    console.log(' Generating realistic synthetic sensor dataset fallback (3,000 samples)...');
    const startMs = Date.now() - 3000 * 1000;
    for (let i = 0; i < 3000; i++) {
      const hr = Math.round(68 + Math.sin(i / 15) * 5 + (Math.random() * 4 - 2));
      const rr = Math.round(60000 / hr + (Math.random() * 20 - 10));
      const smTime = startMs + i * 1000;
      const smDt = new Date(smTime);
      const dateStr = `${String(smDt.getDate()).padStart(2, '0')}/${String(smDt.getMonth() + 1).padStart(2, '0')}/${smDt.getFullYear()}`;
      const timeStr = `${String(smDt.getHours()).padStart(2, '0')}:${String(smDt.getMinutes()).padStart(2, '0')}:${String(smDt.getSeconds()).padStart(2, '0')}`;

      parsedSamples.push({
        hr,
        rr,
        rrms: rr - 15,
        deviceId: 'C0680226',
        dateStr,
        timeStr,
        timestamp: smTime
      });
    }
  }

  if (parsedSamples.length === 0) {
    console.error(' No valid samples parsed from CSV!');
    process.exit(1);
  }

  // Sort by timestamp
  parsedSamples.sort((a, b) => a.timestamp - b.timestamp);

  // 2. Chunk into 1-minute (60-second) windows
  const windows = [];
  const WINDOW_MS = 60 * 1000;
  let currentWindowSamples = [];
  let windowStart = parsedSamples[0].timestamp;

  for (const sample of parsedSamples) {
    if (sample.timestamp - windowStart >= WINDOW_MS) {
      if (currentWindowSamples.length >= 10) {
        const feat = calculateWindowFeatures(currentWindowSamples);
        if (feat) {
          windows.push({
            window_start: windowStart,
            window_end: windowStart + WINDOW_MS,
            deviceId: currentWindowSamples[0].deviceId || 'C0680226',
            features: feat,
            samples: currentWindowSamples
          });
        }
      }
      currentWindowSamples = [];
      windowStart = sample.timestamp;
    }
    currentWindowSamples.push(sample);
  }

  if (currentWindowSamples.length >= 10) {
    const feat = calculateWindowFeatures(currentWindowSamples);
    if (feat) {
      windows.push({
        window_start: windowStart,
        window_end: windowStart + WINDOW_MS,
        deviceId: currentWindowSamples[0].deviceId || 'C0680226',
        features: feat,
        samples: currentWindowSamples
      });
    }
  }

  console.log(` Created ${windows.length} 1-minute window segments!`);

  // 3. Query Users
  let users = await User.find({}).lean();
  console.log(` Found ${users.length} existing users in database.`);

  if (users.length === 0) {
    console.log(' Seeding default participant users...');
    const seedUsers = [
      { name: 'Partisipan A (P-001)', email: 'p001@capar.health', password: 'password123', phone_number: '081234567891', role: 'user' },
      { name: 'Partisipan B (P-002)', email: 'p002@capar.health', password: 'password123', phone_number: '081234567892', role: 'user' },
      { name: 'Partisipan C (P-003)', email: 'p003@capar.health', password: 'password123', phone_number: '081234567893', role: 'user' },
      { name: 'Partisipan D (P-004)', email: 'p004@capar.health', password: 'password123', phone_number: '081234567894', role: 'user' },
      { name: 'Partisipan E (P-005)', email: 'p005@capar.health', password: 'password123', phone_number: '081234567895', role: 'user' },
    ];
    for (const u of seedUsers) {
      await User.create(u);
    }
    users = await User.find({}).lean();
    console.log(` Seeded ${users.length} users successfully!`);
  }

  // 4. Partition 50 1-minute windows & insert raw PolarData for each user without data
  const activities = ['sitting', 'standing', 'walking', 'resting', 'driving'];
  let overallSeededSegments = 0;
  let overallSeededPolarData = 0;

  for (let uIdx = 0; uIdx < users.length; uIdx++) {
    const user = users[uIdx];
    const segCount = await Segment.countDocuments({ user_id: user._id });
    console.log(` User [${user._id}] ${user.name} (${user.email}): existing segments = ${segCount}`);

    if (segCount < 50) {
      const needed = 50 - segCount;
      console.log(`  Seeding ${needed} 1-minute segments & raw PolarData for ${user.name}...`);

      const userOffset = (uIdx * 50) % Math.max(1, windows.length - 50);
      const newSegDocs = [];
      const newPolarDocs = [];

      for (let i = 0; i < needed; i++) {
        const wSrc = windows[(userOffset + i) % windows.length];
        const activity = activities[i % activities.length];

        let classification = 'BASELINE_COMPATIBLE';
        let anomalyScore = Number((0.35 + (i % 7) * 0.08).toFixed(2));

        if (i >= 35 && i < 40) {
          classification = 'DEVIATION_CANDIDATE';
          anomalyScore = Number((1.85 + (i % 3) * 0.15).toFixed(2));
        } else if (i >= 40 && i < 45) {
          classification = 'PERSISTENT_DEVIATION';
          anomalyScore = Number((2.85 + (i % 3) * 0.25).toFixed(2));
        } else if (i >= 45) {
          classification = 'RECOVERY';
          anomalyScore = Number((0.95 + (i % 3) * 0.10).toFixed(2));
        }

        const nowOffsetMs = Date.now() - (needed - i) * 60 * 1000;

        newSegDocs.push({
          user_id: user._id,
          device_id: user.current_device || wSrc.deviceId || 'C0680226',
          window_type: '1min',
          window_start: nowOffsetMs,
          window_end: nowOffsetMs + 60000,
          activity_label: activity,
          features: wSrc.features,
          rr_raw: wSrc.features.rr_raw,
          raw_count: wSrc.features.raw_count,
          is_valid: true,
          analyzed: true,
          anomaly_score: anomalyScore,
          classification: classification,
          z_scores: {
            z_hr: Number(((wSrc.features.mean_hr - 72) / 4.5).toFixed(2)),
            z_rmssd: Number(((wSrc.features.rmssd - 35) / 5.2).toFixed(2)),
            z_sdnn: Number(((wSrc.features.sdnn - 48) / 6.1).toFixed(2)),
            z_dfa: Number(((wSrc.features.dfa_alpha1 - 0.95) / 0.08).toFixed(2))
          }
        });

        // Insert raw sample records into PolarData (data.model.js)
        if (wSrc.samples && wSrc.samples.length > 0) {
          wSrc.samples.forEach((sm, smIdx) => {
            const smTimeMs = nowOffsetMs + smIdx * 1000;
            const smDt = new Date(smTimeMs);
            const dateStr = `${String(smDt.getDate()).padStart(2, '0')}/${String(smDt.getMonth() + 1).padStart(2, '0')}/${smDt.getFullYear()}`;
            const timeStr = `${String(smDt.getHours()).padStart(2, '0')}:${String(smDt.getMinutes()).padStart(2, '0')}:${String(smDt.getSeconds()).padStart(2, '0')}`;

            newPolarDocs.push({
              user_id: user._id,
              timestamp: smTimeMs,
              date_created: dateStr,
              time_created: timeStr,
              hr: sm.hr,
              rr: sm.rr,
              rrms: sm.rrms || sm.rr,
              activity: mapActivityToIndonesian(activity),
              device_id: user.current_device || sm.deviceId || 'C0680226',
              processStatus: 'DONE',
              isChecked: true
            });
          });
        }
      }

      await Segment.insertMany(newSegDocs);
      overallSeededSegments += newSegDocs.length;

      if (newPolarDocs.length > 0) {
        try {
          await PolarData.insertMany(newPolarDocs, { ordered: false });
          overallSeededPolarData += newPolarDocs.length;
        } catch (pErr) {
          // Ignore duplicate timestamp errors
          if (pErr.insertedDocs) {
            overallSeededPolarData += pErr.insertedDocs.length;
          }
        }
      }

      console.log(`  Inserted ${newSegDocs.length} segments & ${newPolarDocs.length} PolarData records for ${user.name}`);
    }

    // 5. Generate / Update Baseline models for this user across activities
    console.log(`  Calculating Baseline models for user ${user.name}...`);
    for (const act of activities) {
      const userSegs = await Segment.find({ user_id: user._id, activity_label: act }).lean();
      if (userSegs.length > 0) {
        const hrs = userSegs.map(s => s.features?.mean_hr || 72);
        const rmssds = userSegs.map(s => s.features?.rmssd || 35);
        const sdnns = userSegs.map(s => s.features?.sdnn || 48);
        const dfas = userSegs.map(s => s.features?.dfa_alpha1 || 0.95);

        const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
        const std = arr => Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - mean(arr), 2), 0) / Math.max(1, arr.length - 1));

        await Baseline.findOneAndUpdate(
          { user_id: user._id, activity: act },
          {
            user_id: user._id,
            activity: act,
            time_period: 'Morning (08:00 - 12:00)',
            segment_count: userSegs.length,
            is_mature: true,
            is_frozen: false,
            status: 'Approved',
            stats: {
              hr_mean: { mean: Number(mean(hrs).toFixed(2)), std: Number(std(hrs).toFixed(2)) },
              rmssd: { mean: Number(mean(rmssds).toFixed(2)), std: Number(std(rmssds).toFixed(2)) },
              sdnn: { mean: Number(mean(sdnns).toFixed(2)), std: Number(std(sdnns).toFixed(2)) },
              dfa_alpha1: { mean: Number(mean(dfas).toFixed(4)), std: Number(std(dfas).toFixed(4)) }
            },
            maturity_detail: {
              level: 'mature',
              distinct_days: 3,
              n_effective: Number((userSegs.length * 0.95).toFixed(1)),
              max_single_day_frac: 0.35,
              q_signal: 0.96,
              q_stability: 0.91,
              bq: 0.93
            },
            learned_tau: { tau_in: 1.86, tau_out: 1.18, tau_normal: 0.75 },
            last_updated: new Date()
          },
          { upsert: true, new: true }
        );
      }
    }
  }

  console.log('\n======================================================');
  console.log(` DATA PARTITIONING & POLARDATA SEEDING COMPLETE!`);
  console.log(` Total Segments Seeded: ${overallSeededSegments}`);
  console.log(` Total PolarData Records Seeded: ${overallSeededPolarData}`);
  console.log(` Processed Users Count: ${users.length}`);
  console.log('======================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error(' Script failed with error:', err);
  process.exit(1);
});
