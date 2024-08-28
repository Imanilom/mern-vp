import cron from 'node-cron';
import Log from '../models/log.model.js';
import Segment from '../models/segment.model.js';
import DailyMetric from '../models/daily.model.js';
import FFT from 'fft.js';

const calculateMetrics = (logs) => {
  const rrIntervals = logs.map((log) => log.RR);
  const nnIntervals = [];
  if (rrIntervals.length < 2) {
    // Not enough data points to calculate metrics
    return { sdnn: null, rmssd: null, pnn50: null, s1: null, s2: null };
  }
  let sumSquaredDiffs = 0; // For SDNN
  let sumSuccessiveDiffs = 0; // For RMSSD
  let nn50Count = 0;

  for (let i = 1; i < rrIntervals.length; i++) {
    const diff = Math.abs(rrIntervals[i] - rrIntervals[i - 1]);
    nnIntervals.push(diff);

    sumSquaredDiffs += diff * diff; // Square the difference and add to sum (for RMSSD)
    if (diff > 50) {
      nn50Count++;
    }
  }

  const avgNN = nnIntervals.reduce((sum, interval) => sum + interval, 0) / nnIntervals.length;

  const squaredDiffsFromMean = nnIntervals.map((interval) => Math.pow(interval - avgNN, 2));
  const sumSquaredDiffsFromMean = squaredDiffsFromMean.reduce((sum, diff) => sum + diff, 0);

  const variance = sumSquaredDiffsFromMean / (nnIntervals.length - 1);
  const sdnn = Math.sqrt(variance);

  const rmssd = Math.sqrt(sumSquaredDiffs / nnIntervals.length);
  const pnn50 = (nn50Count / nnIntervals.length) * 100;

  // Calculate S1 & S2
  const s1 = Math.sqrt(nnIntervals.reduce((sum, interval) => sum + Math.pow(interval - avgNN, 2), 0) / nnIntervals.length);
  const s2 = Math.sqrt(nnIntervals.reduce((sum, interval) => sum + Math.pow(interval + avgNN, 2), 0) / nnIntervals.length);

  // console.log('dfa' , dfa)
  // console.log(logs)
  // results.push({ sdnn, rmssd, pnn50, s1, s2 });
  return { sdnn, rmssd, pnn50, s1, s2 };
};

async function filterIQ(logs, multiplier = 1.5) {
    const filteredLogs = [];
  
    // Loop melalui setiap interval dalam data log
    for (const [interval, logData] of Object.entries(logs)) {
        const hrValues = logData.HR;
        const rrValues = logData.RR;
  
        // Hitung Q1, Q3, dan IQR untuk HR dan RR
        const hrStats = calculateQuartilesAndIQR(hrValues);
        const rrStats = calculateQuartilesAndIQR(rrValues);
  
        // Filter data HR dan RR berdasarkan IQR
        const filteredHr = hrValues.filter(
            (value) =>
                value >= hrStats.Q1 - multiplier * hrStats.IQR &&
                value <= hrStats.Q3 + multiplier * hrStats.IQR
        );
        const filteredRr = rrValues.filter(
            (value) =>
                value >= rrStats.Q1 - multiplier * rrStats.IQR &&
                value <= rrStats.Q3 + multiplier * rrStats.IQR
        );
  
        // Simpan data yang sudah difilter ke dalam array filteredLogs
        if (filteredHr.length > 0 && filteredRr.length > 0) {
            filteredLogs.push({
                interval,
                logs: filteredHr.map((hr, index) => ({
                    HR: hr,
                    RR: filteredRr[index],
                    create_at: new Date(interval),
                })),
            });
        }
    }
  
    return filteredLogs;
}
  
// Fungsi helper untuk menghitung Q1, Q3, dan IQR
function calculateQuartilesAndIQR(values) {
    values.sort((a, b) => a - b);
    const midIndex = Math.floor(values.length / 2);
  
    const Q1 = values[Math.floor(midIndex / 2)];
    const Q3 = values[Math.floor(midIndex + midIndex / 2)];
    const IQR = Q3 - Q1;
  
    return { Q1, Q3, IQR };
}
  
async function calculateMetricsAfterIQFilter(filteredLogs) {
    const results = {};
  
    for (const intervalData of filteredLogs) {
      const { interval, logs } = intervalData;
      const rrValues = logs.map((log) => log.RR);
      const hrValues = logs.map((log) => log.HR);
  
      if (rrValues.length < 2 || hrValues.length < 2) {
        // Filter jika tidak terdapat data yg cukup
        continue;
      }
  
      const hrMetrics = calculateMetrics(hrValues);
      const rrMetrics = calculateMetrics(rrValues); // Pindahkan perhitungan advancedMetrics ke sini
      const advancedMetrics = calculateAdvancedMetrics(rrValues);
  
      results[interval] = {
        HR: hrMetrics,
        RR: {
          ...rrMetrics,
          ...advancedMetrics,
        },
      };
    }
    return results;
  }
  
