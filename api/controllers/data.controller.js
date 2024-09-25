import cron from "node-cron";
import { createCanvas } from "canvas";
import fs from "fs";
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Chart, CategoryScale, LinearScale, TimeScale, LineController, LineElement, PointElement, Tooltip, Legend } from "chart.js";
import 'chartjs-adapter-date-fns';  // Import date adapter
import Log from "../models/log.model.js"; // Import your Log model
import pkg from 'fft-js';  // Impor seluruh modul sebagai default

import Segment from '../models/segment.model.js';
import { runAllMethods } from './logs.controller.js';
// Register the components
Chart.register(CategoryScale, LinearScale, TimeScale, LineController, LineElement, PointElement, Tooltip, Legend);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const { fft, util: fftUtil } = pkg;  

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  return date.toISOString().replace(/[:.]/g, '-'); // Replace ':' and '.' with '-'
};

// DBSCAN Implementation (same as before)
const dbscan = (data, epsilon, minPoints) => {
  const clusters = [];
  const visited = new Set();
  const noise = [];

  const distance = (pointA, pointB) => Math.abs(pointA - pointB);

  const regionQuery = (pointIdx, points) => {
    const neighbors = [];
    points.forEach((p, idx) => {
      if (distance(p, points[pointIdx]) <= epsilon) {
        neighbors.push(idx);
      }
    });
    return neighbors;
  };

  const expandCluster = (pointIdx, neighbors, cluster, points, epsilon, minPoints) => {
    cluster.push(pointIdx);
    visited.add(pointIdx);

    for (let i = 0; i < neighbors.length; i++) {
      const neighborIdx = neighbors[i];

      if (!visited.has(neighborIdx)) {
        visited.add(neighborIdx);
        const newNeighbors = regionQuery(neighborIdx, points);
        if (newNeighbors.length >= minPoints) {
          neighbors = neighbors.concat(newNeighbors);
        }
      }

      const alreadyInCluster = clusters.some(c => c.includes(neighborIdx));
      if (!alreadyInCluster) {
        cluster.push(neighborIdx);
      }
    }
  };

  data.forEach((_, idx) => {
    if (visited.has(idx)) return;

    const neighbors = regionQuery(idx, data);
    if (neighbors.length < minPoints) {
      noise.push(idx);
    } else {
      const cluster = [];
      expandCluster(idx, neighbors, cluster, data, epsilon, minPoints);
      clusters.push(cluster);
    }
  });

  return { clusters, noise };
};

// Function to generate graph and save as PNG
const generateGraph = async (guid_device) => {
  try {
    const dataPoints = await Log.find({ guid_device }).sort({ create_at : -1 }).limit(1000);
    if (dataPoints.length === 0) {
      console.log(`No data available for GUID Device: ${guid_device}`);
      return;
    }

    const hrValues = dataPoints.map(point => point.HR);
    const timestamps = dataPoints.map(point => new Date(point.create_at));

    const epsilon = 2.5;
    const minPoints = 4;
    const { clusters, noise } = dbscan(hrValues, epsilon, minPoints);

    console.log(`Clusters for GUID Device ${guid_device}:`, clusters);
    console.log(`Noise for GUID Device ${guid_device}:`, noise);

      // Pair HR values with timestamps and then sort by timestamps
      const pairedData = hrValues.map((hr, index) => ({
        hr,
        timestamp: timestamps[index]
      }));
  
      // Sort the paired data by timestamp (to ensure the order is correct after processing)
      pairedData.sort((a, b) => a.timestamp - b.timestamp);
  
      // Extract the sorted HR and timestamps
      const sortedHrValues = pairedData.map(data => data.hr);
      const sortedTimestamps = pairedData.map(data => data.timestamp);

    // Create a linear graph
    const canvas = createCanvas(800, 400);
    const ctx = canvas.getContext('2d');

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: sortedTimestamps,
        datasets: [{
          label: `Heart Rate Data for GUID Device: ${guid_device}`,
          data: sortedHrValues,
          borderColor: 'rgba(75, 192, 192, 1)',
          fill: false
        }]
      },
      options: {
        scales: {
          x: { 
            type: 'time', // Use the time scale
            time: { unit: 'minute' } 
          },
          y: { 
            beginAtZero: false 
          }
        }
      }
    });

    const dir = './graphs';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    const buffer = canvas.toBuffer('image/png');
    const filename = `./graphs/heart_rate_${guid_device}_${Date.now()}.png`;
    fs.writeFileSync(filename, buffer);
    console.log(`Graph saved successfully for GUID Device ${guid_device} as`, filename);

  } catch (error) {
    console.error(`Error generating graph for GUID Device ${guid_device}:`, error);
  }
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

// Quartile and IQR calculation helper
const calculateQuartilesAndIQR = (values) => {
  // Ensure values is an array and has valid data
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('Invalid input to calculateQuartilesAndIQR: expected non-empty array');
  }

  // Sort values in ascending order
  values.sort((a, b) => a - b);

  // Calculate the quartiles
  const Q1 = calculatePercentile(values, 25);
  const Q3 = calculatePercentile(values, 75);
  const IQR = Q3 - Q1; // Interquartile range

  return { Q1, Q3, IQR };
};

