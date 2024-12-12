import cron from "node-cron";
import fs from "fs";
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import 'chartjs-adapter-date-fns';  // Import date adapter
import Log from "../models/log.model.js"; // Import your Log model
import User from '../models/user.model.js';

import { generateGraph, generateGraphsForAllFolders } from "./graph.controller.js";
import { calculateHRVMetrics, calculateAdvancedMetrics, calculateQuartilesAndIQR, fillMissingRRForLogsWithHR } from "./metrics.controller.js";

import { runAllMethods } from './logs.controller.js';

import { promisify } from 'util';



const mkdir = promisify(fs.mkdir);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  return date.toISOString().replace(/[:.]/g, '-'); // Replace ':' and '.' with '-'
};

// Function to group data into groups of 3 and calculate the average
export const groupDataByThreeAndAverage = (data) => {
  const groupedData = [];
  for (let i = 0; i < data.length; i += 3) {
    const chunk = data.slice(i, i + 3);
    if (chunk.length === 3) {
      const avg = chunk.reduce((sum, value) => sum + value, 0) / 3;
      groupedData.push(avg);
    }
  }
  return groupedData;
};


// jika buat sesuatu fungsi sertakan visualisasi dan RMSE

export async function kalmanFilter(logs, options = {}) {
  const {
    initialErrorRR = 1,       // Kesalahan awal RR
    processNoiseRR = 0.01,    // Noise proses RR (Q)
    measurementNoiseRR = 1,   // Noise pengukuran RR (R)

    initialErrorHR = 1,       // Kesalahan awal HR
    processNoiseHR = 0.01,    // Noise proses HR (Q)
    measurementNoiseHR = 1,   // Noise pengukuran HR (R),

    debug = false,            // Aktifkan debug
  } = options;

  if (!Array.isArray(logs) || logs.length === 0) {
    throw new Error("Input logs must be a non-empty array.");
  }

  // Validasi dan estimasi awal
  const isValidValue = (value, min, max) => value >= min && value <= max;

  const validRR = logs
    .map((log) => log.RR)
    .filter((value) => isValidValue(value, 400, 1000));

  const validHR = logs
    .map((log) => log.HR)
    .filter((value) => isValidValue(value, 40, 180));

  const initialEstimateRR = validRR.length > 0 
    ? validRR.reduce((sum, value) => sum + value, 0) / validRR.length 
    : 500;

  const initialEstimateHR = validHR.length > 0
    ? validHR.reduce((sum, value) => sum + value, 0) / validHR.length
    : 70;

  // Variabel Kalman Filter
  let estimateRR = initialEstimateRR;
  let errorRR = initialErrorRR;

  let estimateHR = initialEstimateHR;
  let errorHR = initialErrorHR;

  const filteredLogs = [];
  const anomalies = [];

  // Debugging opsional
  if (debug) {
    console.log("Initial Estimate RR:", estimateRR);
    console.log("Initial Estimate HR:", estimateHR);
  }

  // Proses logs dengan Kalman Filter
  logs.forEach((log, index) => {
    const measurementRR = log.RR;
    const measurementHR = log.HR;

    if (
      !isValidValue(measurementRR, 400, 1000) || 
      !isValidValue(measurementHR, 40, 180)
    ) {
      anomalies.push({ ...log, reason: "Invalid measurement range" });
      return;
    }

    // Kalman Gain dan Pembaruan untuk RR
    const kalmanGainRR = errorRR / (errorRR + measurementNoiseRR);
    estimateRR += kalmanGainRR * (measurementRR - estimateRR);
    errorRR = (1 - kalmanGainRR) * errorRR + processNoiseRR;

    // Kalman Gain dan Pembaruan untuk HR
    const kalmanGainHR = errorHR / (errorHR + measurementNoiseHR);
    estimateHR += kalmanGainHR * (measurementHR - estimateHR);
    errorHR = (1 - kalmanGainHR) * errorHR + processNoiseHR;

    // Hitung deviasi dan threshold
    const deviationRR = Math.abs(measurementRR - estimateRR);
    const thresholdRR = 3 * Math.sqrt(errorRR);

    const deviationHR = Math.abs(measurementHR - estimateHR);
    const thresholdHR = 3 * Math.sqrt(errorHR);

    // Pisahkan anomali
    if (deviationRR > thresholdRR || deviationHR > thresholdHR) {
      anomalies.push({ ...log, reason: "Out of threshold" });
    } else {
      filteredLogs.push({
        date_created: log.date_created,
        time_created: log.time_created,
        RR: parseFloat(estimateRR.toFixed(2)),
        HR: parseFloat(estimateHR.toFixed(2)),
        aktivitas: log.aktivitas || log.activity || log.acitivity || "Unknown",
      });
    }

    if (debug) {
      console.log(`Log ${index + 1}:`, {
        measurementRR,
        estimateRR,
        errorRR,
        measurementHR,
        estimateHR,
        errorHR,
      });
    }
  });

  return { filteredLogs, anomalies };
}

