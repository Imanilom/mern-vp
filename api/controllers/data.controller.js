import cron from "node-cron";
import fs from "fs";
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import 'chartjs-adapter-date-fns';  // Import date adapter
import Log from "../models/log.model.js"; // Import your Log model

import { generateGraph, generateGraphsForAllFolders } from "./graph.controller.js";
import { calculateHRVMetrics, calculateAdvancedMetrics, calculateQuartilesAndIQR, fillMissingRRForLogsWithHR } from "./metrics.controller.js";

import { runAllMethods } from './logs.controller.js';

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


// pilih mau lihat hasil interquartil dulu, interquartil dan apa dll

// Update filterIQ function with anomaly detection
// export async function filterIQ(logs, multiplier = 1.5, lambda = 1) {
//   if (!logs || logs.length === 0) {
//     console.error("No logs available for processing.");
//     return { filteredLogs: [], anomalies: [] };
//   }

//   const filteredLogs = [];
//   const rawFilteredLogs = [];
//   const anomalies = [];

//   const groupedLogs = [];
//   let currentGroup = [];
//   let startTime = new Date(logs[0].time_created).getTime();

//   logs.forEach(log => {
//     const logTime = new Date(log.time_created).getTime();
//     if (logTime - startTime < 10000) {
//       currentGroup.push(log);
//     } else {
//       if (currentGroup.length > 0) groupedLogs.push(currentGroup);
//       currentGroup = [log];
//       startTime = logTime;
//     }
//   });
//   if (currentGroup.length > 0) groupedLogs.push(currentGroup);

//   groupedLogs.forEach((group, index) => {
//     const hrValues = group.map(log => log.HR).filter(value => value !== undefined && value !== null);
//     const rrValues = group.map(log => log.RR).filter(value => value !== undefined && value !== null);

//     if (hrValues.length === 0 || rrValues.length === 0) {
//       console.warn(`Group ${index} skipped due to invalid data.`);
//       return;
//     }

//     const hrStats = calculateQuartilesAndIQR(hrValues);
//     const rrStats = calculateQuartilesAndIQR(rrValues);

//     const filteredHr = hrValues.filter(value =>
//       value >= hrStats.Q1 - multiplier * hrStats.IQR &&
//       value <= hrStats.Q3 + multiplier * hrStats.IQR
//     );

//     const filteredRr = rrValues.filter(value =>
//       value >= rrStats.Q1 - multiplier * rrStats.IQR &&
//       value <= rrStats.Q3 + rrStats.IQR
//     );

//     if (filteredHr.length > 0 && filteredRr.length > 0) {
//       for (let i = 0; i < Math.min(filteredHr.length, filteredRr.length); i++) {
//         filteredLogs.push({ HR: filteredHr[i], RR: filteredRr[i], timestamp: group[i].timestamp });
//         rawFilteredLogs.push(group[i]);
//       }
//     }
//   });

//   return { filteredLogs, anomalies };
// }

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
    if (logTime - startTime < 10000) {
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
    // Latih model (sederhana; tidak ada implementasi nyata di sini)
    this.supportVectors = data; // Simpan data untuk demo
  }

  predict(data) {
    return data.map(point => {
      // Misalkan kita anggap bahwa jika nilai lebih dari threshold, itu anomali
      const threshold = this._calculateThreshold();
      return (point.HR > threshold.HR || point.RR < threshold.RR) ? -1 : 1; // -1 = anomali, 1 = normal
    });
  }

  _calculateThreshold() {
    // Hitung threshold berdasarkan support vectors
    const avgHR = this.supportVectors.reduce((sum, log) => sum + log.HR, 0) / this.supportVectors.length;
    const avgRR = this.supportVectors.reduce((sum, log) => sum + log.RR, 0) / this.supportVectors.length;

    return { HR: avgHR + 10, RR: avgRR - 100 }; // Contoh threshold
  }
}


const processHeartRateData = async () => {
  try {
    const firstLog = await Log.findOne({ isChecked: false }).sort({ date_created: 1, time_created: 1 });

    if (!firstLog) {
      console.log("No data to process.");
      return;
    }

    // Format nama file berdasarkan tanggal
    const [day, month, year] = firstLog.date_created.split("/"); // Pisahkan format DD/MM/YYYY
    const formattedDateString = `${year}-${month}-${day}T${firstLog.time_created}`; // Susun menjadi format ISO

    const oldestTimestamp = new Date(formattedDateString);

    if (isNaN(oldestTimestamp.getTime())) {
      console.error("Invalid date format:", formattedDateString);
      return;
    }

    const formattedDate = `${String(oldestTimestamp.getDate()).padStart(2, "0")}-${String(
      oldestTimestamp.getMonth() + 1
    ).padStart(2, "0")}-${oldestTimestamp.getFullYear()}`;
    

    // Ambil semua log dengan `date_created` yang sama
    const logs = await Log.find({
      isChecked: false,
      date_created: firstLog.date_created,
    }).sort({ time_created: 1 });

    const { filteredLogs, anomalies } = await filterIQ(logs);

    if (filteredLogs.length === 0) {
      console.log("No valid data after filtering.");
      await Log.updateMany({ _id: { $in: logs.map((log) => log._id) } }, { $set: { isChecked: true } });
      return;
    }

    // Calculate metrics
   
    const allHRIntervals = filteredLogs.map((log) => log.HR);
    const hrvMetrics = calculateAdvancedMetrics(allHRIntervals);


    const resultsDir = path.join(__dirname, "hrv-results");
    const anomalyDir = path.join(__dirname, "anomaly-results");

    const filteredFileName = path.join(resultsDir, `${formattedDate}.json`);
    const anomalyFileName = path.join(anomalyDir, `${formattedDate}-anomalies.json`);

    // Buat direktori jika belum ada
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    if (!fs.existsSync(anomalyDir)) {
      fs.mkdirSync(anomalyDir, { recursive: true });
    }

    // Baca dan perbarui file JSON untuk filtered logs
    let jsonData = { metrics: {}, filteredLogs: [] };
    if (fs.existsSync(filteredFileName)) {
      const existingData = fs.readFileSync(filteredFileName);
      jsonData = JSON.parse(existingData);
    }

    jsonData.metrics = hrvMetrics;
    jsonData.filteredLogs = jsonData.filteredLogs.concat(
      filteredLogs.map((log) => ({
        date_created: log.date_created,
        time_created: log.time_created,
        HR: log.HR,
        RR: log.RR,
        rrRMS: log.rrRMS,
        aktivitas: log.aktivitas,
      }))
    );

    fs.writeFileSync(filteredFileName, JSON.stringify(jsonData, null, 2));
    console.log(`Filtered logs written to ${filteredFileName}`);

    // Simpan data anomali ke file JSON terpisah
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

    // Tandai log sebagai telah diproses
    await Log.updateMany({ _id: { $in: logs.map((log) => log._id) } }, { $set: { isChecked: true } });
  } catch (error) {
    console.error("Error processing heart rate data:", error);
  }
};



processHeartRateData()
// Cron job scheduled every 10 minutes
cron.schedule('*/5 * * * *', () => {
  // console.log('Running heart rate data processing every 10 minutes...');
  // processHeartRateData();
  processHeartRateData()
});

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