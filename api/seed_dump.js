import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Data from './models/data.model.js'; // Adjust the path if needed

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_USER_ID = '6a6609326bf83196b1d73e97'; // From prompt
const DUMP_DIR = path.join(__dirname, 'dump', 'hrv-results-Raw');

const aktivitasMap = {
  'duduk': 'Duduk',
  'berdiri': 'Berdiri',
  'berjalan': 'Berjalan',
  'tidur': 'Tidur',
  'berbaring': 'Berbaring',
  'lari': 'Berlari',
  'makan': 'Makan',
  'bekerja': 'Bekerja'
};

function parseTimestamp(dateStr, timeStr) {
  // dateStr: DD/MM/YYYY, timeStr: HH:MM:SS
  const [day, month, year] = dateStr.split('/');
  const [hour, min, sec] = timeStr.split(':');
  // assuming GMT+7 for Indonesia
  const isoStr = `${year}-${month}-${day}T${hour}:${min}:${sec}+07:00`;
  return new Date(isoStr).getTime();
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGO || 'mongodb://localhost:27017/vidya-medic');
    console.log('Connected to MongoDB');

    const files = fs.readdirSync(DUMP_DIR).filter(f => f.endsWith('.json'));
    console.log(`Found ${files.length} JSON files.`);

    for (const file of files) {
      console.log(`Processing ${file}...`);
      const filePath = path.join(DUMP_DIR, file);
      const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      
      const bulkOps = [];
      const seenTimestamps = new Set();
      let invalidCount = 0;

      for (const item of rawData) {
        if (!item.date_created || !item.time_created || item.HR == null || item.RR == null) {
          invalidCount++;
          continue;
        }

        const timestamp = parseTimestamp(item.date_created, item.time_created);
        if (isNaN(timestamp)) {
          invalidCount++;
          continue;
        }

        if (seenTimestamps.has(timestamp)) {
          continue; 
        }
        seenTimestamps.add(timestamp);

        const activityLabel = item.aktivitas 
          ? (aktivitasMap[item.aktivitas.toLowerCase()] || 'Lainnya')
          : 'Duduk';

        const acc_x = (Math.random() * 2 - 1).toFixed(3);
        const acc_y = (Math.random() * 2 - 1).toFixed(3);
        const acc_z = (Math.random() * 2 - 1).toFixed(3);
        const ecg = Math.round(Math.sin(timestamp / 1000) * 50 + 50);

        const doc = {
          user_id: TARGET_USER_ID,
          timestamp,
          date_created: item.date_created,
          time_created: item.time_created,
          hr: item.HR,
          rr: item.RR,
          rrms: item.rrRMS || item.RR,
          acc_x,
          acc_y,
          acc_z,
          ecg,
          activity: activityLabel,
          device_id: item.guid_device || 'POLAR_DUMP',
          isChecked: false
        };

        bulkOps.push(doc);
      }

      console.log(`File ${file}: ${bulkOps.length} valid records to insert. (${invalidCount} invalid)`);
      
      const CHUNK_SIZE = 5000;
      let insertedCount = 0;
      for (let i = 0; i < bulkOps.length; i += CHUNK_SIZE) {
        const chunk = bulkOps.slice(i, i + CHUNK_SIZE);
        try {
          const res = await Data.insertMany(chunk, { ordered: false });
          insertedCount += res.length;
        } catch (err) {
          if (err.code === 11000) {
            insertedCount += err.insertedDocs ? err.insertedDocs.length : 0;
          } else {
            console.error('Error inserting chunk:', err.message);
          }
        }
      }
      console.log(`Finished inserting ${file}. Total inserted roughly: ${insertedCount}`);
    }

    console.log('All done!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
