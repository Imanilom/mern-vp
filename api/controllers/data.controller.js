import fs from "fs";
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Log from "../models/log.model.js";
import User from '../models/user.model.js';
import PolarData from "../models/data.model.js";
import Segment from "../models/segment.model.js";
import { generateGraph, generateGraphsForAllFolders } from "./graph.controller.js";
import { calculateAdvancedMetrics, calculateQuartilesAndIQR } from "./metrics.controller.js";
import { calculateDFA } from "./metrics.controller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ukuran window segmentasi: 3 menit dalam ms
const WINDOW_MS = 3 * 60 * 1000;
// Minimum data point per window agar fitur dianggap valid
const MIN_POINTS_PER_WINDOW = 10;

export const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  return date.toISOString().replace(/[:.]/g, '-');
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

  // Sort logs by timestamp to ensure chronological processing
  sortedLogs.sort((a, b) => a.timestamp - b.timestamp);

  const isValidValue = (value, min, max) => 
    value !== null && value !== undefined && value >= min && value <= max;

  // Initialize estimates with reasonable defaults from valid data
  const validRR = sortedLogs
    .map(log => log.rr)
    .filter(value => isValidValue(value, 300, 1200));
  
  const validHR = sortedLogs
    .map(log => log.hr)
    .filter(value => isValidValue(value, 40, 200));

  let estimateRR = validRR.length > 0 
    ? validRR.reduce((sum, val) => sum + val, 0) / validRR.length 
    : 600; // Default RR interval
  
  let estimateHR = validHR.length > 0 
    ? validHR.reduce((sum, val) => sum + val, 0) / validHR.length 
    : 70; // Default heart rate

  let errorRR = initialErrorRR;
  let errorHR = initialErrorHR;

  const filteredLogs = [];
  const anomalies = [];

  // Helper function to replace anomalous values
  const replaceAnomaly = (index, field, logs) => {
    const fieldRange = {
      'rr': { min: 300, max: 1200 },
      'hr': { min: 40, max: 200 },
      'rrms': { min: 300, max: 1200 }
    };

    let prevValue, nextValue;
    
    // Search backward for valid value
    for (let i = index - 1; i >= 0; i--) {
      const value = logs[i][field];
      if (isValidValue(value, fieldRange[field].min, fieldRange[field].max)) {
        prevValue = value;
        break;
      }
    }
    
    // Search forward for valid value
    for (let i = index + 1; i < logs.length; i++) {
      const value = logs[i][field];
      if (isValidValue(value, fieldRange[field].min, fieldRange[field].max)) {
        nextValue = value;
        break;
      }
    }
    
    // Determine replacement value
    if (prevValue !== undefined && nextValue !== undefined) {
      return (prevValue + nextValue) / 2;
    } else if (prevValue !== undefined) {
      return prevValue;
    } else if (nextValue !== undefined) {
      return nextValue;
    } else {
      // Fallback to current estimate
      return field === 'rr' ? estimateRR : field === 'hr' ? estimateHR : estimateRR;
    }
  };

  // Process each log entry
  sortedLogs.forEach((log, index) => {
    const measurementRR = log.rr;
    const measurementHR = log.hr;
    const measurementRRMS = log.rrms;

    // Validate measurements
    const validRR = isValidValue(measurementRR, 300, 1200);
    const validHR = isValidValue(measurementHR, 40, 200);
    const validRRMS = isValidValue(measurementRRMS, 0, 2000);

    // Handle invalid measurements
    if (!validRR || !validHR) {
      const anomalyReason = [];
      if (!validRR) anomalyReason.push("RR out of range");
      if (!validHR) anomalyReason.push("HR out of range");

      anomalies.push({
        ...log,
        reason: anomalyReason.join(", "),
        originalRR: measurementRR,
        originalHR: measurementHR
      });
      
      // Replace invalid values
      filteredLogs.push({
        ...log,
        rr: validRR ? measurementRR : Math.round(replaceAnomaly(index, 'rr', sortedLogs)),
        hr: validHR ? measurementHR : parseFloat(replaceAnomaly(index, 'hr', sortedLogs).toFixed(1)),
        rrms: validRRMS ? measurementRRMS : Math.round(replaceAnomaly(index, 'rrms', sortedLogs)),
        activity: log.activity || "Unknown",
        isCorrected: true
      });
      return;
    }

    // Kalman Predict Step
    const priorEstimateRR = estimateRR;
    const priorErrorRR = errorRR + processNoiseRR;

    const priorEstimateHR = estimateHR;
    const priorErrorHR = errorHR + processNoiseHR;

    // Anomaly detection based on statistical deviation
    const isAnomalous = (measurement, priorEstimate, priorError, field) => {
      const deviation = Math.abs(measurement - priorEstimate);
      const threshold = field === 'hr' ? 25 : 150; // Different thresholds for HR and RR
      const statisticalThreshold = 3 * Math.sqrt(priorError);
      
      return deviation > threshold || deviation > statisticalThreshold;
    };

    const rrAnomaly = isAnomalous(measurementRR, priorEstimateRR, priorErrorRR, 'rr');
    const hrAnomaly = isAnomalous(measurementHR, priorEstimateHR, priorErrorHR, 'hr');

    if (rrAnomaly || hrAnomaly) {
      const anomalyReason = [];
      if (rrAnomaly) anomalyReason.push("RR anomaly detected");
      if (hrAnomaly) anomalyReason.push("HR anomaly detected");

      anomalies.push({
        ...log,
        reason: anomalyReason.join(", "),
        originalRR: measurementRR,
        originalHR: measurementHR,
        priorEstimateRR,
        priorEstimateHR
      });

      // Replace anomalous values
      filteredLogs.push({
        ...log,
        rr: rrAnomaly ? Math.round(replaceAnomaly(index, 'rr', sortedLogs)) : Math.round(measurementRR),
        hr: hrAnomaly ? parseFloat(replaceAnomaly(index, 'hr', sortedLogs).toFixed(1)) : parseFloat(measurementHR.toFixed(1)),
        rrms: measurementRRMS,
        activity: log.activity || "Unknown",
        isCorrected: true
      });
      return;
    }

    // Kalman Update Step for valid, non-anomalous data
    const kalmanGainRR = priorErrorRR / (priorErrorRR + measurementNoiseRR);
    estimateRR = priorEstimateRR + kalmanGainRR * (measurementRR - priorEstimateRR);
    errorRR = (1 - kalmanGainRR) * priorErrorRR;

    const kalmanGainHR = priorErrorHR / (priorErrorHR + measurementNoiseHR);
    estimateHR = priorEstimateHR + kalmanGainHR * (measurementHR - priorEstimateHR);
    errorHR = (1 - kalmanGainHR) * priorErrorHR;

    // Save filtered values
    filteredLogs.push({
      ...log,
      rr: Math.round(estimateRR),
      hr: parseFloat(estimateHR.toFixed(1)),
      rrms: measurementRRMS,
      activity: log.activity || "Unknown",
      isCorrected: false
    });

    if (debug && index % 100 === 0) {
      console.log(`Processed entry ${index}:`, {
        RR: { measurement: measurementRR, estimate: estimateRR, error: errorRR },
        HR: { measurement: measurementHR, estimate: estimateHR, error: errorHR }
      });
    }
  });

  console.log(`Kalman filtering completed: ${filteredLogs.length} filtered, ${anomalies.length} anomalies`);

  return { 
    filteredLogs, 
    anomalies,
    statistics: {
      totalProcessed: sortedLogs.length,
      anomaliesDetected: anomalies.length,
      anomalyRate: (anomalies.length / sortedLogs.length * 100).toFixed(2)
    }
  };
}