// Fungsi segmentasi data per interval (misalnya, per jam)
function segmentDataByInterval(logs, intervalType = 'hour') {
    const segmentedData = {};
  
    logs.forEach((log) => {
      const timestamp = new Date(log.create_at);
      let intervalKey;
  
      if (intervalType === 'hour') {
        intervalKey = `${timestamp.getUTCFullYear()}-${
          timestamp.getUTCMonth() + 1
        }-${timestamp.getUTCDate()}T${timestamp.getUTCHours()}`;
      } else if (intervalType === 'day') {
        intervalKey = `${timestamp.getUTCFullYear()}-${
          timestamp.getUTCMonth() + 1
        }-${timestamp.getUTCDate()}`;
      }
  
      if (!segmentedData[intervalKey]) {
        segmentedData[intervalKey] = { HR: [], RR: [] };
      }
  
      segmentedData[intervalKey].HR.push(log.HR);
      segmentedData[intervalKey].RR.push(log.RR);
    });
  
    return segmentedData;
  }

  const processAndSaveData = async () => {
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000); // 5 menit yang lalu
  
      const logs = await Log.find({
        create_at: { $gte: fiveMinutesAgo, $lt: now },
      }).sort({ create_at: 1 });
  
      if (!logs.length) {
        console.log('No new logs found in the last 5 minutes.');
        return;
      }
  
      const segmentedLogs = segmentDataByInterval(logs, 'hour'); 
      const filteredLogs = await filterIQ(segmentedLogs);
  
      if (!filteredLogs.length) {
        console.log('No logs passed the IQ filter.');
        return;
      }
  
      const results = await calculateMetricsAfterIQFilter(filteredLogs);
  
      for (const [interval, metrics] of Object.entries(results)) {
        // Cek apakah sudah ada data untuk interval ini
        const existingSegment = await Segment.findOne({ interval });
  
        if (existingSegment) {
          // Jika sudah ada, update data
          existingSegment.metrics = {
            sdnn: metrics.RR.sdnn,
            rmssd: metrics.RR.rmsdd,
            pnn50: metrics.RR.pnn50,
          };
          existingSegment.logs = filteredLogs.find((log) => log.interval === interval).logs;
          await existingSegment.save();
        } else {
          // Jika belum ada, buat baru
          await Segment.create({
            interval,
            metrics: {
              sdnn: metrics.RR.sdnn,
              rmssd: metrics.RR.rmsdd,
              pnn50: metrics.RR.pnn50,
            },
            logs: filteredLogs.find((log) => log.interval === interval).logs,
          });
        }
        console.log(`Metrics for interval ${interval} saved successfully.`);
      }
    } catch (error) {
      console.error('Error processing and saving data:', error);
    }
  };

// Fungsi untuk menghitung metrik harian dari data RR
function calculateAdvancedMetrics(rrIntervals) {
    if (rrIntervals.length < 2) {
        return null; // Tidak cukup data untuk perhitungan
    }

    const sortedIntervals = rrIntervals.slice().sort((a, b) => a - b); // Salin dan urutkan

    // Median 3dp
    const midIndex = Math.floor(sortedIntervals.length / 2);
    const median =
        sortedIntervals.length % 2 === 0
            ? (sortedIntervals[midIndex - 1] + sortedIntervals[midIndex]) / 2
            : sortedIntervals[midIndex];
    const median3dp = parseFloat(median.toFixed(3)); // Pembulatan ke 3 desimal

    // Mean, Max, Min
    const sum = rrIntervals.reduce((acc, val) => acc + val, 0);
    const mean = sum / rrIntervals.length;
    const max = Math.max(...rrIntervals);
    const min = Math.min(...rrIntervals);

    // RMSSD
    const squaredDiffs = [];
    for (let i = 1; i < rrIntervals.length; i++) {
        const diff = rrIntervals[i] - rrIntervals[i - 1];
        squaredDiffs.push(diff * diff);
    }
    const rmssd = Math.sqrt(
        squaredDiffs.reduce((acc, val) => acc + val, 0) / squaredDiffs.length
    );

    // SDNN (Standard Deviation of NN intervals)
    const avgNN = mean; // Mean RR sama dengan rata-rata interval NN
    const sdnn = Math.sqrt(
        rrIntervals.reduce((acc, val) => acc + Math.pow(val - avgNN, 2), 0) /
            (rrIntervals.length - 1)
    );

    // FFT untuk HF dan LF
    const fft = new FFT(rrIntervals.length);
    const out = fft.createComplexArray();
    fft.realTransform(out, rrIntervals);

    const samplingRate = 1; // Sesuaikan dengan sampling rate yang sebenarnya
    const frequencies = fft.getFrequencyBins(samplingRate);
    const powerSpectrum = out.map((value, index) => {
        return Math.sqrt(value.real * value.real + value.imag * value.imag) /
            rrIntervals.length;
    });

    let hf = 0,
        lf = 0;
    for (let i = 0; i < powerSpectrum.length; i++) {
        if (frequencies[i] >= 0.15 && frequencies[i] <= 0.4) {
            hf += powerSpectrum[i] * powerSpectrum[i];
        } else if (frequencies[i] >= 0.04 && frequencies[i] <= 0.15) {
            lf += powerSpectrum[i] * powerSpectrum[i];
        }
    }

    const lfHfRatio = lf / hf;

    return {
        median3dp,
        mean,
        max,
        min,
        rmssd,
        sdnn,
        hf,
        lf,
        lfHfRatio,
    };
}

// Jadwalkan cron job untuk berjalan setiap 5 menit untuk menghitung metrik
cron.schedule('*/5 * * * *', () => {
    console.log('Cron job started for metrics calculation');
    processAndSaveData();
});

// Tambahkan cron job harian untuk menghitung metrik harian
cron.schedule('0 0 * * *', () => {
    console.log('Cron job started for daily metrics calculation');
    processAndSaveData();
});