import cron from "node-cron";
import fs from "fs";
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import 'chartjs-adapter-date-fns';  // Import date adapter
import Log from "../models/log.model.js"; // Import your Log model

import { generateGraph } from "./graph.controller.js";
import { calculateHRVMetrics, calculateQuartilesAndIQR, calculateAdvancedMetrics, fillMissingRRForLogsWithHR} from "./metrics.controller.js";

import { runAllMethods } from './logs.controller.js';
import { calculateMetrics } from "./health.controller.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  return date.toISOString().replace(/[:.]/g, '-'); // Replace ':' and '.' with '-'
};


// Filtering Function (IQR-based) per 10 seconds
async function filterIQ(logs, multiplier = 1.5) {
  console.log('Original Logs:', logs); // Log original logs
  const filteredLogs = [];
  const rawFilteredLogs = [];

  // Group logs by 10-second intervals
  const groupedLogs = [];
  let currentGroup = [];
  let startTime = new Date(logs[0].timestamp).getTime();

  logs.forEach(log => {
    const logTime = new Date(log.timestamp).getTime();
    if (logTime - startTime < 10000) { // 10 seconds in milliseconds
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

// Masukan Q1 nya juga ke array (quartilbawah & quartilatas)
// masukan fungsi jika ada anomali maka masukan ke json namun pisahkan
    // Filter HR values based on IQR
    const filteredHr = hrValues.filter(value =>
      value >= hrStats.Q1 - multiplier * hrStats.IQR &&
      value <= hrStats.Q3 + multiplier * hrStats.IQR
    );

    // Filter RR values based on IQ2
    const filteredRr = rrValues.filter(value =>
      value >= rrStats.Q1 - multiplier * rrStats.IQR &&
      value <= rrStats.Q3 + multiplier * rrStats.IQR
    );

    // If filtered data is available, push all valid results to filteredLogs
    for (let i = 0; i < Math.min(filteredHr.length, filteredRr.length); i++) {
      const filteredLog = { HR: filteredHr[i], RR: filteredRr[i], timestamp: group[i].timestamp };
      filteredLogs.push(filteredLog);
      rawFilteredLogs.push(group[i]); // Save raw data
    }
  });

  console.log('Filtered Logs:', filteredLogs); // Log filtered logs

  // Save raw filtered logs to JSON
  const resultsDir = path.join(__dirname, 'hrv-results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  const formattedTimestamp = formatTimestamp(new Date());
  const fileName = path.join(resultsDir, `filtered_logs_${formattedTimestamp}.json`);

  // Calculate HRV metrics for the filtered RR intervals
  const rrIntervals = filteredLogs.map(log => log.RR);
  const hrvMetrics = calculateHRVMetrics(rrIntervals);

  // Change the format of the JSON data
  const formattedJsonData = rawFilteredLogs.map(log => ({
    timestamp: log.timestamp,
    HR: log.HR,
    RR: log.RR,
    metrics: hrvMetrics // Add HRV metrics
  }));

  // Log the formatted JSON data before saving
  console.log('Formatted JSON Data:', JSON.stringify(formattedJsonData, null, 2));

  // Save the formatted JSON data
  try {
    fs.writeFileSync(fileName, JSON.stringify(formattedJsonData, null, 2));
    console.log(`JSON data saved successfully to ${fileName}`);
  } catch (error) {
    console.error(`Error saving JSON data to ${fileName}:`, error);
  }

  return filteredLogs;
}

// satu json 1 hari aja!!!
const processHeartRateData = async () => {
  try {
    // Fetch the oldest unchecked log to determine the time range
    const firstLog = await Log.findOne({ isChecked: false }).sort({ create_at: 1 });

    if (!firstLog) {
      console.log('No data to process.', 636); // berhenti disini
      return;
    }

    // Calculate the 10-minute range
    const oldestTimestamp = new Date(firstLog.create_at);
    const tenMinutesLater = new Date(oldestTimestamp.getTime() + 10 * 60 * 1000);

    // Fetch logs within the 10-minute range
    const logs = await Log.find({
      isChecked: false,
      create_at: { $gte: oldestTimestamp, $lte: tenMinutesLater }
    }).sort({ create_at: 1 });

    if (logs.length === 0) {
      console.log('No data to process.', 651);
      return;
    }

    // Initialize array to store RR intervals and HR data from filtered logs
    const allRRIntervals = [];
    const allFilteredData = [];

    // Ensure the directory exists, create it if not
    const resultsDir = path.join(__dirname, 'hrv-results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    // Process logs in 10-second intervals
    const filteredLogs = await filterIQ(logs);

    if (filteredLogs.length === 0) {
      console.log('No valid data after filtering.');
      return;
    }

    // Add RR intervals and HR data from filtered logs to arrays
    filteredLogs.forEach(filteredLog => {
      allRRIntervals.push(filteredLog.RR);
      allFilteredData.push({ HR: filteredLog.HR, RR: filteredLog.RR, timestamp: filteredLog.timestamp });
    });

      // Calculate HRV metrics for all filtered RR intervals
      const hrvMetrics = calculateHRVMetrics(allRRIntervals);

    // Format the timestamp for the file name
    const formattedTimestamp = formatTimestamp(oldestTimestamp);
    
    // Save the HRV metrics and filtered data as a JSON file
    const fileName = path.join(resultsDir, `filtered_logs_${formattedTimestamp}.json`);
    const jsonData = allFilteredData.map(log => ({
      ...log, // Include existing log data
      metrics: hrvMetrics // Add HRV metrics
    }));
    console.log('tulis file');
    fs.writeFileSync(fileName, JSON.stringify(jsonData, null, 2));

    await SendFileToFtp(`./api/controllers/hrv-results/filtered_logs_${formattedTimestamp}.json`,'/hrv-results');
    console.log(`Processed and saved data logs from ${oldestTimestamp} to ${tenMinutesLater}.`);
  } catch (error) {
    console.error('Error processing heart rate data:', error);
  }
};

// Cron job scheduled every 10 minutes
cron.schedule('*/10 * * * *', () => {
  console.log('Running heart rate data processing every 10 minutes...');
  processHeartRateData();
});

// Schedule Cron Job to run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('Running cron job fillMissingRRForLogsWithHR....');
  fillMissingRRForLogsWithHR();
  console.log('Running cron job...');

  try {

    await runAllMethods();

    console.log('Running generateGraph for each unique guid_device...');
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
  