/**
 * filterIQ — Filter outlier HR & RR menggunakan metode IQR global per batch.
 *
 * Pendekatan:
 * - Hitung Q1, Q3, IQR dari seluruh batch (bukan per-detik group)
 * - Data yang keluar dari [Q1 - k*IQR, Q3 + k*IQR] dianggap outlier
 * - Nilai outlier diganti dengan rata-rata tetangga kiri & kanan
 * - Lebih efisien: O(n log n) dari sorting, tidak ada overhead grouping
 *
 * Field input menggunakan lowercase (hr, rr) sesuai PolarData model baru.
 *
 * @param {Array} logs - Array dokumen dari PolarData (.lean())
 * @param {number} multiplier - Pengali IQR (default 1.5)
 * @returns {{ filteredLogs: Array, anomalyCount: number }}
 */
export function filterIQ(logs, multiplier = 1.5) {
  if (!logs || logs.length === 0) {
    return { filteredLogs: [], anomalyCount: 0 };
  }

  // Ekstrak nilai HR dan RR dari seluruh batch
  const hrValues = logs.map(l => l.hr);
  const rrValues = logs.map(l => l.rr);

  // Hitung IQR global
  const hrStats = calculateQuartilesAndIQR([...hrValues].sort((a, b) => a - b));
  const rrStats = calculateQuartilesAndIQR([...rrValues].sort((a, b) => a - b));

  const hrLow  = hrStats.Q1 - multiplier * hrStats.IQR;
  const hrHigh = hrStats.Q3 + multiplier * hrStats.IQR;
  const rrLow  = rrStats.Q1 - multiplier * rrStats.IQR;
  const rrHigh = rrStats.Q3 + multiplier * rrStats.IQR;

  let anomalyCount = 0;

  // Buat salinan agar tidak mutasi array asli
  const filteredLogs = logs.map((log, i) => {
    const hrOutlier = log.hr < hrLow || log.hr > hrHigh;
    const rrOutlier = log.rr < rrLow || log.rr > rrHigh;

    if (!hrOutlier && !rrOutlier) {
      return { ...log };
    }

    anomalyCount++;

    // Cari tetangga kiri & kanan yang valid
    const leftIdx  = i > 0 ? i - 1 : i;
    const rightIdx = i < logs.length - 1 ? i + 1 : i;

    const replacedHr = hrOutlier
      ? (hrValues[leftIdx] + hrValues[rightIdx]) / 2
      : log.hr;
    const replacedRr = rrOutlier
      ? (rrValues[leftIdx] + rrValues[rightIdx]) / 2
      : log.rr;

    return {
      ...log,
      hr: parseFloat(replacedHr.toFixed(1)),
      rr: Math.round(replacedRr),
      _iqrCorrected: true,
    };
  });

  console.log(`[filterIQ] ${anomalyCount} outlier dari ${logs.length} data diperbaiki`);
  return { filteredLogs, anomalyCount };
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
        aktivitas: log.activity,
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

/**
 * processHeartRateData — Layer 2 pipeline utama.
 *
 * Alur:
 *  1. Ambil data yang belum diproses (isChecked: false) per batch user
 *  2. Filter outlier dengan IQR
 *  3. Segmentasi ke window 3 menit
 *  4. Hitung fitur per window (HR stats, HRV, motion, DFA)
 *  5. Simpan Segment ke MongoDB
 *  6. Tandai raw data sebagai isChecked: true
 *
 * Tidak ada I/O file — semua hasil ke DB agar lebih efisien & non-blocking.
 */
export async function processHeartRateData() {
  try {
    console.log('[Pipeline] Memulai pemrosesan data...');

    // Ambil daftar user yang punya data belum diproses
    const pendingUserIds = await PolarData.distinct('user_id', { isChecked: false });

    if (pendingUserIds.length === 0) {
      console.log('[Pipeline] Tidak ada data baru untuk diproses.');
      return { success: true, message: 'Tidak ada data baru' };
    }

    console.log(`[Pipeline] ${pendingUserIds.length} user memiliki data belum diproses`);

    let totalSegmentsCreated = 0;
    let totalRawProcessed = 0;

    // Proses per user agar data terisolasi
    for (const userId of pendingUserIds) {
      try {
        const result = await processUserData(userId);
        totalSegmentsCreated += result.segmentsCreated;
        totalRawProcessed   += result.rawProcessed;
      } catch (userErr) {
        console.error(`[Pipeline] Error untuk user ${userId}:`, userErr.message);
        // Lanjutkan ke user berikutnya meski ada error
      }
    }

    console.log(`[Pipeline] Selesai. ${totalRawProcessed} raw data diproses, ${totalSegmentsCreated} segment dibuat.`);
    return {
      success: true,
      message: 'Pemrosesan selesai',
      totalRawProcessed,
      totalSegmentsCreated,
    };

  } catch (error) {
    console.error('[Pipeline] Error utama:', error.message);
    return { success: false, message: error.message };
  }
}

/**
 * Proses data untuk satu user:
 *  - Ambil semua raw data isChecked: false
 *  - Filter IQR
 *  - Bagi ke window 3 menit
 *  - Hitung fitur & simpan ke Segment
 *  - Mark raw data sebagai processed
 */
async function processUserData(userId) {
  const BATCH_SIZE = 5000;
  let segmentsCreated = 0;
  let rawProcessed = 0;

  // Ambil data batch per batch, sorted by timestamp
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const rawLogs = await PolarData.find({ user_id: userId, isChecked: false })
      .sort({ timestamp: 1 })
      .skip(skip)
      .limit(BATCH_SIZE)
      .lean();

    if (rawLogs.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`[processUserData] user=${userId} | batch offset=${skip} | size=${rawLogs.length}`);

    // ── Step 1: Filter IQR ─────────────────────────────────────────────────
    const { filteredLogs } = filterIQ(rawLogs);

    // ── Step 2: Segmentasi 3-menit ────────────────────────────────────────
    const windows = segmentIntoWindows(filteredLogs);
    console.log(`[processUserData] ${windows.length} window dibentuk dari batch ini`);

    // ── Step 3: Hitung fitur & simpan Segment ────────────────────────────
    const segmentDocs = [];

    for (const win of windows) {
      if (win.logs.length < MIN_POINTS_PER_WINDOW) {
        // Tandai tetap diproses tapi segment tidak valid
        segmentDocs.push(buildSegmentDoc(userId, win, false));
        continue;
      }
      segmentDocs.push(buildSegmentDoc(userId, win, true));
    }

    if (segmentDocs.length > 0) {
      // Upsert agar tidak duplikat jika cron berjalan ulang
      const bulkOps = segmentDocs.map(doc => ({
        updateOne: {
          filter: {
            user_id: doc.user_id,
            device_id: doc.device_id,
            window_start: doc.window_start,
          },
          update: { $set: doc },
          upsert: true,
        },
      }));

      const bulkResult = await Segment.bulkWrite(bulkOps, { ordered: false });
      segmentsCreated += bulkResult.upsertedCount + bulkResult.modifiedCount;
    }

    // ── Step 4: Mark raw data sebagai processed ───────────────────────────
    const processedIds = rawLogs.map(l => l._id);
    await PolarData.updateMany(
      { _id: { $in: processedIds } },
      { $set: { isChecked: true } }
    );
    rawProcessed += processedIds.length;

    // Lanjut ke batch berikutnya
    if (rawLogs.length < BATCH_SIZE) {
      hasMore = false;
    } else {
      skip += BATCH_SIZE;
    }
  }

  return { segmentsCreated, rawProcessed };
}

