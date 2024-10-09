import cron from "node-cron";
import fs from "fs";
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import 'chartjs-adapter-date-fns';  // Import date adapter
import Log from "../models/log.model.js"; // Import your Log model

import { generateGraph } from "./graph.controller.js";
import { calculateHRVMetrics, calculateQuartilesAndIQR, fillMissingRRForLogsWithHR } from "./metrics.controller.js";

import { runAllMethods } from './logs.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  return date.toISOString().replace(/[:.]/g, '-'); // Replace ':' and '.' with '-'
};

// Function to group data into groups of 3 and calculate the average
const groupDataByThreeAndAverage = (data) => {
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

// Filtering Function (IQR-based) per 10 seconds with anomaly detection and grouping
async function filterIQ(logs, multiplier = 1.5) {
  console.log('Original Logs:', logs);
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

    // Calculate quartiles and IQR for both HR and RR values
    const hrStats = calculateQuartilesAndIQR(hrValues);
    const rrStats = calculateQuartilesAndIQR(rrValues);

    // Add Q1 and Q3 to the array (quartilbawah and quartilatas)
    hrValues.quartilbawah = hrStats.Q1;
    hrValues.quartilatas = hrStats.Q3;

    rrValues.quartilbawah = rrStats.Q1;
    rrValues.quartilatas = rrStats.Q3;

    // Filter HR values based on IQR
    const filteredHr = hrValues.filter(value =>
      value >= hrStats.Q1 - multiplier * hrStats.IQR &&
      value <= hrStats.Q3 + multiplier * hrStats.IQR
    );

    // Filter RR values based on IQR
    const filteredRr = rrValues.filter(value =>
      value >= rrStats.Q1 - multiplier * rrStats.IQR &&
      value <= rrStats.Q3 + multiplier * rrStats.IQR
    );

    // Detect anomalies (values outside the IQR range) and add to a separate JSON
    const hrAnomalies = hrValues.filter(value =>
      value < hrStats.Q1 - multiplier * hrStats.IQR || value > hrStats.Q3 + multiplier * hrStats.IQR
    );
    const rrAnomalies = rrValues.filter(value =>
      value < rrStats.Q1 - multiplier * rrStats.IQR || value > rrStats.Q3 + multiplier * rrStats.IQR
    );

    if (hrAnomalies.length > 0 || rrAnomalies.length > 0) {
      anomalies.push({
        timestamp: group[0].timestamp,
        hrAnomalies,
        rrAnomalies,
      });
    }

    // If filtered data is available, push all valid results to filteredLogs
    for (let i = 0; i < Math.min(filteredHr.length, filteredRr.length); i++) {
      const filteredLog = { HR: filteredHr[i], RR: filteredRr[i], timestamp: group[i].timestamp };
      filteredLogs.push(filteredLog);
      rawFilteredLogs.push(group[i]); // Save raw data
    }
  });

  // Group data into groups of 3 and calculate averages
  const groupedHr = groupDataByThreeAndAverage(filteredLogs.map(log => log.HR));
  const groupedRr = groupDataByThreeAndAverage(filteredLogs.map(log => log.RR));
  // Save raw filtered logs to JSON
  const resultsDir = path.join(__dirname, 'hrv-results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  const formattedTimestamp = formatTimestamp(new Date());
  const fileName = path.join(resultsDir, `filtered_logs_${formattedTimestamp}.json`);
  const anomalyFileName = path.join(resultsDir, `anomalies_${formattedTimestamp}.json`);

  // Calculate HRV metrics for the filtered RR intervals
  const rrIntervals = filteredLogs.map(log => log.RR);
  const hrvMetrics = calculateHRVMetrics(rrIntervals);

  // Change the format of the JSON data
  const formattedJsonData = rawFilteredLogs.map(log => ({
    timestamp: log.create_at,
    HR: log.HR,
    RR: log.RR,
    metrics: hrvMetrics // Add HRV metrics
  }));

  // Add grouped data to the JSON
  const jsonDataWithGroupedAverages = {
    filteredLogs: formattedJsonData,
    groupedAverages: {
      groupedHr,
      groupedRr
    }
  };

  // Save the formatted JSON data
  try {
    fs.writeFileSync(fileName, JSON.stringify(jsonDataWithGroupedAverages, null, 2));
    console.log(`JSON data saved successfully to ${fileName}`);
    
    // Save anomalies to a separate file
    fs.writeFileSync(anomalyFileName, JSON.stringify(anomalies, null, 2));
    console.log(`Anomalies saved successfully to ${anomalyFileName}`);
  } catch (error) {
    console.error(`Error saving JSON data to ${fileName}:`, error);
  }

  return filteredLogs;
}

// Process heart rate data function and update isChecked status
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

    const allRRIntervals = [];
    const allFilteredData = [];

    const resultsDir = path.join(__dirname, 'hrv-results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const filteredLogs = await filterIQ(logs);

    if (filteredLogs.length === 0) {
      // console.log('No valid data after filtering.');
      return;
    }

    filteredLogs.forEach(filteredLog => {
      allRRIntervals.push(filteredLog.RR);
      allFilteredData.push({ HR: filteredLog.HR, RR: filteredLog.RR, timestamp: filteredLog.timestamp });
    });

    const hrvMetrics = calculateHRVMetrics(allRRIntervals);
    const formattedTimestamp = formatTimestamp(oldestTimestamp);

    const fileName = path.join(resultsDir, `filtered_logs_${formattedTimestamp}.json`);
    const jsonData = allFilteredData.map(log => ({
      ...log,
      metrics: hrvMetrics
    }));
    
    console.log('Writing filtered logs to file...');
    fs.writeFileSync(fileName, JSON.stringify(jsonData, null, 2));

    console.log(`Processed and saved data logs from ${oldestTimestamp} to ${tenMinutesLater}.`);

    // Update the `isChecked` status of the processed logs to true
    const logIds = logs.map(log => log._id); // Get the IDs of the processed logs
    await Log.updateMany({ _id: { $in: logIds } }, { $set: { isChecked: true } });
    console.log(`Updated isChecked status for ${logIds.length} logs.`);
  } catch (error) {
    console.error('Error processing heart rate data:', error);
  }
};

// Cron job scheduled every 10 minutes
cron.schedule('*/10 * * * *', () => {
  // console.log('Running heart rate data processing every 10 minutes...');
  processHeartRateData();
});

// Schedule Cron Job to run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  // console.log('Running cron job fillMissingRRForLogsWithHR....');
  fillMissingRRForLogsWithHR();
  // console.log('Running cron job...');

  try {
    await runAllMethods();

    const uniqueGuidDevices = await Log.distinct('guid_device');
    for (const guid_device of uniqueGuidDevices) {
      await generateGraph(guid_device);
    }
    console.log('generateGraph completed for all guid_device.');
  } catch (error) {
    console.error('Error during cron job execution:', error);
  }
});
processHeartRateData();
