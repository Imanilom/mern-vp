import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGO;

async function testPeakLoss() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const raws = await db.collection('polardatas').find({}).sort({ timestamp: 1 }).limit(36000).toArray();
  console.log(`Loaded ${raws.length} raw telemetry data points.`);

  let detectedSpikesRaw = 0;
  let detectedSpikes1m = 0;
  let detectedSpikes5m = 0;
  let totalAttenuations1m = [];
  let totalAttenuations5m = [];

  // Group by blocks of 300 data points (5 minutes of 1-Hz data)
  for (let i = 0; i <= raws.length - 300; i += 300) {
    const chunk5m = raws.slice(i, i + 300);
    const hrs = chunk5m.map(r => r.hr).filter(v => v > 30 && v < 220);
    if (hrs.length < 240) continue; // quality filter

    const maxRaw = Math.max(...hrs);
    const mean5m = hrs.reduce((s, r) => s + r, 0) / hrs.length;

    // Split into 5 x 1-min windows
    let max1m = 0;
    for (let j = 0; j < 5; j++) {
      const chunk1m = chunk5m.slice(j * 60, (j + 1) * 60).map(r => r.hr).filter(v => v > 30 && v < 220);
      if (chunk1m.length >= 30) {
        const m1 = chunk1m.reduce((s, r) => s + r, 0) / chunk1m.length;
        if (m1 > max1m) max1m = m1;
      }
    }

    if (maxRaw >= 100) {
      detectedSpikesRaw++;
      // A threshold crossing for anomaly at 90 bpm
      if (max1m >= 90) detectedSpikes1m++;
      if (mean5m >= 90) detectedSpikes5m++;

      const att1 = ((maxRaw - max1m) / maxRaw) * 100;
      const att5 = ((maxRaw - mean5m) / maxRaw) * 100;
      totalAttenuations1m.push(att1);
      totalAttenuations5m.push(att5);
    }
  }

  const avgAtt1 = totalAttenuations1m.reduce((a, b) => a + b, 0) / totalAttenuations1m.length;
  const avgAtt5 = totalAttenuations5m.reduce((a, b) => a + b, 0) / totalAttenuations5m.length;

  console.log(JSON.stringify({
    total5MinBlocks: Math.floor(raws.length / 300),
    totalTruePeaksEvaluated: detectedSpikesRaw,
    spikesCaptured_1min: detectedSpikes1m,
    spikesCaptured_5min: detectedSpikes5m,
    peakCaptureRate_1min: `${((detectedSpikes1m / detectedSpikesRaw) * 100).toFixed(1)}%`,
    peakCaptureRate_5min: `${((detectedSpikes5m / detectedSpikesRaw) * 100).toFixed(1)}%`,
    peakMissRate_5min: `${(((detectedSpikesRaw - detectedSpikes5m) / detectedSpikesRaw) * 100).toFixed(1)}%`,
    averagePeakAttenuation_1min: `${avgAtt1.toFixed(1)}% (Ketinggian Peak Terjaga)`,
    averagePeakAttenuation_5min: `${avgAtt5.toFixed(1)}% (Peak Ter-Averaging/Luruh)`,
  }, null, 2));

  process.exit(0);
}

testPeakLoss();