/**
 * Segmentasi logs ke window 3-menit.
 * Setiap log dikelompokkan berdasarkan: floor(timestamp / WINDOW_MS) * WINDOW_MS
 *
 * @param {Array} logs - Logs yang sudah difilter IQR, sorted by timestamp
 * @returns {Array<{ windowStart, windowEnd, deviceId, activityLabel, logs }>}
 */
function segmentIntoWindows(logs) {
  if (!logs || logs.length === 0) return [];

  const windowMap = new Map();

  for (const log of logs) {
    const windowKey = Math.floor(log.timestamp / WINDOW_MS) * WINDOW_MS;

    if (!windowMap.has(windowKey)) {
      windowMap.set(windowKey, {
        windowStart:   windowKey,
        windowEnd:     windowKey + WINDOW_MS,
        deviceId:      log.device_id || 'UNKNOWN',
        activityLabel: log.activity || 'Unknown',
        logs: [],
      });
    }

    windowMap.get(windowKey).logs.push(log);
  }

  // Tentukan label aktivitas dominan per window (modus)
  for (const win of windowMap.values()) {
    win.activityLabel = getDominantActivity(win.logs);
  }

  return [...windowMap.values()].sort((a, b) => a.windowStart - b.windowStart);
}

/**
 * Hitung modus activity dari log dalam window.
 */