export async function filterIQ(logs, multiplier = 1.5) {
  if (!logs || logs.length === 0) {
    console.error("No logs available for processing.");
    return { filteredLogs: [], anomalies: [] };
  }

  const filteredLogs = [];
  const anomalies = [];

  // Mengelompokkan log berdasarkan interval waktu 10 detik
  const groupedLogs = [];
  let currentGroup = [];
  let startTime = new Date(`${logs[0].date_created}T${logs[0].time_created}`).getTime();

  logs.forEach(log => {
    const logTime = new Date(`${log.date_created}T${log.time_created}`).getTime();
    if (logTime - startTime < 1000) {
      currentGroup.push(log);
    } else {
      if (currentGroup.length > 0) groupedLogs.push(currentGroup);
      currentGroup = [log];
      startTime = logTime;
    }
  });

  if (currentGroup.length > 0) groupedLogs.push(currentGroup);

  // Proses setiap grup
  groupedLogs.forEach((group, index) => {
    const hrValues = group.map(log => log.HR).filter(value => value !== undefined && value !== null);
    const rrValues = group.map(log => log.RR).filter(value => value !== undefined && value !== null);

    if (hrValues.length === 0 || rrValues.length === 0) {
      console.warn(`Group ${index} skipped due to invalid data.`);
      return;
    }

    const hrStats = calculateQuartilesAndIQR(hrValues);
    const rrStats = calculateQuartilesAndIQR(rrValues);

    const filteredHr = hrValues.filter(value =>
      value >= hrStats.Q1 - multiplier * hrStats.IQR &&
      value <= hrStats.Q3 + multiplier * hrStats.IQR
    );

    const filteredRr = rrValues.filter(value =>
      value >= rrStats.Q1 - multiplier * rrStats.IQR &&
      value <= rrStats.Q3 + multiplier * rrStats.IQR
    );

    // Memeriksa apakah ada data setelah filtering
    if (filteredHr.length > 0 && filteredRr.length > 0) {
      for (let i = 0; i < Math.min(filteredHr.length, filteredRr.length); i++) {
        const filteredLog = {
          _id: group[i]._id,
          HR: filteredHr[i],
          RR: filteredRr[i],
          rrRMS: group[i].rrRMS,
          date_created: group[i].date_created,
          time_created: group[i].time_created,
          aktivitas: group[i].aktivitas,
        };
        filteredLogs.push(filteredLog);
      }
    }

    // Deteksi anomali
    const anomaliesInGroup = group.filter((log, i) =>
      hrValues[i] < hrStats.Q1 - multiplier * hrStats.IQR ||
      hrValues[i] > hrStats.Q3 + multiplier * hrStats.IQR ||
      rrValues[i] < rrStats.Q1 - multiplier * rrStats.IQR ||
      rrValues[i] > rrStats.Q3 + multiplier * rrStats.IQR
    );
    if (anomaliesInGroup.length > 0) {
      anomalies.push(...anomaliesInGroup);
    }
  });

  return { filteredLogs, anomalies };
}


class OneClassSVM {
  constructor(nu = 0.1) {
    this.nu = nu; // Parameter nu untuk One-Class SVM
    this.supportVectors = [];
  }

