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
import { calculateMetrics } from "./health.controller.js";
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

// DFA Calculation Function
export const calculateDFA = (data, order = 1) => {
  const y = data.map((val, i) => data.slice(0, i + 1)
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

function padToPowerOfTwo(arr) {
  const nextPowerOfTwo = Math.pow(2, Math.ceil(Math.log2(arr.length)));
  const paddedArray = new Array(nextPowerOfTwo).fill(0);
  for (let i = 0; i < arr.length; i++) {
    paddedArray[i] = arr[i];
  }
  return paddedArray;
}

export function calculateAdvancedMetrics(rrIntervals) {
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

   // Tambahkan padding agar panjang array menjadi pangkat dua
   const paddedRRIntervals = padToPowerOfTwo(rrIntervals);
   console.log(paddedRRIntervals.length, 'Padded rrIntervals');

  // console.log(rrIntervals.length, 'rrInterval')
  // FFT untuk HF dan LF
  const fft = new FFT(paddedRRIntervals.length);
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

  // --

  // if (!fs.existsSync('./data')) {
  //   fs.mkdir('/data');
  // }

  // function getDateKey(type = 'default') {
  //   const date = new Date();
  //   if(type == 'default'){
  //     const year = date.getFullYear();
  //     const month = String(date.getMonth() + 1).padStart(2, '0');
  //     const day = String(date.getDate()).padStart(2, '0');
  //     return `${year}${month}${day}`;
  //   }

  //   if(type == 'DateWithHour'){
  //     const year = date.getFullYear();
  //     const month = String(date.getMonth() + 1);
  //     const day = String(date.getDate());
  //     const Hour = String(date.getHours());
  //     return `${year}-${month}-${day}T${Hour}`;
  //   }
  // }

  
  // function loadJson(filePath) {
  //   if (fs.existsSync(filePath)) {
  //     const data = fs.readFileSync(filePath);
  //     return JSON.parse(data);
  //   } else {
  //     return {};  // Kembali objek kosong jika file belum ada
  //   }
  // }

  // const data = loadJson(`./data/data_${getDateKey()}.json`);
  // const namefile = `data_${getDateKey()}.json`;
  // // fs.writeFileSync(`./data/data_${getDateKey()}.json`, JSON.stringify(data, null, 2), 'utf8');
  // data[getDateKey('DateWithHour')]

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

    console.log({rrValues, hrValues})

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


// Fungsi helper untuk menghitung Q1, Q3, dan IQR
function calculateQuartilesAndIQR(values) {
  values.sort((a, b) => a - b);
  const midIndex = Math.floor(values.length / 2);

  const Q1 = values[Math.floor(midIndex / 2)];
  const Q3 = values[Math.floor(midIndex + midIndex / 2)];
  const IQR = Q3 - Q1;

  return { Q1, Q3, IQR };
}

// Filtering Function
async function filterIQ(logs, multiplier = 1.5) {
  const filteredLogs = [];
  for (const [interval, logData] of Object.entries(logs)) {
    const hrValues = logData.HR.filter(value => value != null);
    const rrValues = logData.RR.filter(value => value != null);
    const hrStats = calculateQuartilesAndIQR(hrValues);
    const rrStats = calculateQuartilesAndIQR(rrValues);
    const filteredHr = hrValues.filter(value => value >= hrStats.Q1 - multiplier * hrStats.IQR && value <= hrStats.Q3 + multiplier * hrStats.IQR);
    const filteredRr = rrValues.filter(value => value >= rrStats.Q1 - multiplier * rrStats.IQR && value <= rrStats.Q3 + multiplier * rrStats.IQR);
    if (filteredHr.length > 0 && filteredRr.length > 0) {
      filteredLogs.push({ interval, logs: filteredHr.map((hr, index) => ({ HR: hr, RR: filteredRr[index], create_at: new Date(interval) })) });
    }
  }
  return filteredLogs;
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


// Metric Calculation and Saving
const processAndSaveData = async () => {
  try {
    const now = new Date();
    const formattedDate = `${now.getUTCFullYear()}${now.getUTCMonth() + 1}${now.getUTCDate()}`;
    
    const logs = await Log.find().sort({ create_at: -1 }).limit(1000);
    if (!logs.length) {
      console.log('No new logs found in the specified period.');
      return;
    }

    const segmentedLogs = segmentDataByInterval(logs, 'hour');
    const filteredLogs = await filterIQ(segmentedLogs);
    if (!filteredLogs.length) {
      console.log('No logs passed the IQ filter.');
      return;
    }
    const results = await calculateMetricsAfterIQFilter(filteredLogs);

    const rrValues = logs.map((log) => log.RR).filter(value => value != null);
    if (rrValues.length > 0) {
      const dfaAlpha = calculateDFA(rrValues);
      results.DFA = dfaAlpha;
    }

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const outputDir = path.resolve(__dirname, 'data');
    fs.mkdirSync(outputDir, { recursive: true });
    const outputFilePath = path.resolve(outputDir, `metrics_${formattedDate}.json`);
    fs.writeFileSync(outputFilePath, JSON.stringify(results));
    console.log(`Metrics successfully saved to: ${outputFilePath}`);
  } catch (error) {
    console.error('Error during data processing:', error);
  }
};

// Schedule Cron Job to run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
    console.log('Running cron job...');

    try {
        
        await runAllMethods();
        
        console.log('Running processAndSaveData...');
        await processAndSaveData();
        console.log('processAndSaveData completed.');

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
