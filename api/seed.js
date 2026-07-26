import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from './models/user.model.js';
import Segment from './models/segment.model.js';
import Raw from './models/raw.model.js';
import Baseline from './models/baseline.model.js';
import DataTransformation from './models/datatransformation.model.js';
import ActivityContext from './models/activitycontext.model.js';

dotenv.config();

const MONGO_URI = process.env.MONGO || process.env.MONGO_URI || process.env.TARGET_MONGO_URI || "mongodb://localhost:27017/healthdevice";

async function seed() {
  console.log('Connecting to MongoDB:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB successfully.');

  const defaultPasswordHash = await bcrypt.hash('123456', 10);

  // 1. Doctor user setup
  let doctor = await User.findOne({ role: 'doctor' });
  if (!doctor) {
    doctor = await User.create({
      _id: new mongoose.Types.ObjectId("675ba1e92b8428e4dd641cd0"),
      guid: "P012",
      name: "Iman Wiguna",
      email: "memerlin90@gmail.com",
      password: defaultPasswordHash,
      current_device: "TEST_DEVICE_123",
      phone_number: "0851",
      address: "Bandung, Indonesia",
      role: "doctor",
      is_active: true,
      profilePicture: "https://firebasestorage.googleapis.com/v0/b/vidyamedic-bb1f1.appspot.com/o/1736392861602people.avif?alt=media&token=ea05b681-5663-4e2b-b296-d20cb36250ab"
    });
    console.log('Created Doctor:', doctor.name);
  } else {
    console.log('Existing Doctor found:', doctor.name);
  }

  // 2. Three Raw Data Patients setup
  const patientDefinitions = [
    {
      _id: new mongoose.Types.ObjectId("67652725d40f2b664e88deb0"),
      guid: "dftgdrtger",
      username: "patient",
      name: "User Standard",
      email: "user@gmail.com",
      password: defaultPasswordHash,
      current_device: "POLAR_SIM",
      phone_number: "08510001",
      address: "Jakarta",
      role: "user",
      is_active: true,
      docter: doctor._id
    },
    {
      _id: new mongoose.Types.ObjectId("67652725d40f2b664e88deb1"),
      guid: "P002",
      username: "patient2",
      name: "Budi Santoso",
      email: "budi@gmail.com",
      password: defaultPasswordHash,
      current_device: "POLAR_H10_02",
      phone_number: "08510002",
      address: "Surabaya",
      role: "user",
      is_active: true,
      docter: doctor._id
    },
    {
      _id: new mongoose.Types.ObjectId("67652725d40f2b664e88deb2"),
      guid: "P003",
      username: "patient3",
      name: "Siti Rahma",
      email: "siti@gmail.com",
      password: defaultPasswordHash,
      current_device: "POLAR_H10_03",
      phone_number: "08510003",
      address: "Medan",
      role: "user",
      is_active: true,
      docter: doctor._id
    }
  ];

  const createdPatients = [];
  for (const def of patientDefinitions) {
    let pat = await User.findOne({ email: def.email });
    if (!pat) {
      pat = await User.create(def);
      console.log(`Created Patient: ${pat.name} (${pat.guid})`);
    } else {
      pat.docter = doctor._id;
      await pat.save();
      console.log(`Updated Patient: ${pat.name} (${pat.guid})`);
    }
    createdPatients.push(pat);
  }

  // 3. Generate raw segments covering Pagi, Siang, Sore for each patient
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  // Time slots in hours WIB offset
  const timeSlots = [
    { period: 'Pagi', startHour: 7, count: 6 },     // 07:00 - 10:00 (Pagi)
    { period: 'Siang', startHour: 13, count: 6 },   // 13:00 - 16:00 (Siang)
    { period: 'Sore', startHour: 19, count: 6 },    // 19:00 - 22:00 (Sore/Malam)
  ];

  for (const patient of createdPatients) {
    console.log(`Generating segments for patient ${patient.name} (${patient.guid})...`);

    // Clean existing segments for fresh clean seed
    await Segment.deleteMany({ user_id: patient._id });

    const newSegments = [];

    for (const slot of timeSlots) {
      for (let i = 0; i < slot.count; i++) {
        const windowStart = todayMs + (slot.startHour * 3600 * 1000) + (i * 15 * 60 * 1000); // every 15 min
        const windowEnd = windowStart + (15 * 60 * 1000);

        // Missing data simulation: e.g., 5 missing out of 1000 expected (5/1000)
        const expectedCount = 1000;
        const missingCount = Math.floor(Math.random() * 8); // 0 to 7 missing samples
        const receivedCount = expectedCount - missingCount;
        const missingRatio = missingCount / expectedCount;
        const confidenceScore = parseFloat(((1 - missingRatio) * 100).toFixed(2));

        // Activity simulation based on period
        let activity = 'Rest';
        let baseHr = 68;
        let baseRmssd = 45;
        let motion = 0.15;

        if (slot.period === 'Pagi') {
          activity = i % 2 === 0 ? 'Light' : 'Rest';
          baseHr = 75;
          motion = 0.4;
        } else if (slot.period === 'Siang') {
          activity = i === 2 || i === 3 ? 'Moderate' : 'Light';
          baseHr = 85;
          motion = 0.85;
        } else if (slot.period === 'Sore') {
          activity = i === 1 ? 'Intense' : 'Rest';
          baseHr = 70;
          motion = 0.2;
        }

        // Anomaly / Artifact logic
        const isArtifact = i === 4; // 1 artifact segment per slot
        const isAnomaly = i === 2 && slot.period === 'Siang'; // Genuine anomaly in afternoon slot

        let hr = baseHr + (Math.random() * 6 - 3);
        let rmssd = baseRmssd + (Math.random() * 8 - 4);
        let anomalyScore = 0.4;
        let classification = 'Normal';

        if (isArtifact) {
          hr = 195; // Unrealistic sensor contact drop spike
          rmssd = 2;
          anomalyScore = 2.8;
          classification = 'Caution';
        } else if (isAnomaly) {
          hr = 115; // Genuine tachycardia during rest
          rmssd = 14;
          anomalyScore = 3.2;
          classification = 'Alert';
        }

        newSegments.push({
          user_id: patient._id,
          device_id: patient.current_device || 'POLAR_SIM',
          window_start: windowStart,
          window_end: windowEnd,
          activity_label: activity,
          features: {
            mean_hr: parseFloat(hr.toFixed(1)),
            std_hr: parseFloat((Math.random() * 3 + 1).toFixed(1)),
            delta_hr: parseFloat((Math.random() * 10 + 2).toFixed(1)),
            slope_hr: parseFloat((Math.random() * 0.2 - 0.1).toFixed(3)),
            mean_rr: parseFloat((60000 / hr).toFixed(1)),
            sdnn: parseFloat((rmssd * 1.2).toFixed(1)),
            rmssd: parseFloat(rmssd.toFixed(1)),
            rolling_variance: parseFloat((Math.random() * 5 + 2).toFixed(1)),
            motion_intensity: parseFloat(motion.toFixed(2)),
            dfa_alpha1: parseFloat((0.95 + (Math.random() * 0.2 - 0.1)).toFixed(2)),
          },
          raw_count: receivedCount,
          is_valid: true,
          analyzed: true,
          anomaly_score: anomalyScore,
          classification: classification,
          z_scores: {
            z_hr: isAnomaly ? 3.1 : isArtifact ? 4.2 : 0.3,
            z_rr: isAnomaly ? -2.5 : 0.1,
            z_sdnn: -0.4,
            z_rmssd: isAnomaly ? -2.8 : -0.2,
            z_motion: motion > 0.5 ? 1.4 : 0.1,
            z_dfa: 0.2,
          },
          doctor_validation: {
            status: isAnomaly ? 'pending' : 'validated',
            validated_by: isAnomaly ? null : doctor._id,
            doctor_notes: isAnomaly ? '' : 'Auto-validated normal activity window',
            validated_at: isAnomaly ? null : new Date(),
          },
          missing_data_info: {
            expected_count: expectedCount,
            received_count: receivedCount,
            missing_count: missingCount,
            missing_ratio: missingRatio,
            confidence_score: confidenceScore,
          },
          signal_quality: {
            is_artifact: isArtifact,
            is_anomaly: isAnomaly,
            artifact_type: isArtifact ? 'contact_loss' : null,
          },
          dt_prediction: {
            predicted_activity: activity,
            confidence: parseFloat((0.92 + Math.random() * 0.07).toFixed(2)),
          }
        });
      }
    }

    await Segment.insertMany(newSegments);
    console.log(`Inserted ${newSegments.length} segments for ${patient.name}.`);

    // Clean and compute Real Baselines per patient
    await Baseline.deleteMany({ user_id: patient._id });

    const activities = ['Rest', 'Light', 'Moderate', 'Intense'];
    const periods = ['morning', 'afternoon', 'evening'];

    const newBaselines = [];
    for (const act of activities) {
      for (const per of periods) {
        const segs = newSegments.filter(s => s.activity_label === act);
        const count = segs.length || 15;
        const hrList = segs.map(s => s.features.mean_hr);
        const rmssdList = segs.map(s => s.features.rmssd);
        const sdnnList = segs.map(s => s.features.sdnn);
        const dfaList = segs.map(s => s.features.dfa_alpha1);
        const motionList = segs.map(s => s.features.motion_intensity);

        const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 70;
        const std = (arr, m) => arr.length > 1 ? Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / (arr.length - 1)) : 3;

        const meanHr = avg(hrList);
        const meanRmssd = avg(rmssdList);
        const meanSdnn = avg(sdnnList);
        const meanDfa = avg(dfaList);
        const meanMotion = avg(motionList);

        newBaselines.push({
          user_id: patient._id,
          activity: act,
          time_period: per,
          segment_count: count * 5,
          is_mature: true,
          status: 'approved',
          stats: {
            mean_hr: { n: count * 5, mean: parseFloat(meanHr.toFixed(1)), std: parseFloat(std(hrList, meanHr).toFixed(1)) },
            rmssd: { n: count * 5, mean: parseFloat(meanRmssd.toFixed(1)), std: parseFloat(std(rmssdList, meanRmssd).toFixed(1)) },
            sdnn: { n: count * 5, mean: parseFloat(meanSdnn.toFixed(1)), std: parseFloat(std(sdnnList, meanSdnn).toFixed(1)) },
            dfa_alpha1: { n: count * 5, mean: parseFloat(meanDfa.toFixed(2)), std: 0.08 },
            motion_intensity: { n: count * 5, mean: parseFloat(meanMotion.toFixed(2)), std: 0.1 },
          }
        });
      }
    }

    await Baseline.insertMany(newBaselines);
    console.log(`Inserted ${newBaselines.length} baselines for ${patient.name}.`);

    // Clean and seed Data Transformations (DT Layer)
    await DataTransformation.deleteMany({ user_id: patient._id });
    const newDTs = [];
    for (let j = 0; j < 20; j++) {
      const ts = new Date(todayMs + j * 60000);
      newDTs.push({
        user_id: patient._id,
        timestamp: ts,
        rr_interval: Math.round(60000 / (70 + (j % 5) * 3)),
        hr: 70 + (j % 5) * 3,
        accelerometer: { x: 0.02, y: 0.05, z: 0.98, magnitude: 0.98 },
        temperature: 36.6,
        activity: j % 2 === 0 ? 'Rest' : 'Light',
      });
    }
    await DataTransformation.insertMany(newDTs);
    console.log(`Inserted ${newDTs.length} DT stream records for ${patient.name}.`);

    // Clean and seed Activity Contexts
    await ActivityContext.deleteMany({ user_id: patient._id });
    const newContexts = [
      {
        user_id: patient._id,
        start_time: todayMs + 7 * 3600 * 1000,
        end_time: todayMs + 12 * 3600 * 1000,
        activity: { posture: 'Sitting', movement: 'Low', location: 'Office', time_of_day: 'Morning', stress_level: 'Low' }
      },
      {
        user_id: patient._id,
        start_time: todayMs + 13 * 3600 * 1000,
        end_time: todayMs + 17 * 3600 * 1000,
        activity: { posture: 'Walking', movement: 'Moderate', location: 'Outdoor', time_of_day: 'Afternoon', stress_level: 'Medium' }
      },
      {
        user_id: patient._id,
        start_time: todayMs + 18 * 3600 * 1000,
        end_time: todayMs + 23 * 3600 * 1000,
        activity: { posture: 'Lying', movement: 'Static', location: 'Home', time_of_day: 'Evening', stress_level: 'Low' }
      }
    ];
    await ActivityContext.insertMany(newContexts);
    console.log(`Inserted ${newContexts.length} activity contexts for ${patient.name}.`);
  }

  console.log('Seed completed successfully!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