  fit(data) {
    this.supportVectors = data; // Simpan data untuk demo
  }

  predict(data) {
    return data.map(point => {
      const threshold = this._calculateThreshold();
      return (point.HR > threshold.HR || point.RR < threshold.RR) ? -1 : 1; // -1 = anomali, 1 = normal
    });
  }

  _calculateThreshold() {
    // Hitung threshold berdasarkan support vectors
    const avgHR = this.supportVectors.reduce((sum, log) => sum + log.HR, 0) / this.supportVectors.length;
    const avgRR = this.supportVectors.reduce((sum, log) => sum + log.RR, 0) / this.supportVectors.length;

    return { HR: avgHR + 10, RR: avgRR - 100 }; 
  }
}

export async function filterIQBC(logs, multiplier = 1.5) {
  if (!logs || logs.length === 0) {
    console.error("No logs available for processing.");
    return { filteredLogs: [], anomalies: [] };
  }

  const filteredLogs = [];
  const anomalies = [];

  // Mengelompokkan log berdasarkan interval waktu 1 detik
  const groupedLogs = [];
  let currentGroup = [];
  let startTime = new Date(`${logs[0].date_created}T${logs[0].time_created}`).getTime();

  logs.forEach((log) => {
    const logTime = new Date(`${log.date_created}T${log.time_created}`).getTime();
    if (logTime - startTime < 1000) {
      currentGroup.push(log);
    } else {
      if (currentGroup.length > 0) groupedLogs.push(currentGroup);
      currentGroup = [log];
      startTime = logTime;
    }
  });

  if (currentGroup.length > 0) groupedLogs.push(currentGroup);

  // Proses setiap grup
  groupedLogs.forEach((group, index) => {
    const hrValues = group.map((log) => log.HR).filter((value) => value !== undefined && value !== null);
    const rrValues = group.map((log) => log.RR).filter((value) => value !== undefined && value !== null);

    if (hrValues.length === 0 || rrValues.length === 0) {
      console.warn(`Group ${index} skipped due to invalid data.`);
      return;
    }

    // Terapkan transformasi Box-Cox ke HR dan RR
    const { transformedData: transformedHr, lambda: lambdaHr } = boxCoxTransform(hrValues);
    const { transformedData: transformedRr, lambda: lambdaRr } = boxCoxTransform(rrValues);

    // Hitung statistik setelah transformasi
    const hrStats = calculateQuartilesAndIQR(transformedHr);
    const rrStats = calculateQuartilesAndIQR(transformedRr);

    const filteredHr = transformedHr.filter(
      (value) => value >= hrStats.Q1 - multiplier * hrStats.IQR && value <= hrStats.Q3 + multiplier * hrStats.IQR
    );

    const filteredRr = transformedRr.filter(
      (value) => value >= rrStats.Q1 - multiplier * rrStats.IQR && value <= rrStats.Q3 + multiplier * rrStats.IQR
    );

    // Transformasi balik ke bentuk asli (invers Box-Cox)
    const inverseTransform = (value, lambda) =>
      lambda === 0 ? Math.exp(value) : Math.pow((value * lambda) + 1, 1 / lambda);

    const restoredHr = filteredHr.map((value) => inverseTransform(value, lambdaHr));
    const restoredRr = filteredRr.map((value) => inverseTransform(value, lambdaRr));

    // Memeriksa apakah ada data setelah filtering
    if (restoredHr.length > 0 && restoredRr.length > 0) {
      for (let i = 0; i < Math.min(restoredHr.length, restoredRr.length); i++) {
        const filteredLog = {
          _id: group[i]._id,
          HR: restoredHr[i],
          RR: restoredRr[i],
          rrRMS: group[i].rrRMS,
          date_created: group[i].date_created,
          time_created: group[i].time_created,
          aktivitas: group[i].aktivitas,
        };
        filteredLogs.push(filteredLog);
      }
    }

    // Deteksi anomali
    const anomaliesInGroup = group.filter(
      (log, i) =>
        transformedHr[i] < hrStats.Q1 - multiplier * hrStats.IQR ||
        transformedHr[i] > hrStats.Q3 + multiplier * hrStats.IQR ||
        transformedRr[i] < rrStats.Q1 - multiplier * rrStats.IQR ||
        transformedRr[i] > rrStats.Q3 + multiplier * rrStats.IQR
    );
    if (anomaliesInGroup.length > 0) {
      anomalies.push(...anomaliesInGroup);
    }
  });

  return { filteredLogs, anomalies };
}



