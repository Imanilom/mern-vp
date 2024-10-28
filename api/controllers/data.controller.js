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
export async function filterIQ(logs, multiplier = 1.5, lambda = 1) {
  const filteredLogs = [];
  const rawFilteredLogs = [];
  const anomalies = [];

  // Group logs by 10-second intervals
  const groupedLogs = [];
  let currentGroup = [];
  let startTime = new Date(logs[0].timestamp).getTime();

  logs.forEach(log => {
    const logTime = new Date(log.timestamp).getTime();
    if (logTime - startTime < 10000) {
      currentGroup.push(log);
    } else {
      groupedLogs.push(currentGroup);
      currentGroup = [log];
      startTime = logTime;
    }
  });
  if (currentGroup.length > 0) groupedLogs.push(currentGroup);

  // Process each group
  groupedLogs.forEach(group => {
    const hrValues = group.map(log => log.HR);
    const rrValues = group.map(log => log.RR);

    const hrStats = calculateQuartilesAndIQR(hrValues);
    const rrStats = calculateQuartilesAndIQR(rrValues);

    console.log("HR Stats:", hrStats);
    console.log("RR Stats:", rrStats);

    const filteredHr = hrValues.filter(value =>
      value >= hrStats.Q1 - multiplier * hrStats.IQR &&
      value <= hrStats.Q3 + multiplier * hrStats.IQR
    );

    const filteredRr = rrValues.filter(value =>
      value >= rrStats.Q1 - multiplier * rrStats.IQR &&
      value <= rrStats.Q3 + multiplier * rrStats.IQR
    );

    // Create and train One-Class SVM
    const svm = new OneClassSVM();
    const trainingData = group.map(log => ({ HR: log.HR, RR: log.RR }));
    svm.fit(trainingData);

    // Detect anomalies using One-Class SVM
    const predictions = svm.predict(trainingData);
    const hrAnomalies = [];
    const rrAnomalies = [];

    trainingData.forEach((point, index) => {
      if (predictions[index] === -1) {
        hrAnomalies.push(point.HR);
        rrAnomalies.push(point.RR);
      }
    });

    if (hrAnomalies.length > 0 || rrAnomalies.length > 0) {
      anomalies.push({
        timestamp: group[0].timestamp,
        hrAnomalies,
        rrAnomalies,
      });
    }

    if (filteredHr.length > 0 && filteredRr.length > 0) {
      for (let i = 0; i < Math.min(filteredHr.length, filteredRr.length); i++) {
        const filteredLog = { HR: filteredHr[i], RR: filteredRr[i], timestamp: group[i].timestamp };
        filteredLogs.push(filteredLog);
        rawFilteredLogs.push(group[i]);
      }
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
    // Prediksi anomali (sederhana; tidak ada logika nyata di sini)
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
    const firstLog = await Log.findOne({ isChecked: false }).sort({ create_at: 1 });

    if (!firstLog) {
      console.log('No data to process.');
      return;
    }

    const oldestTimestamp = new Date(firstLog.create_at);
    const tenMinutesLater = new Date(oldestTimestamp.getTime() + 10 * 60 * 1000);

    const logs = await Log.find({
      isChecked: false,
      create_at: { $gte: oldestTimestamp, $lte: tenMinutesLater }
    }).sort({ create_at: 1 });

    if (logs.length === 0) {
      console.log('No data to process.');
      return;
    }

    // Get filtered logs and anomalies
    const { filteredLogs, anomalies } = await filterIQ(logs);

    if (filteredLogs.length === 0) {
      console.log('No valid data after filtering.');
      const logIds = logs.map(log => log._id);
      await Log.updateMany({ _id: { $in: logIds } }, { $set: { isChecked: true } })
      return;
    }

    // Calculate metrics for the day
    const allRRIntervals = filteredLogs.map(log => log.RR);
    const hrvMetrics = calculateAdvancedMetrics(allRRIntervals);
    const formattedTimestamp = formatTimestamp(oldestTimestamp);
    const resultsDir = path.join(__dirname, 'hrv-results');
    
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    // Create or update JSON file for filtered logs
    const dateString = oldestTimestamp.toISOString().split('T')[0];
    const fileName = path.join(resultsDir, `filtered_logs_${dateString}.json`);
    const anomalyFileName = path.join(resultsDir, `anomalies_${dateString}.json`);

    let jsonData = { metrics: {}, filteredLogs: [] };
    let anomalyData = [];

    // Check if the filtered logs file already exists
    if (fs.existsSync(fileName)) {
      const existingData = fs.readFileSync(fileName);
      jsonData = JSON.parse(existingData);
    }

    // Update the metrics
    jsonData.metrics = hrvMetrics;
    jsonData.filteredLogs = jsonData.filteredLogs.concat(
      filteredLogs.map(log => ({
        timestamp: log.timestamp,
        HR: log.HR,
        RR: log.RR
      }))
    );

    fs.writeFileSync(fileName, JSON.stringify(jsonData, null, 2));
    console.log('Updated filtered logs successfully...');

    // Handle anomalies
    if (anomalies.length > 0) {
      if (fs.existsSync(anomalyFileName)) {
        const existingAnomalies = fs.readFileSync(anomalyFileName);
        anomalyData = JSON.parse(existingAnomalies);
      }
      anomalyData = anomalyData.concat(anomalies);
      fs.writeFileSync(anomalyFileName, JSON.stringify(anomalyData, null, 2));
      console.log('Updated anomalies successfully...');
    }

    // Update the `isChecked` status of the processed logs to true
    const logIds = logs.map(log => log._id);
    await Log.updateMany({ _id: { $in: logIds } }, { $set: { isChecked: true } });
  } catch (error) {
    console.error('Error processing heart rate data:', error);
  }
};

// Cron job scheduled every 10 minutes
cron.schedule('*/10 * * * *', () => {
  // console.log('Running heart rate data processing every 10 minutes...');
  // processHeartRateData();
  fillMissingRRForLogsWithHR();
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