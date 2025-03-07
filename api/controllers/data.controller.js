import cron from "node-cron";
import fs from "fs";
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import 'chartjs-adapter-date-fns';  // Import date adapter
import Log from "../models/log.model.js"; // Import your Log model
import User from '../models/user.model.js';
import PolarData from "../models/data.model.js";
import { generateGraph, generateGraphsForAllFolders } from "./graph.controller.js";
import { calculateAdvancedMetrics, calculateQuartilesAndIQR, fillMissingRRForLogsWithHR } from "./metrics.controller.js";

import { runAllMethods } from './logs.controller.js';

import { promisify } from 'util';
import { timeStamp } from "console";
import { magnitude } from "fft-js/src/complex.js";

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

export async function kalmanFilter(sortedLogs, options = {}) {
  const {
    initialErrorRR = 1,
    processNoiseRR = 0.01,
    measurementNoiseRR = 1,
    initialErrorHR = 1,
    processNoiseHR = 0.01,
    measurementNoiseHR = 1,
    debug = false,
  } = options;

  if (!Array.isArray(sortedLogs) || sortedLogs.length === 0) {
    throw new Error("Input logs must be a non-empty array.");
  }

  // Sort logs by timestamp (more precise than date_created + time_created)
  sortedLogs.sort((a, b) => a.timestamp - b.timestamp);

  // Validasi nilai awal
  const isValidValue = (value, min, max) => value >= min && value <= max;

  const validRR = sortedLogs
    .map((log) => log.rr)
    .filter((value) => isValidValue(value, 400, 1000));

  const validHR = sortedLogs
    .map((log) => log.hr)
    .filter((value) => isValidValue(value, 40, 120));

  const initialEstimateRR =
    validRR.length > 0
      ? validRR.reduce((sum, value) => sum + value, 0) / validRR.length
      : 400;

  const initialEstimateHR =
    validHR.length > 0
      ? validHR.reduce((sum, value) => sum + value, 0) / validHR.length
      : 70;

  // Variabel Kalman Filter
  let estimateRR = initialEstimateRR;
  let errorRR = initialErrorRR;

  let estimateHR = initialEstimateHR;
  let errorHR = initialErrorHR;

  const filteredLogs = [];
  const anomalies = [];
  console.log("filteredLogs", filteredLogs);
  // Fungsi untuk mengganti nilai anomali dengan rata-rata tetangga
  const replaceAnomaly = (index, field) => {
    const prev = index > 0 ? sortedLogs[index - 1][field] : sortedLogs[index][field];
    const next = index < sortedLogs.length - 1 ? sortedLogs[index + 1][field] : sortedLogs[index][field];
    return (prev + next) / 2;
  };

  // Proses logs
  sortedLogs.forEach((log, index) => {
    const { rr: measurementRR, hr: measurementHR } = log;

    // Validasi nilai RR dan HR
    if (!isValidValue(measurementRR, 400, 1000) || !isValidValue(measurementHR, 60, 130)) {
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

    // Deteksi anomali berdasarkan threshold
    const isAnomalous = (measurement, estimate, error) => {
      const deviation = Math.abs(measurement - estimate);
      const threshold = 3 * Math.sqrt(error);
      return deviation > threshold;
    };

    const anomalyRR = isAnomalous(measurementRR, estimateRR, errorRR);
    const anomalyHR = isAnomalous(measurementHR, estimateHR, errorHR);

    if (anomalyRR || anomalyHR) {
      anomalies.push({
        ...log,
        reason: `Out of threshold: ${anomalyRR ? "RR" : ""} ${anomalyHR ? "HR" : ""}`,
      });

      // Gantikan nilai anomali dengan rata-rata tetangga
      filteredLogs.push({
        date_created: log.date_created,
        time_created: log.time_created,
        rr: anomalyRR ? parseFloat(replaceAnomaly(index, "rr").toFixed(2)) : parseFloat(estimateRR.toFixed(2)),
        hr: anomalyHR ? parseFloat(replaceAnomaly(index, "hr").toFixed(2)) : parseFloat(estimateHR.toFixed(2)),
        activity: log.activity || "Unknown",
        device_id: log.device_id,
      });
    } else {
      filteredLogs.push({
        date_created: log.date_created,
        time_created: log.time_created,
        rr: parseFloat(estimateRR.toFixed(2)),
        hr: parseFloat(estimateHR.toFixed(2)),
        rrms: log.rrms,
        ecg: log.ecg,
        magnitude: Math.sqrt(log.acc_x ** 2 + log.acc_y ** 2 + log.acc_z ** 2),
        activity: log.activity || "Unknown",
        device_id: log.device_id,
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
  let startTime = logs[0].timestamp;

  logs.forEach(log => {
    const logTime = log.timestamp;
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

    // Deteksi anomali dan ganti dengan rata-rata tetangga kiri dan kanan
    for (let i = 0; i < group.length; i++) {
      const hrValue = hrValues[i];
      const rrValue = rrValues[i];

      // Deteksi anomali HR dan RR
      const hrAnomaly = hrValue < hrStats.Q1 - multiplier * hrStats.IQR || hrValue > hrStats.Q3 + multiplier * hrStats.IQR;
      const rrAnomaly = rrValue < rrStats.Q1 - multiplier * rrStats.IQR || rrValue > rrStats.Q3 + multiplier * rrStats.IQR;

      if (hrAnomaly || rrAnomaly) {
        anomalies.push(group[i]);

        // Mengganti dengan rata-rata tetangga kiri dan kanan jika ada anomali
        const leftIndex = i > 0 ? i - 1 : i;  // Menentukan indeks kiri
        const rightIndex = i < group.length - 1 ? i + 1 : i;  // Menentukan indeks kanan
        const avgHr = (hrValues[leftIndex] + hrValues[rightIndex]) / 2;
        const avgRr = (rrValues[leftIndex] + rrValues[rightIndex]) / 2;

        // Memperbarui nilai yang terdeteksi anomali dengan rata-rata
        group[i].HR = avgHr;
        group[i].RR = avgRr;
      }
    }

    // Menyaring log dengan menggunakan nilai yang telah diganti jika ada anomali
    group.forEach(log => {
      const filteredLog = {
        HR: log.HR,
        RR: log.RR,
        rrRMS: log.rrRMS,
        date_created: log.date_created,
        time_created: log.time_created,
        aktivitas: log.aktivitas,
      };

      filteredLogs.push(filteredLog);
    });
  });

  return { filteredLogs, anomalies };
}


export async function filterIQWithBoxCox(logs, multiplier = 1.5) {
  if (!logs || logs.length === 0) {
    console.error("No logs available for processing.");
    return { filteredLogs: [], anomalies: [] };
  }

  const filteredLogs = [];
  const anomalies = [];

  // Mengelompokkan log berdasarkan interval waktu 10 detik
  const groupedLogs = [];
  let currentGroup = [];
  let startTime = logs[0].timestamp;

  logs.forEach(log => {
    const logTime = log.timestamp;
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
    console.log("grup", { group });
    const hrValues = group.map(log => log.HR).filter(value => value !== undefined && value !== null);
    const rrValues = group.map(log => log.RR).filter(value => value !== undefined && value !== null);

    if (hrValues.length === 0 || rrValues.length === 0) {
      console.warn(`Group ${index} skipped due to invalid data.`);
      return;
    }

    // Transformasi Box-Cox untuk HR dan RR
    const [hrTransformed, hrLambda] = boxcox(hrValues);
    const [rrTransformed, rrLambda] = boxcox(rrValues);

    // Hitung IQR pada data yang telah ditransformasi
    const hrStats = calculateQuartilesAndIQR(hrTransformed);
    const rrStats = calculateQuartilesAndIQR(rrTransformed);

    // Deteksi anomali
    for (let i = 0; i < group.length; i++) {
      const hrValue = hrTransformed[i];
      const rrValue = rrTransformed[i];

      const hrAnomaly =
        hrValue < hrStats.Q1 - multiplier * hrStats.IQR || hrValue > hrStats.Q3 + multiplier * hrStats.IQR;
      const rrAnomaly =
        rrValue < rrStats.Q1 - multiplier * rrStats.IQR || rrValue > rrStats.Q3 + multiplier * rrStats.IQR;

      if (hrAnomaly || rrAnomaly) {
        anomalies.push(group[i]);

        // Ganti nilai anomali dengan rata-rata tetangga kiri dan kanan
        const leftIndex = i > 0 ? i - 1 : i; // Tetangga kiri
        const rightIndex = i < group.length - 1 ? i + 1 : i; // Tetangga kanan
        const avgHr = (hrValues[leftIndex] + hrValues[rightIndex]) / 2;
        const avgRr = (rrValues[leftIndex] + rrValues[rightIndex]) / 2;

        group[i].HR = avgHr;
        group[i].RR = avgRr;
      }
    }

    // Menyaring log yang telah diperbaiki
    group.forEach(log => {
      const filteredLog = {
        HR: log.HR,
        RR: log.RR,
        rrRMS: log.rrRMS,
        date_created: log.date_created,
        time_created: log.time_created,
        aktivitas: log.aktivitas,
      };

      filteredLogs.push(filteredLog);
    });
  });

  return { filteredLogs, anomalies };
}

export async function oneClassSVM(logs, nu = 0.1, kernelParam = 1.0) {
  if (!logs || logs.length === 0) {
    console.error("No logs available for processing.");
    return { filteredLogs: [], anomalies: [] };
  }

  const n = logs.length;
  const alphas = Array(n).fill(0); // Lagrange multipliers
  const threshold = nu * n; // Jumlah support vectors yang diizinkan

  // Ambil data RR dan HR untuk deteksi
  const dataPoints = logs.map(log => [log.RR, log.HR]);

  const kernelMatrix = calculateKernelMatrix(dataPoints, kernelParam);

  // Estimasi alpha dengan Quadratic Programming
  for (let iter = 0; iter < 100; iter++) {
    for (let i = 0; i < n; i++) {
      let gradient = 0;
      for (let j = 0; j < n; j++) {
        gradient += alphas[j] * kernelMatrix[i][j];
      }
      gradient -= 1;

      alphas[i] = Math.min(Math.max(alphas[i] - gradient / (2 * kernelMatrix[i][i]), 0), 1 / n);
    }
  }

  // Hitung fungsi keputusan
  const decisionFunction = logs.map((_, index) => {
    let decision = 0;
    for (let j = 0; j < n; j++) {
      if (alphas[j] > 1e-5) {
        decision += alphas[j] * kernelMatrix[index][j];
      }
    }
    return decision - threshold;
  });

  const filteredLogs = [];
  const anomalies = [];

  logs.forEach((log, i) => {
    if (decisionFunction[i] >= 0) {
      // Jika tidak anomali, langsung tambahkan log ke filteredLogs
      filteredLogs.push({
        HR: log.HR,
        RR: log.RR,
        rrRMS: log.rrRMS,
        ecg: log.ecg,
        magnitude: Math.sqrt(log.acc_x ** 2 + log.acc_y ** 2 + log.acc_z ** 2),
        date_created: log.date_created,
        time_created: log.time_created,
        aktivitas: log.activity || "Unknown",
      });
    } else {
      // Jika anomali, hitung rata-rata tetangga
      anomalies.push(log);

      const leftIndex = i > 0 ? i - 1 : i;
      const rightIndex = i < logs.length - 1 ? i + 1 : i;

      const avgHr = ((logs[leftIndex]?.HR || 0) + (logs[rightIndex]?.HR || 0)) / 2;
      const avgRr = ((logs[leftIndex]?.RR || 0) + (logs[rightIndex]?.RR || 0)) / 2;

      // Ganti nilai anomali dengan rata-rata tetangga
      log.HR = avgHr;
      log.RR = avgRr;

      filteredLogs.push({
        HR: log.HR,
        RR: log.RR,
        rrRMS: log.rrRMS,
        ecg: log.ecg,
        magnitude: Math.sqrt(log.acc_x ** 2 + log.acc_y ** 2 + log.acc_z ** 2),
        date_created: log.date_created,
        time_created: log.time_created,
        aktivitas: log.activity,
      });
    }
  });

  return { filteredLogs, anomalies };
}

function calculateKernelMatrix(dataPoints, kernelParam) {
  const n = dataPoints.length;
  const kernelMatrix = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      kernelMatrix[i][j] = kernelRBF(dataPoints[i], dataPoints[j], kernelParam);
    }
  }

  return kernelMatrix;
}

function kernelRBF(x, y, kernelParam) {
  const squaredDistance = x.reduce((sum, xi, index) => sum + (xi - y[index]) ** 2, 0);
  return Math.exp(-squaredDistance / (2 * kernelParam ** 2));
}




const processHeartRateData = async () => {
  try {
    // Ambil data pertama yang belum diproses
    const firstLog = await PolarData.findOne({ isChecked: false })
      .sort({ date_created: 1, time_created: 1 })
      .lean();

    if (!firstLog) {
      console.log("No data to process.");
      return;
    }

    // Ambil semua log dengan tanggal yang sama
    const logs = await PolarData.find({
      isChecked: false,
      date_created: firstLog.date_created,
    }).sort({ timestamp: 1 });

    // Normalisasi aktivitas & format waktu jika perlu
    logs.forEach((log) => {
      log.aktivitas = log.activity || "Unknown";
    });

    // Sort berdasarkan timestamp
    const sortedLogs = logs.sort((a, b) => a.timestamp - b.timestamp);

    // Fungsi untuk menangani nilai yang hilang atau tidak valid
    const fillMissingValues = (data) => {
      for (let i = 0; i < data.length; i++) {
        if (!data[i] || isNaN(data[i]) || !isFinite(data[i])) {
          const left = data[i - 1] || 0;
          const right = data[i + 1] || 0;
          data[i] = (left + right) / 2;
        }
      }
      return data;
    };

    // Deteksi anomali menggunakan One-Class SVM
    const { filteredLogs, anomalies } = await filterIQ(sortedLogs);
    
    console.log("Filtered Logs:", sortedLogs.length);

    if (filteredLogs.length === 0) {
      console.log("No valid data after filtering.");
      return;
    }

    // Kalkulasi MSE & RMSE untuk metrik harian
    const dailyErrors = calculateErrors(sortedLogs, filteredLogs);
    const dailyMetrics = {
      ...calculateAdvancedMetrics(fillMissingValues(filteredLogs.map((log) => log.rr))),
      mse: dailyErrors.mse,
      rmse: dailyErrors.rmse,
    };

    // Pengelompokan berdasarkan aktivitas
    const groupedByActivity = [];
    let currentGroup = { activity: null, logs: [], timestamps: { start: null, end: null } };

    filteredLogs.forEach((log, index) => {
      if (currentGroup.activity === null || currentGroup.activity !== log.aktivitas) {
        if (currentGroup.logs.length > 0) {
          currentGroup.timestamps.end = `${currentGroup.logs[currentGroup.logs.length - 1].date_created} ${currentGroup.logs[currentGroup.logs.length - 1].time_created}`;
          groupedByActivity.push(currentGroup);
        }
        currentGroup = {
          activity: log.aktivitas,
          logs: [],
          timestamps: { start: `${log.date_created} ${log.time_created}`, end: null },
        };
      }
      currentGroup.logs.push(log);

      if (index === filteredLogs.length - 1) {
        currentGroup.timestamps.end = `${log.date_created} ${log.time_created}`;
        groupedByActivity.push(currentGroup);
      }
    });

    const activityMetrics = {};
    groupedByActivity.forEach((group) => {
      const rawActivityLogs = sortedLogs.filter((log) => log.aktivitas === group.activity);
      const rrIntervals = fillMissingValues(group.logs.map((log) => log.rr));
      const activityErrors = calculateErrors(rawActivityLogs, group.logs);

      activityMetrics[group.activity] = activityMetrics[group.activity] || [];
      activityMetrics[group.activity].push({
        metrics: {
          ...calculateAdvancedMetrics(rrIntervals),
          mse: activityErrors.mse,
          rmse: activityErrors.rmse,
        },
        timestamps: group.timestamps,
      });
    });

    // Simpan hasil ke JSON
    const resultsDir = path.join(__dirname, "hrv-results");
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const formattedDate = firstLog.date_created.replace(/-/g, "_");
    const filteredFileName = path.join(resultsDir, `${formattedDate}.json`);
    let jsonData = { dailyMetrics: {}, activityMetrics: {}, filteredLogs: [] };

    if (fs.existsSync(filteredFileName)) {
      const existingData = fs.readFileSync(filteredFileName);
      jsonData = JSON.parse(existingData);
    }

    jsonData.dailyMetrics = dailyMetrics;
    jsonData.activityMetrics = activityMetrics;
    jsonData.filteredLogs = jsonData.filteredLogs.concat(
      filteredLogs.map((log) => ({
        date_created: log.date_created,
        time_created: log.time_created,
        HR: log.hr,
        RR: log.rr,
        RRms: log.rrms,
        ecg: log.ecg,
        magnitude: log.magnitude,
        aktivitas: log.activity || "Unknown",
        device_id: log.device_id,
      }))
    );

    fs.writeFileSync(filteredFileName, JSON.stringify(jsonData, null, 2));
    console.log(`Data written to ${filteredFileName}`);

    // Tandai data sebagai sudah diproses
    await PolarData.updateMany(
      { _id: { $in: logs.map((log) => log._id) } },
      { $set: { isChecked: false } }
    );

  } catch (error) {
    console.error("Error processing heart rate data:", error);
  }
};


// calculate error
function calculateErrors(actual, predicted) {
  // Pastikan actual dan predicted adalah array
  if (!Array.isArray(actual) || !Array.isArray(predicted)) {
    throw new Error("Input data harus berupa array.");
  }

  // Fungsi untuk format tanggal dari DD/MM/YYYY ke format ISO (YYYY-MM-DD)
  function formatDate(date) {
    const [day, month, year] = date.split("/").map(Number);
    if (!day || !month || !year) {
      throw new Error(`Format tanggal tidak valid: ${date}`);
    }
    return new Date(year, month - 1, day).toISOString().split("T")[0]; // yyyy-mm-dd
  }

  // Filter `actual` agar hanya berisi data yang ada di `predicted`
  const filteredActual = actual.filter((act) => {
    try {
      const formattedDate = formatDate(act.date_created);
      return predicted.some(
        (pred) =>
          formatDate(pred.date_created) === formattedDate &&
          pred.time_created === act.time_created
      );
    } catch (error) {
      console.error(error.message);
      return false;
    }
  });

  // Jika panjangnya tidak sama, potong actual agar sama panjang dengan predicted
  if (filteredActual.length !== predicted.length) {
    console.warn(
      `Panjang 'actual' (${filteredActual.length}) dan 'predicted' (${predicted.length}) berbeda. Memotong data 'actual'...`
    );
    filteredActual.length = Math.min(filteredActual.length, predicted.length);
  }

  // Pastikan data tidak kosong setelah pemotongan
  if (filteredActual.length === 0 || predicted.length === 0) {
    throw new Error("Data 'actual' atau 'predicted' kosong setelah pemotongan.");
  }

  const n = filteredActual.length;
  let sumSquaredErrors = 0;

  // Hitung squared errors
  filteredActual.forEach((value) => {
    // Temukan prediksi yang cocok berdasarkan date_created dan time_created
    const matchedPredicted = predicted.find(
      (pred) =>
        formatDate(pred.date_created) === formatDate(value.date_created) &&
        pred.time_created === value.time_created
    );

    // Pastikan ada prediksi yang cocok
    if (!matchedPredicted) {
      throw new Error(
        `Tidak ditemukan prediksi yang cocok untuk data actual dengan date_created: ${value.date_created} dan time_created: ${value.time_created}`
      );
    }

    // Hitung error antara actual dan predicted
    const error = value.RR - matchedPredicted.RR;
    const squaredError = error ** 2;
    sumSquaredErrors += squaredError;
  });

  const mse = sumSquaredErrors / n;
  const rmse = Math.sqrt(mse);

  return { mse, rmse };
}




processHeartRateData()

/**
 * Melakukan transformasi Box-Cox pada array data.
 * @param {number[]} data - Array data yang akan ditransformasi.
 * @param {number} lambda - Parameter lambda untuk transformasi Box-Cox.
 * @returns {[number[], number]} - Array data yang ditransformasi dan nilai lambda.
 */
function boxcox(data, lambda = null) {
  if (!Array.isArray(data) || data.some(value => value <= 0)) {
    throw new Error("Data harus berupa array angka positif.");
  }

  // Jika lambda tidak diberikan, hitung lambda optimal menggunakan log-likelihood.
  if (lambda === null) {
    lambda = calculateOptimalLambda(data);
  }

  const transformedData = data.map(value => {
    if (lambda === 0) {
      return Math.log(value); // Jika lambda = 0, gunakan logaritma.
    } else {
      return (Math.pow(value, lambda) - 1) / lambda;
    }
  });

  return [transformedData, lambda];
}

/**
 * Melakukan inversi transformasi Box-Cox.
 * @param {number[]} transformedData - Array data hasil transformasi Box-Cox.
 * @param {number} lambda - Parameter lambda yang digunakan untuk transformasi.
 * @returns {number[]} - Array data asli setelah inversi transformasi.
 */
function boxcoxInv(transformedData, lambda) {
  return transformedData.map(value => {
    if (lambda === 0) {
      return Math.exp(value); // Jika lambda = 0, gunakan eksponensial.
    } else {
      return Math.pow(lambda * value + 1, 1 / lambda);
    }
  });
}

/**
 * Menghitung lambda optimal untuk transformasi Box-Cox menggunakan log-likelihood.
 * @param {number[]} data - Array data yang akan dihitung.
 * @returns {number} - Nilai lambda optimal.
 */
function calculateOptimalLambda(data) {
  const logLikelihood = (lambda) => {
    const transformed = data.map(value => {
      return lambda === 0 ? Math.log(value) : (Math.pow(value, lambda) - 1) / lambda;
    });
    const logSum = transformed.reduce((sum, value) => sum + Math.log(value), 0);
    return -logSum;
  };

  let bestLambda = 0;
  let bestLikelihood = Number.POSITIVE_INFINITY;

  // Mencoba nilai lambda dalam rentang [-5, 5] dengan langkah kecil.
  for (let lambda = -5; lambda <= 5; lambda += 0.01) {
    const likelihood = logLikelihood(lambda);
    if (likelihood < bestLikelihood) {
      bestLikelihood = likelihood;
      bestLambda = lambda;
    }
  }

  return bestLambda;
}

export { boxcox, boxcoxInv };


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
// cron.schedule('0 0 * * *', async () => {
//   console.log('Running directory creation task at midnight');
//   try {
//     await createHRVDirectory();
//     console.log('HRV Directory structure created successfully');
//   } catch (error) {
//     console.error('Error creating HRV directory:', error);
//   }
// });

// cron job untuk processHRVData
// cron.schedule('*/30 * * * *', async () => {
//   console.log('Running HRV data processing task every 30 minutes');
//   try {
//     const users = await User.find({});
//     for (const user of users) {
//       const devices = await Log.distinct('guid_device', { guid: user.guid });
//       for (const device of devices) {
//         if (device) {
//           await processHRVData(user.guid, device);
//         }
//       }
//     }
//   } catch (error) {
//     console.error('Error in HRV processing:', error);
//   }
// });
// startup folder hrv-results setelah server berjalan
// createHRVDirectory()

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