const processHeartRateData = async () => {
  try {
    const firstLog = await Log.findOne({ isChecked: false }).sort({ date_created: 1, time_created: 1 });

    if (!firstLog) {
      console.log("No data to process.");
      return;
    }

    const logs = await Log.find({
      isChecked: false,
      date_created: firstLog.date_created,
    }).sort({ time_created: 1 });

    // Tambahkan validasi pada setiap log
    logs.forEach((log) => {
      if (!log.aktivitas && log.activity) {
        log.aktivitas = log.activity; // Salin nilai dari 'activity' jika 'aktivitas' kosong
      } else if (!log.aktivitas && !log.activity) {
        log.aktivitas = "Unknown"; // Atur nilai default jika keduanya tidak ada
      }
    });

    await Log.updateMany({ _id: { $in: logs.map((log) => log._id) } }, { $set: { isChecked: true } });

    const { filteredLogs, anomalies } = await kalmanFilter(logs);
    
    console.log(filteredLogs)
    if (filteredLogs.length === 0) {
      console.log("No valid data after filtering.");
      return;
    }

    // Kelompokkan data berdasarkan aktivitas
    const groupedByActivity = filteredLogs.reduce((acc, log) => {
      const activity = log.aktivitas || log.activity || log.acitivity || "Unknown"; // Gunakan "Unknown" jika tidak ada
      acc[activity] = acc[activity] || { logs: [], timestamps: { start: null, end: null } };

      acc[activity].logs.push(log);

      // Atur timestamp awal dan akhir
      if (!acc[activity].timestamps.start) {
        acc[activity].timestamps.start = `${log.timestamp || log.date_created + " " + log.time_created}`;
      }
      acc[activity].timestamps.end = `${log.timestamp || log.date_created + " " + log.time_created}`;
    
      return acc;
    }, {});

    // Hitung metrik untuk semua data (satu hari)
    const allRRIntervals = filteredLogs.map((log) => log.RR);
    const dailyMetrics = calculateAdvancedMetrics(allRRIntervals);

    // Hitung metrik untuk setiap aktivitas
    const activityMetrics = {};
    for (const [activity, data] of Object.entries(groupedByActivity)) {
      const rrIntervals = data.logs.map((log) => log.RR);
      activityMetrics[activity] = {
        metrics: calculateAdvancedMetrics(rrIntervals),
        timestamps: data.timestamps, // Tambahkan timestamp awal dan akhir aktivitas
      };
    }

    // Validasi dan format tanggal
    const [day, month, year] = firstLog.date_created.split("/"); // Ubah delimiter menjadi '/' karena JSON contoh menggunakan format DD/MM/YYYY
    if (!day || !month || !year) {
      console.error("Invalid date format:", firstLog.date_created);
      return;
    }
    
    // Format tanggal menjadi YYYY-MM-DD
    const formattedDateString = `${year}-${month}-${day}T${firstLog.time_created}`;
    const oldestTimestamp = new Date(formattedDateString);
    
    if (isNaN(oldestTimestamp.getTime())) {
      console.error("Invalid date after formatting:", formattedDateString);
      return;
    }
    
    const formattedDate = `${String(oldestTimestamp.getDate()).padStart(2, "0")}-${String(
      oldestTimestamp.getMonth() + 1
    ).padStart(2, "0")}-${oldestTimestamp.getFullYear()}`;
    

    const resultsDir = path.join(__dirname, "hrv-results");
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const filteredFileName = path.join(resultsDir, `${formattedDate}.json`);

    // Baca atau buat JSON untuk hari ini
    let jsonData = { dailyMetrics: {}, activityMetrics: {}, filteredLogs: [] };
    if (fs.existsSync(filteredFileName)) {
      const existingData = fs.readFileSync(filteredFileName);
      jsonData = JSON.parse(existingData);
    }

    // Tambahkan metrik harian dan per aktivitas
    jsonData.dailyMetrics = dailyMetrics;
    jsonData.activityMetrics = activityMetrics;

    // Tambahkan log yang difilter
    jsonData.filteredLogs = jsonData.filteredLogs.concat(
      filteredLogs.map((log) => ({
        date_created: log.date_created,
        time_created: log.time_created,
        HR: log.HR,
        RR: log.RR,
        rrRMS: log.rrRMS,
        aktivitas: log.aktivitas || log.activity || log.acitivity || "Unknown",
      }))
    );

    fs.writeFileSync(filteredFileName, JSON.stringify(jsonData, null, 2));
    console.log(`Data written to ${filteredFileName}`);

    // Simpan data anomali
    const anomalyDir = path.join(__dirname, "anomaly-results");
    if (!fs.existsSync(anomalyDir)) {
      fs.mkdirSync(anomalyDir, { recursive: true });
    }

    const anomalyFileName = path.join(anomalyDir, `${formattedDate}-anomalies.json`);
    const anomalyData = anomalies.map((log) => ({
      date_created: log.date_created,
      time_created: log.time_created,
      HR: log.HR,
      RR: log.RR,
      rrRMS: log.rrRMS,
      aktivitas: log.aktivitas || log.activity || log.acitivity || "Unknown",
    }));

    fs.writeFileSync(anomalyFileName, JSON.stringify(anomalyData, null, 2));
    console.log(`Anomalies written to ${anomalyFileName}`);
  } catch (error) {
    console.error("Error processing heart rate data:", error);
  }
};




