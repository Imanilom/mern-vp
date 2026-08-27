import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env') });
const mongoUri = process.env.MONGO || 'mongodb://127.0.0.1:27017/capar-vp';

async function run() {
  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  console.log('Connected.');
  
  const db = mongoose.connection.db;

  console.log('Searching for a closed persistent event...');
  let event = null;
  
  // Find in episodeanalyses first
  const eps = await db.collection('episodeanalyses').find({
    end_time: { $exists: true, $ne: null }
  }).sort({ ttr: -1, deviation_auc: -1, total_duration: -1 }).limit(1).toArray();

  let episodeDoc = null;
  if (eps.length > 0) {
    episodeDoc = eps[0];
    if (episodeDoc.episode_id) {
      event = await db.collection('anomalievents').findOne({ _id: episodeDoc.episode_id });
    }
  }

  if (!event) {
    // Fallback to anomalievents
    const events = await db.collection('anomalievents').find({
      status: { $in: ['closed', 'resolved', 'recovered'] }
    }).sort({ duration_ms: -1, 'trajectory.recovery_time_ms': -1 }).limit(1).toArray();

    if (events.length > 0) {
      event = events[0];
    }
  }

  if (!event && !episodeDoc) {
    console.log('No persistent event found in DB!');
    process.exit(1);
  }

  console.log('Found Event:', event ? event._id : 'N/A', '| EpisodeAnalysis:', episodeDoc ? episodeDoc._id : 'N/A');

  const userId = event ? event.user_id : episodeDoc.user_id;
  const startTime = event ? event.onset_time : new Date(episodeDoc.start_time).getTime();
  const endTime = event ? (event.resolved_time || event.recovered_at || (event.onset_time + 15*60000)) : new Date(episodeDoc.end_time).getTime();
  
  const paddedStart = startTime - (5 * 60 * 1000); // 5 mins before
  const paddedEnd = endTime + (10 * 60 * 1000); // 10 mins after

  console.log(`Fetching data for User: ${userId}`);
  console.log(`Time range: ${new Date(paddedStart)} to ${new Date(paddedEnd)}`);

  const segments = await db.collection('segments').find({
    user_id: userId,
    window_start: { $gte: paddedStart, $lte: paddedEnd }
  }).sort({ window_start: 1 }).toArray();

  const rawData = await db.collection('polardatas').find({
    user_id: userId,
    timestamp: { $gte: paddedStart, $lte: paddedEnd }
  }).sort({ timestamp: 1 }).toArray();

  console.log(`Found ${segments.length} segments and ${rawData.length} raw data points.`);

  // Create Excel
  const workbook = new ExcelJS.Workbook();

  // Summary Sheet
  const sheetSummary = workbook.addWorksheet('Summary');
  sheetSummary.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 50 }
  ];
  
  const ttrMs = event?.trajectory?.recovery_time_ms || episodeDoc?.ttr || (endTime - startTime);
  const ttrMin = (ttrMs / 60000).toFixed(2);
  const auc = event?.auc_score || episodeDoc?.deviation_auc || 'N/A';

  sheetSummary.addRow({ metric: 'Event ID', value: event ? event._id.toString() : 'N/A' });
  sheetSummary.addRow({ metric: 'User ID', value: userId.toString() });
  sheetSummary.addRow({ metric: 'Start Time', value: new Date(startTime).toISOString() });
  sheetSummary.addRow({ metric: 'End Time', value: new Date(endTime).toISOString() });
  sheetSummary.addRow({ metric: 'TTR (Time To Recover) ms', value: ttrMs });
  sheetSummary.addRow({ metric: 'TTR (Time To Recover) minutes', value: ttrMin });
  sheetSummary.addRow({ metric: 'AUC-D (Area Under Curve)', value: auc });
  sheetSummary.addRow({ metric: 'Peak Score', value: event?.peak_score || episodeDoc?.peak_deviation || 'N/A' });

  // Segments Sheet
  const sheetSeg = workbook.addWorksheet('Segments');
  sheetSeg.columns = [
    { header: 'Window Start', key: 'ws', width: 25 },
    { header: 'Anomaly Score', key: 'score', width: 15 },
    { header: 'State', key: 'state', width: 25 },
    { header: 'Mean HR', key: 'hr', width: 10 },
    { header: 'RMSSD', key: 'rmssd', width: 10 }
  ];

  segments.forEach(s => {
    sheetSeg.addRow({
      ws: new Date(s.window_start).toISOString(),
      score: s.anomaly_score,
      state: s.classification || s.rr_status,
      hr: s.features?.mean_hr,
      rmssd: s.features?.rmssd
    });
  });

  // Raw Data Sheet
  const sheetRaw = workbook.addWorksheet('Raw Data');
  sheetRaw.columns = [
    { header: 'Time', key: 't', width: 25 },
    { header: 'HR', key: 'hr', width: 10 },
    { header: 'RR', key: 'rr', width: 10 }
  ];

  rawData.forEach(d => {
    sheetRaw.addRow({
      t: new Date(d.timestamp).toISOString(),
      hr: d.hr,
      rr: d.rr
    });
  });

  const outPath = path.resolve(process.cwd(), 'persistent_episode.xlsx');
  await workbook.xlsx.writeFile(outPath);
  console.log(`Saved to ${outPath}`);

  await mongoose.disconnect();
}

run().catch(console.error);