// Helper function to calculate percentiles
const calculatePercentile = (values, percentile) => {
  const index = (percentile / 100) * (values.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return values[lower]; // If exact index, return the value

  const weight = index - lower;
  return values[lower] * (1 - weight) + values[upper] * weight; // Linear interpolation for percentile
};


// DFA Calculation Function
export const calculateDFA = (data, order = 1) => {
  const y = data.map((val, i) => data.slice(0, i+1)
    .reduce((acc, v) => acc + (v - data.reduce((acc, val) => acc + val, 0) / data.length), 0));
  const boxSizes = [...new Set(Array.from({ length: Math.log2(data.length) }, (_, i) => Math.pow(2, i + 1)).filter(val => val <= data.length / 2))];
  const fluctuation = boxSizes.map(boxSize => {
    const reshaped = Array.from({ length: Math.floor(data.length / boxSize) }, (_, i) => y.slice(i * boxSize, (i + 1) * boxSize));
    const localTrends = reshaped.map(segment => {
      const x = Array.from({ length: segment.length }, (_, i) => i);
      const [a, b] = [0, 1].map(deg => segment.reduce((acc, val, i) => acc + Math.pow(x[i], deg) * val, 0) / segment.length);
      return segment.map((val, i) => a * x[i] + b);
    });
    return Math.sqrt(localTrends.flatMap((trend, i) => trend.map((val, j) => Math.pow(val - reshaped[i][j], 2)))
      .reduce((acc, val) => acc + val, 0) / (reshaped.length * reshaped[0].length));
  });
  const [logBoxSizes, logFluctuation] = [boxSizes, fluctuation].map(arr => arr.map(val => Math.log10(val)));
  const alpha = (logFluctuation.reduce((acc, val, i) => acc + (val * logBoxSizes[i]), 0) - 
    (logFluctuation.reduce((acc, val) => acc + val, 0) * logBoxSizes.reduce((acc, val) => acc + val, 0) / logBoxSizes.length)) / 
    (logBoxSizes.reduce((acc, val) => acc + Math.pow(val, 2), 0) - Math.pow(logBoxSizes.reduce((acc, val) => acc + val, 0), 2) / logBoxSizes.length);
  return alpha;
};


// Function to calculate frequency domain features
const calculateFrequencyDomain = (rrIntervals) => {
  if (!Array.isArray(rrIntervals) || rrIntervals.length === 0) {
    throw new Error('Invalid RR intervals array');
  }

  // Step 1: Interpolation (interpolating RR intervals to a regular time grid)
  const fs = 4; // Sampling frequency (4 Hz is common in HRV analysis)
  const interpolatedRR = interpolateRR(rrIntervals, fs);

  // Step 2: FFT
  const phasors = fft(interpolatedRR);
  const frequencies = fftUtil.fftFreq(phasors, fs); // Calculate frequency bins
  const magnitudes = fftUtil.fftMag(phasors); // Get magnitudes

  // Step 3: Calculate power in LF and HF bands
  let lfPower = 0;
  let hfPower = 0;

  for (let i = 0; i < frequencies.length; i++) {
    const freq = frequencies[i];
    const power = magnitudes[i] ** 2;

    // LF band: 0.04 - 0.15 Hz
    if (freq >= 0.04 && freq < 0.15) {
      lfPower += power;
    }

    // HF band: 0.15 - 0.4 Hz
    if (freq >= 0.15 && freq < 0.4) {
      hfPower += power;
    }
  }

  // Step 4: LF/HF Ratio
  const lfhratio = lfPower / hfPower;

  return {
    lf: lfPower,
    hf: hfPower,
    lfhratio: lfhratio,
  };
};

// Helper function to interpolate RR intervals
const interpolateRR = (rrIntervals, fs) => {
  const time = [];
  const interpolatedRR = [];

  // Cumulative time based on RR intervals
  let currentTime = 0;
  for (let i = 0; i < rrIntervals.length; i++) {
    time.push(currentTime);
    currentTime += rrIntervals[i] / 1000; // RR interval in seconds
  }

  // Linear interpolation to resample the RR intervals to a uniform time grid
  const duration = time[time.length - 1];
  const interpolatedTime = [];
  for (let t = 0; t <= duration; t += 1 / fs) {
    interpolatedTime.push(t);
  }

  // Using linear interpolation to get the interpolated RR intervals
  for (let i = 1; i < time.length; i++) {
    const t1 = time[i - 1];
    const t2 = time[i];
    const rr1 = rrIntervals[i - 1];
    const rr2 = rrIntervals[i];

    const slope = (rr2 - rr1) / (t2 - t1);

    for (let t of interpolatedTime) {
      if (t >= t1 && t <= t2) {
        const rrInterpolated = rr1 + slope * (t - t1);
        interpolatedRR.push(rrInterpolated);
      }
    }
  }

  return interpolatedRR;
};

// Calculate other HRV metrics
const calculateHRVMetrics = (rrIntervals) => {
  const nnIntervals = [];
  if (rrIntervals.length < 2) {
    // Not enough data points to calculate metrics
    return { sdnn: null, rmssd: null, pnn50: null, s1: null, s2: null };
  }
  let sumSquaredDiffs = 0; // For RMSSD
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
  const diff1 = rrIntervals.slice(1).map((val, index) => val - rrIntervals[index]);
  const sum1 = rrIntervals.slice(1).map((val, index) => val + rrIntervals[index]);

  const s1 = Math.sqrt(diff1.reduce((sum, val) => sum + Math.pow(val, 2), 0) / diff1.length) / Math.sqrt(2);
  const s2 = Math.sqrt(sum1.reduce((sum, val) => sum + Math.pow(val, 2), 0) / sum1.length) / Math.sqrt(2);

  const dfa = calculateDFA(rrIntervals);
  const minRR = Math.min(...rrIntervals);
  const maxRR = Math.max(...rrIntervals);
  const { hf, lf, lfhratio } = calculateFrequencyDomain(rrIntervals);
  return { pnn50, dfa, minRR, maxRR, rmssd, sdnn, hf, lf, lfhratio, s1, s2};
  
  
};

const processHeartRateData = async () => {
  try {
    // Fetch the oldest unchecked log to determine the time range
    const firstLog = await Log.findOne({ isChecked: false }).sort({ create_at: 1 });

    if (!firstLog) {
      console.log('No data to process.');
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
      console.log('No data to process.');
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
    fs.writeFileSync(fileName, JSON.stringify(jsonData, null, 2));

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
  // generateGraph("C0680226");
  processHeartRateData();
  const fillMissingRRForLogsWithHR = async () => {
    try {
        console.log('Starting to fill missing RR and rrRMS values for logs with HR but no RR...');
        const logsWithHRNoRR = await Log.find({ HR: { $ne: null }, RR: null }).sort({ create_at: 1 }).limit(1000);
        const logsWithHRAndRR = await Log.find({ HR: { $ne: null }, RR: { $ne: null } }).sort({ create_at: 1 }).limit(1000);

        if (!logsWithHRNoRR.length) {
            console.log('No logs found with HR but no RR.');
            return { message: 'No logs found with HR but no RR.', status: 404 };
        }

        console.log(`Found ${logsWithHRNoRR.length} logs with HR but no RR.`);
        console.log(`Found ${logsWithHRAndRR.length} logs with both HR and RR.`);

        let totalUpdated = 0;
        let totalFailed = 0;
        let logsWithHRNoRRIds = [];

        const bulkOps = logsWithHRNoRR.map((log, index) => {
            logsWithHRNoRRIds.push(log._id);
            let nearestRRValue = null;
            let sourceLogId = null;

            for (let i = 1; i < logsWithHRAndRR.length; i++) {
                const prevIndex = index - i;
                const nextIndex = index + i;

                if (prevIndex >= 0 && logsWithHRAndRR[prevIndex].RR !== null) {
                    nearestRRValue = logsWithHRAndRR[prevIndex].RR;
                    sourceLogId = logsWithHRAndRR[prevIndex]._id;
                    break;
                }
                if (nextIndex < logsWithHRAndRR.length && logsWithHRAndRR[nextIndex].RR !== null) {
                    nearestRRValue = logsWithHRAndRR[nextIndex].RR;
                    sourceLogId = logsWithHRAndRR[nextIndex]._id;
                    break;
                }
            }

            if (nearestRRValue !== null) {
                const updatedLog = {
                    ...log.toObject(),
                    RR: nearestRRValue,
                    rrRMS: 0 
                };
                delete updatedLog._id;

                console.log(`Filled missing RR for log at index ${index} (ID: ${log._id}) with value ${nearestRRValue} from log ID: ${sourceLogId}.`);
                console.log(`Set rrRMS to 0 for log at index ${index} (ID: ${log._id}).`);
                return {
                    updateOne: {
                        filter: { _id: log._id },
                        update: { $set: updatedLog }
                    }
                };
            }
            return null;
        }).filter(op => op !== null);

        if (bulkOps.length > 0) {
            const bulkWriteResult = await Log.bulkWrite(bulkOps);
            totalUpdated = bulkWriteResult.modifiedCount;
            totalFailed = bulkOps.length - totalUpdated;
        }

        const remainingLogsWithHRNoRR = await Log.find({ HR: { $ne: null }, RR: null }).sort({ create_at: 1 }).limit(1000);
        const remainingCount = remainingLogsWithHRNoRR.length;

        console.log(`RR and rrRMS values filled successfully. Total updated: ${totalUpdated}, Total failed: ${totalFailed}, Remaining logs with HR but no RR: ${remainingCount}`);
        return { 
            message: 'RR and rrRMS values filled successfully.', 
            totalUpdated, 
            totalFailed, 
            logsWithHRNoRRIds, 
            remainingCount,
            status: 200 
        };
    } catch (error) {
        console.error('Error filling missing RR and rrRMS values:', error);
        return { message: 'Internal server error.', status: 500 };
    }
};