function getDominantActivity(logs) {
  const freq = {};
  for (const log of logs) {
    const act = log.activity || 'Unknown';
    freq[act] = (freq[act] || 0) + 1;
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';
}

/**
 * Bangun dokumen Segment dari window data.
 * Hitung semua fitur Layer 2.
 *
 * @param {string|ObjectId} userId
 * @param {Object} win - window object dari segmentIntoWindows
 * @param {boolean} isValid - false jika data point < minimum
 * @returns {Object} dokumen siap upsert ke Segment
 */
function buildSegmentDoc(userId, win, isValid) {
  const logs = win.logs;
  const hrArr = logs.map(l => l.hr);
  const rrArr = logs.map(l => l.rr);
  const accMags = logs.map(l => {
    const x = l.acc_x || 0;
    const y = l.acc_y || 0;
    const z = l.acc_z || 0;
    return Math.sqrt(x * x + y * y + z * z);
  });
  const stepCounts = logs.map(l => l.step_count || 0);

  // ── HR features ─────────────────────────────────────────────────────────
  const mean_hr = avg(hrArr);
  const std_hr  = stddev(hrArr, mean_hr);
  const delta_hr = Math.max(...hrArr) - Math.min(...hrArr);
  const slope_hr = linearSlope(hrArr); // slope terhadap indeks waktu

  // ── RR / HRV features ────────────────────────────────────────────────────
  const mean_rr = avg(rrArr);
  const sdnn    = stddev(rrArr, mean_rr);
  const rmssd   = calcRmssd(rrArr);
  const rolling_variance = variance(hrArr, mean_hr);

  // ── Motion ───────────────────────────────────────────────────────────────
  const motion_intensity = avg(accMags);
  const step_count = stepCounts.reduce((s, v) => s + v, 0);

  // ── DFA α1 & α2 (short-range: window 4–16, long-range: window 17–32) ───────────
  // Membutuhkan minimal 32 titik RR untuk α2 bermakna.
  // α1 tetap dihitung dari 16 titik ke atas.
  let dfa_alpha1 = null;
  let dfa_alpha2 = null;

  if (rrArr.length >= 16) {
    try {
      // Gunakan maxWindowSize=32 agar alpha2 tersedia
      const dfaResult = calculateDFA(rrArr, 4, Math.min(32, Math.floor(rrArr.length / 2)));
      dfa_alpha1 = dfaResult?.alpha1 ?? null;
      // alpha2 hanya valid jika data cukup (>= 34 titik untuk window >= 17)
      dfa_alpha2 = rrArr.length >= 34 ? (dfaResult?.alpha2 ?? null) : null;
    } catch {
      dfa_alpha1 = null;
      dfa_alpha2 = null;
    }
  }

  return {
    user_id:        userId,
    device_id:      win.deviceId,
    window_start:   win.windowStart,
    window_end:     win.windowEnd,
    activity_label: win.activityLabel,
    raw_count:      logs.length,
    is_valid:       isValid,
    features: {
      mean_hr:          round2(mean_hr),
      std_hr:           round2(std_hr),
      delta_hr:         round2(delta_hr),
      slope_hr:         round4(slope_hr),
      mean_rr:          round2(mean_rr),
      sdnn:             round2(sdnn),
      rmssd:            round2(rmssd),
      rolling_variance: round2(rolling_variance),
      motion_intensity: round2(motion_intensity),
      step_count,
      dfa_alpha1: dfa_alpha1 !== null ? round4(dfa_alpha1) : null,
      dfa_alpha2: dfa_alpha2 !== null ? round4(dfa_alpha2) : null,
    },
  };
}

// ── Math helpers ─────────────────────────────────────────────────────────────

const avg = (arr) => arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;

const variance = (arr, mean) =>
  arr.length < 2 ? 0 : arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (arr.length - 1);

const stddev = (arr, mean) => Math.sqrt(variance(arr, mean));

const calcRmssd = (rrArr) => {
  if (rrArr.length < 2) return 0;
  let sumSq = 0;
  for (let i = 1; i < rrArr.length; i++) {
    sumSq += (rrArr[i] - rrArr[i - 1]) ** 2;
  }
  return Math.sqrt(sumSq / (rrArr.length - 1));
};

/** Slope dari regresi linear sederhana (y ~ indeks waktu) */
const linearSlope = (arr) => {
  const n = arr.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = avg(arr);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (arr[i] - meanY);
    den += (i - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
};

const round2 = (v) => typeof v === 'number' ? parseFloat(v.toFixed(2)) : v;
const round4 = (v) => typeof v === 'number' ? parseFloat(v.toFixed(4)) : v;

// Function untuk memproses segment aktivitas
function processActivitySegments(filteredLogs, jsonData) {
  let currentActivity = null;
  let segmentLogs = [];
  let segmentStartIndex = 0;

  const pushActivitySegment = (endIndex) => {
    if (segmentLogs.length === 0) return;

    const rrValues = segmentLogs
      .map(log => log.rr)
      .filter(rr => rr >= 300 && rr <= 1200);

    // Minimum 10 samples untuk metrics yang meaningful
    if (rrValues.length > 10) {
      const metrics = calculateAdvancedMetrics(rrValues);
      const activity = (currentActivity || "Unknown").toLowerCase();

      if (!jsonData.activityMetrics[activity]) {
        jsonData.activityMetrics[activity] = [];
      }

      const startLog = filteredLogs[segmentStartIndex];
      const endLog = filteredLogs[endIndex - 1];

      const segmentData = {
        metrics: metrics,
        timestamps: {
          start: `${startLog.date_created.split('-').reverse().join('/')} ${startLog.time_created}`,
          end: `${endLog.date_created.split('-').reverse().join('/')} ${endLog.time_created}`
        }
      };

      jsonData.activityMetrics[activity].push(segmentData);
    }
  };

  // Process semua logs untuk segmentasi aktivitas
  for (let i = 0; i < filteredLogs.length; i++) {
    const log = filteredLogs[i];
    
    if (log.activity !== currentActivity) {
      // Push segment sebelumnya
      pushActivitySegment(i);
      
      // Start new segment
      currentActivity = log.activity;
      segmentLogs = [log];
      segmentStartIndex = i;
    } else {
      segmentLogs.push(log);
    }
  }

  // Push segment terakhir
  pushActivitySegment(filteredLogs.length);
}

export async function getProcessingStatus(userId = null) {
  try {
    const filter = userId ? { user_id: userId } : {};
    const filterProcessed   = userId ? { user_id: userId, isChecked: true }  : { isChecked: true };
    const filterUnprocessed = userId ? { user_id: userId, isChecked: false } : { isChecked: false };

    const [totalRecords, processedRecords, unprocessedRecords, totalSegments] = await Promise.all([
      PolarData.countDocuments(filter),
      PolarData.countDocuments(filterProcessed),
      PolarData.countDocuments(filterUnprocessed),
      userId
        ? Segment.countDocuments({ user_id: userId })
        : Segment.countDocuments(),
    ]);

    return {
      totalRecords,
      processedRecords,
      unprocessedRecords,
      totalSegments,
      progress: totalRecords > 0 ? parseFloat((processedRecords / totalRecords * 100).toFixed(2)) : 0,
    };
  } catch (error) {
    console.error('[getProcessingStatus] Error:', error);
    return { error: error.message };
  }
}


// calculate error
function calculateErrors(actual, predicted) {
  // Pastikan actual dan predicted adalah array
  if (!Array.isArray(actual) || !Array.isArray(predicted)) {
    throw new Error("Input data harus berupa array.");
  }


  // Filter `actual` agar hanya berisi data yang ada di `predicted`
  const filteredActual = actual.filter((act) => {
    try {
      const formattedDate = act.date_created;
      return predicted.some(
        (pred) =>
          pred.date_created === formattedDate &&
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
        pred.date_created === value.date_created &&
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
    // 1. Buat direktori utama hrv-results-OC
    const baseDir = path.join(__dirname, 'hrv-results-Kalman');
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
  calculateTriangularIndex,
};