const processHeartRateData10 = async () => {
  try {
    const firstLog = await Log.findOne({ isChecked: false }).sort({ date_created: 1, time_created: 1 });

    if (!firstLog) {
      console.log("No data to process.");
      return;
    }

    const logs = await Log.find({
      isChecked: false,
      date_created: firstLog.date_created,
    }).sort({ time_created: 1 });

    // Validasi aktivitas
    logs.forEach((log) => {
      if (!log.aktivitas && log.activity) {
        log.aktivitas = log.activity; // Salin nilai dari 'activity' jika 'aktivitas' kosong
      } else if (!log.aktivitas && !log.activity) {
        log.aktivitas = "Unknown"; // Atur nilai default jika keduanya tidak ada
      }
    });

    await Log.updateMany({ _id: { $in: logs.map((log) => log._id) } }, { $set: { isChecked: true } });

    const { filteredLogs, anomalies } = await kalmanFilter(logs);

    if (filteredLogs.length === 0) {
      console.log("No valid data after filtering.");
      return;
    }

   // Membagi data ke dalam segmen 10 menit
    const segmentedLogs = [];
    const intervalMs = 10 * 60 * 1000; // 10 menit dalam milidetik

    // Fungsi untuk parsing manual
    const parseDateTime = (date, time) => {
      const [day, month, year] = date.split("/");
      return new Date(`${year}-${month}-${day}T${time}`);
    };

    let segmentStart = parseDateTime(filteredLogs[0].date_created, filteredLogs[0].time_created).getTime();

    let currentSegment = [];
    filteredLogs.forEach((log) => {
      const logTime = parseDateTime(log.date_created, log.time_created).getTime();

      if (logTime - segmentStart < intervalMs) {
        currentSegment.push(log);
      } else {
        segmentedLogs.push({
          startTime: new Date(segmentStart).toISOString(),
          logs: currentSegment,
        });
        currentSegment = [log];
        segmentStart += intervalMs;
      }
    });

    // Tambahkan segmen terakhir
    if (currentSegment.length > 0) {
      segmentedLogs.push({
        startTime: new Date(segmentStart).toISOString(),
        logs: currentSegment,
      });
}

    // Hitung metrik per segmen
    const metricsPerSegment = segmentedLogs.map((segment) => {
      const rrIntervals = segment.logs.map((log) => log.RR);
      const metrics = calculateAdvancedMetrics(rrIntervals);

      return {
        timestamp: segment.startTime,
        metrics,
        logCount: segment.logs.length,
      };
    });

    // Simpan hasil ke file JSON
    const [day, month, year] = firstLog.date_created.split("/");
    const formattedDateString = `${year}-${month}-${day}`;
    const resultsDir = path.join(__dirname, "hrv-results");
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const filteredFileName = path.join(resultsDir, `${formattedDateString}.json`);

    let jsonData = { metricsBySegment: [] };
    if (fs.existsSync(filteredFileName)) {
      const existingData = fs.readFileSync(filteredFileName);
      jsonData = JSON.parse(existingData);
    }

    jsonData.metricsBySegment = jsonData.metricsBySegment.concat(metricsPerSegment);

    fs.writeFileSync(filteredFileName, JSON.stringify(jsonData, null, 2));
    console.log(`Data written to ${filteredFileName}`);

    // Simpan data anomali
    const anomalyDir = path.join(__dirname, "anomaly-results");
    if (!fs.existsSync(anomalyDir)) {
      fs.mkdirSync(anomalyDir, { recursive: true });
    }

    const anomalyFileName = path.join(anomalyDir, `${formattedDateString}-anomalies.json`);
    const anomalyData = anomalies.map((log) => ({
      date_created: log.date_created,
      time_created: log.time_created,
      HR: log.HR,
      RR: log.RR,
      rrRMS: log.rrRMS,
      aktivitas: log.aktivitas,
    }));

    fs.writeFileSync(anomalyFileName, JSON.stringify(anomalyData, null, 2));
    console.log(`Anomalies written to ${anomalyFileName}`);

  } catch (error) {
    console.error("Error processing heart rate data:", error);
  }
};




