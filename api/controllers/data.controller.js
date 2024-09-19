import cron from "node-cron";
import { createCanvas } from "canvas";
import fs from "fs";
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Chart, CategoryScale, LinearScale, TimeScale, LineController, LineElement, PointElement, Tooltip, Legend } from "chart.js";
import 'chartjs-adapter-date-fns';  // Import date adapter
import Log from "../models/log.model.js"; // Import your Log model
import FFT from 'fft.js';
import Segment from '../models/segment.model.js';
import { runAllMethods } from './logs.controller.js';
// Register the components
Chart.register(CategoryScale, LinearScale, TimeScale, LineController, LineElement, PointElement, Tooltip, Legend);

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

    const epsilon = 4;
    const minPoints = 1.5;
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
import Log from '../models/logModel'; // Import model Log
import mongoose from 'mongoose';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';

// Filtering Function (IQR-based)
async function filterIQ(logs, multiplier = 1.5) {
  const filteredLogs = [];
  for (const log of logs) {
    const hrValues = log.HR !== null ? [log.HR] : [];
    const rrValues = log.RR !== null ? [log.RR] : [];

    if (hrValues.length === 0 || rrValues.length === 0) continue;

    const hrStats = calculateQuartilesAndIQR(hrValues);
    const rrStats = calculateQuartilesAndIQR(rrValues);

    const filteredHr = hrValues.filter(value => value >= hrStats.Q1 - multiplier * hrStats.IQR && value <= hrStats.Q3 + multiplier * hrStats.IQR);
    const filteredRr = rrValues.filter(value => value >= rrStats.Q1 - multiplier * rrStats.IQR && value <= rrStats.Q3 + multiplier * rrStats.IQR);

    if (filteredHr.length > 0 && filteredRr.length > 0) {
      filteredLogs.push({ HR: filteredHr[0], RR: filteredRr[0], timestamp: log.timestamp });
    }
  }
  return filteredLogs;
}

// Quartile and IQR calculation helper
const calculateQuartilesAndIQR = (values) => {
  values.sort((a, b) => a - b);
  const Q1 = values[Math.floor((values.length / 4))];
  const Q3 = values[Math.floor((values.length * (3 / 4)))];
  const IQR = Q3 - Q1;
  return { Q1, Q3, IQR };
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

// Calculate other HRV metrics
const calculateHRVMetrics = (rrIntervals) => {
  const pnn50 = calculatePNN50(rrIntervals);
  const dfa = calculateDFA(rrIntervals);
  const minRR = Math.min(...rrIntervals);
  const maxRR = Math.max(...rrIntervals);
  const medianRR = calculateMedian(rrIntervals);
  const rmssd = calculateRMSSD(rrIntervals);
  const sdnn = calculateSDNN(rrIntervals);
  const { hf, lf, lfhratio } = calculateFrequencyDomain(rrIntervals);

  return { pnn50, dfa, minRR, maxRR, medianRR, rmssd, sdnn, hf, lf, lfhratio };
};

// Main process for heart rate data
const processHeartRateData = async () => {
  try {
    // Fetch logs from MongoDB that are unchecked and sort by timestamp (oldest first)
    const logs = await Log.find({ isChecked: false }).sort({ timestamp: 1 });

    if (logs.length === 0) {
      console.log('No data to process.');
      return;
    }

    // Initialize array to store RR intervals and HR data from filtered logs
    const allRRIntervals = [];
    const allFilteredData = [];

    // Process each log
    for (const log of logs) {
      // Filter logs based on IQR
      const filteredLogs = await filterIQ([log]);

      if (filteredLogs.length === 0) {
        console.log(`No valid data after filtering for log with timestamp ${log.timestamp}.`);
        continue;
      }

      // Add RR intervals and HR data from filtered logs to arrays
      filteredLogs.forEach(filteredLog => {
        allRRIntervals.push(filteredLog.RR);
        allFilteredData.push({ HR: filteredLog.HR, RR: filteredLog.RR, timestamp: filteredLog.timestamp });
      });

      // Calculate HRV metrics for all filtered RR intervals
      const hrvMetrics = calculateHRVMetrics(allRRIntervals);

      // Save the HRV metrics and filtered data as a JSON file
      const fileName = path.join('./hrv-results', `log_${log.timestamp}.json`);
      fs.writeFileSync(fileName, JSON.stringify({ hrvMetrics, filteredData: allFilteredData }, null, 2));

      // Mark the log as processed (isChecked: true)
      await Log.updateOne({ _id: log._id }, { $set: { isChecked: true } });

      console.log(`Processed and saved data log with timestamp ${log.timestamp}.`);
    }
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