const boxCoxTransform = (data) => {
  if (!data || data.length === 0) {
    throw new Error("Data is empty or invalid for Box-Cox transformation.");
  }

  // Fungsi untuk menghitung log likelihood
  const logLikelihood = (lambda, data) => {
    const n = data.length;
    const transformedData = data.map((x) =>
      lambda === 0 ? Math.log(x) : (Math.pow(x, lambda) - 1) / lambda
    );
    const mean = transformedData.reduce((sum, x) => sum + x, 0) / n;
    const variance = transformedData.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / n;

    return -n / 2 * Math.log(variance);
  };

  // Estimasi lambda menggunakan metode grid search
  let bestLambda = 0;
  let maxLogLikelihood = -Infinity;

  for (let lambda = 0; lambda <= 1; lambda += 0.01) {
    const likelihood = logLikelihood(lambda, data);
    if (likelihood > maxLogLikelihood) {
      maxLogLikelihood = likelihood;
      bestLambda = lambda;
    }
  }

  // Terapkan transformasi dengan lambda optimal
  const transformedData = data.map((x) =>
    bestLambda === 0 ? Math.log(x) : (Math.pow(x, bestLambda) - 1) / bestLambda
  );

  return { transformedData, lambda: bestLambda };
};



// Cron job scheduled every 10 minutes
// cron.schedule('*/5 * * * *', () => {
//   // console.log('Running heart rate data processing every 10 minutes...');
//   // processHeartRateData();
//   processHeartRateData()
// });

// Schedule Cron Job to run every 5 minutes
// cron.schedule('*/5 * * * *', async () => {
//   // console.log('Running cron job fillMissingRRForLogsWithHR....');
//   fillMissingRRForLogsWithHR();
//   // console.log('Running cron job...');

//   try {
//     await runAllMethods();

//     // const uniqueGuidDevices = await Log.distinct('guid_device');
//     // for (const guid_device of uniqueGuidDevices) {
//     //   await generateGraph(guid_device);
//     // }
//     // console.log('generateGraph completed for all guid_device.');
//   } catch (error) {
//     console.error('Error during cron job execution:', error);
//   }
// });
// generateGraphsForAllFolders();

// Fungsi untuk membuat struktur direktori HRV
const createHRVDirectory = async () => {
  try {
    // 1. Buat direktori utama hrv-results
    const baseDir = path.join(__dirname, 'hrv-results');
    fs.mkdirSync(baseDir, { recursive: true });

    // 2. Dapatkan semua user
    const users = await User.find({});
    console.log(`Found ${users.length} users:`, users.map(u => u._id));

    for (const user of users) {
      // Buat folder berdasarkan user_id
      const userDir = path.join(baseDir, user._id.toString());
      fs.mkdirSync(userDir, { recursive: true });
      console.log(`Created directory for user: ${user._id}`);

      // 3. Dapatkan semua device untuk user ini
      const devices = await Log.distinct('guid_device', { guid: user.guid });
      console.log(`Found ${devices.length} devices for user ${user._id}:`, devices);
      
      for (const device of devices) {
        if (device) {
          // Buat folder device berdasarkan guid
          const deviceDir = path.join(userDir, device);
          fs.mkdirSync(deviceDir, { recursive: true });
          console.log(`Created directory for device: ${device}`);

          // 4. Dapatkan data per hari untuk device ini
          const logs = await Log.find({ 
            guid: user.guid,
            guid_device: device 
          }).sort({ date_created: 1 });
          console.log(`Found ${logs.length} logs for device ${device}`);

          // Kelompokkan log berdasarkan tanggal
          const logsByDate = {};
          logs.forEach(log => {
            if (log.date_created) {
              if (!logsByDate[log.date_created]) {
                logsByDate[log.date_created] = [];
              }
              logsByDate[log.date_created].push(log);
            }
          });

          // Buat file JSON untuk setiap tanggal
          for (const [date, dailyLogs] of Object.entries(logsByDate)) {
            const fileName = `${date}.json`;
            const dailyData = {
              user_id: user._id,
              guid: user.guid,
              device_id: device,
              date: date,
              data: dailyLogs.map(log => ({
                HR: log.HR,
                RR: log.RR,
                rrRMS: log.rrRMS,
                time_created: log.time_created,
                activity: log.activity
              }))
            };

            fs.writeFileSync(
              path.join(deviceDir, fileName),
              JSON.stringify(dailyData, null, 2)
            );
            console.log(`Created JSON file: ${fileName} for device: ${device}`);
          }
        }
      }
    }

    console.log('Successfully created HRV directory structure');

  } catch (error) {
    console.error('Error creating HRV directory:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  }
};

// Fungsi untuk memproses dan menyimpan data HRV
const processHRVData = async (guid, device) => {
  try {
    // Get logs for this device
    const logs = await Log.find({ 
      guid: guid,
      guid_device: device,
      RR: { $ne: null }, // Pastikan RR tidak null
      HR: { $ne: null }  // Pastikan HR tidak null
    }).sort({ timestamp: 1 });

    if (logs.length === 0) {
      console.log(`No valid logs found for device ${device}`);
      return null;
    }

    // Process the data
    const processedData = {
      rmssd: calculateRMSSD(logs),
      sdnn: calculateSDNN(logs),
      meanHR: calculateMeanHR(logs),
      meanRR: calculateMeanRR(logs),
      pnn50: calculatePNN50(logs),
      sdsd: calculateSDSD(logs),
      triangularIndex: calculateTriangularIndex(logs)
    };

    return {
      guid,
      device,
      date: new Date(),
      metrics: processedData,
      samplesCount: logs.length
    };

  } catch (error) {
    console.error('Error processing HRV data:', error);
    throw error;
  }
};

// Helper functions for HRV calculations
const calculateRMSSD = (logs) => {
  try {
    const rr_intervals = logs.map(log => log.RR);
    let sum_squared_differences = 0;
    let count = 0;

    for (let i = 1; i < rr_intervals.length; i++) {
      const diff = rr_intervals[i] - rr_intervals[i-1];
      sum_squared_differences += diff * diff;
      count++;
    }

    return Math.sqrt(sum_squared_differences / count);
  } catch (error) {
    console.error('Error calculating RMSSD:', error);
    return null;
  }
};

const calculateSDNN = (logs) => {
  try {
    const rr_intervals = logs.map(log => log.RR);
    const mean = rr_intervals.reduce((a, b) => a + b, 0) / rr_intervals.length;
    const squared_differences = rr_intervals.map(rr => Math.pow(rr - mean, 2));
    const variance = squared_differences.reduce((a, b) => a + b, 0) / rr_intervals.length;
    
    return Math.sqrt(variance);
  } catch (error) {
    console.error('Error calculating SDNN:', error);
    return null;
  }
};

const calculateMeanHR = (logs) => {
  try {
    const heartRates = logs.map(log => log.HR);
    return heartRates.reduce((a, b) => a + b, 0) / heartRates.length;
  } catch (error) {
    console.error('Error calculating Mean HR:', error);
    return null;
  }
};

const calculateMeanRR = (logs) => {
  try {
    const rr_intervals = logs.map(log => log.RR);
    return rr_intervals.reduce((a, b) => a + b, 0) / rr_intervals.length;
  } catch (error) {
    console.error('Error calculating Mean RR:', error);
    return null;
  }
};

const calculatePNN50 = (logs) => {
  try {
    const rr_intervals = logs.map(log => log.RR);
    let nn50_count = 0;

    for (let i = 1; i < rr_intervals.length; i++) {
      const diff = Math.abs(rr_intervals[i] - rr_intervals[i-1]);
      if (diff > 50) nn50_count++;
    }

    return (nn50_count / (rr_intervals.length - 1)) * 100;
  } catch (error) {
    console.error('Error calculating pNN50:', error);
    return null;
  }
};

const calculateSDSD = (logs) => {
  try {
    const rr_intervals = logs.map(log => log.RR);
    const differences = [];
    
    for (let i = 1; i < rr_intervals.length; i++) {
      differences.push(rr_intervals[i] - rr_intervals[i-1]);
    }

    const mean = differences.reduce((a, b) => a + b, 0) / differences.length;
    const squared_differences = differences.map(diff => Math.pow(diff - mean, 2));
    const variance = squared_differences.reduce((a, b) => a + b, 0) / differences.length;
    
    return Math.sqrt(variance);
  } catch (error) {
    console.error('Error calculating SDSD:', error);
    return null;
  }
};

const calculateTriangularIndex = (logs) => {
  try {
    const rr_intervals = logs.map(log => log.RR);
    const binWidth = 7.8125; // Standar bin width untuk HRV triangular index
    const histogram = {};
    
    // Create histogram
    rr_intervals.forEach(rr => {
      const bin = Math.floor(rr / binWidth);
      histogram[bin] = (histogram[bin] || 0) + 1;
    });

    // Find maximum bin count
    const maxCount = Math.max(...Object.values(histogram));
    
    // Calculate triangular index
    return rr_intervals.length / maxCount;
  } catch (error) {
    console.error('Error calculating Triangular Index:', error);
    return null;
  }
};

// Export fungsi
export { 
  processHRVData, 
  createHRVDirectory,
  calculateRMSSD,
  calculateSDNN,
  calculateMeanHR,
  calculateMeanRR,
  calculatePNN50,
  calculateSDSD,
  calculateTriangularIndex
};

// cron job untuk createHRVDirectory
cron.schedule('0 0 * * *', async () => {
  console.log('Running directory creation task at midnight');
  try {
    await createHRVDirectory();
    console.log('HRV Directory structure created successfully');
  } catch (error) {
    console.error('Error creating HRV directory:', error);
  }
});

// cron job untuk processHRVData
cron.schedule('*/30 * * * *', async () => {
  console.log('Running HRV data processing task every 30 minutes');
  try {
    const users = await User.find({});
    for (const user of users) {
      const devices = await Log.distinct('guid_device', { guid: user.guid });
      for (const device of devices) {
        if (device) {
          await processHRVData(user.guid, device);
        }
      }
    }
  } catch (error) {
    console.error('Error in HRV processing:', error);
  }
});
// startup folder hrv-results setelah server berjalan
// createHRVDirectory()