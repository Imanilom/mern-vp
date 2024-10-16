
// DBSCAN Implementation
export const dbscan = (data, epsilon, minPoints) => {
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

// Other metric calculation functions
export const calculateHRVMetrics = (rrIntervals) => {
  if (rrIntervals.length < 2) {
    // Not enough data points to calculate metrics
    return { sdnn: null, rmssd: null, pnn50: null, s1: null, s2: null, dfa: null, minRR: null, maxRR: null, hf: null, lf: null, lfhratio: null };
  }

  const nnIntervals = [];
  let sumSquaredDiffs = 0; // For RMSSD
  let nn50Count = 0;

  // Calculate NN intervals and differences
  for (let i = 1; i < rrIntervals.length; i++) {
    const diff = Math.abs(rrIntervals[i] - rrIntervals[i - 1]);
    nnIntervals.push(diff);

    // For RMSSD
    sumSquaredDiffs += Math.pow(diff, 2);
    if (diff > 50) {
      nn50Count++;
    }
  }

  const avgNN = nnIntervals.reduce((sum, interval) => sum + interval, 0) / nnIntervals.length;
  
  // Calculate SDNN
  const squaredDiffsFromMean = nnIntervals.map((interval) => Math.pow(interval - avgNN, 2));
  const sumSquaredDiffsFromMean = squaredDiffsFromMean.reduce((sum, diff) => sum + diff, 0);
  const variance = sumSquaredDiffsFromMean / (nnIntervals.length - 1);
  const sdnn = Math.sqrt(variance);

  // RMSSD calculation
  const rmssd = Math.sqrt(sumSquaredDiffs / (nnIntervals.length - 1));

  // PNN50 calculation
  const pnn50 = (nn50Count / (nnIntervals.length - 1)) * 100; // Number of intervals above 50 ms

  // Calculate S1 and S2
  const diff1 = rrIntervals.slice(1).map((val, index) => val - rrIntervals[index]);
  const sum1 = rrIntervals.slice(1).map((val, index) => val + rrIntervals[index]);

  const s1 = Math.sqrt(diff1.reduce((sum, val) => sum + Math.pow(val, 2), 0) / diff1.length) / Math.sqrt(2);
  const s2 = Math.sqrt(sum1.reduce((sum, val) => sum + Math.pow(val, 2), 0) / sum1.length) / Math.sqrt(2);

  const dfa = calculateDFA(rrIntervals); // Make sure calculateDFA is defined correctly
  const minRR = Math.min(...rrIntervals);
  const maxRR = Math.max(...rrIntervals);
  const { hf, lf, lfhratio } = calculateFrequencyDomain(rrIntervals); // Ensure this function is implemented correctly

  return { pnn50, dfa, minRR, maxRR, rmssd, sdnn, hf, lf, lfhratio, s1, s2 };
};

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

// Additional helper functions
export const calculateQuartilesAndIQR = (values) => {
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
  
  
  export function calculateAdvancedMetrics(rrIntervals) {
    if (rrIntervals.length < 2) {
        return null; // Not enough data for calculation
    }

    const sortedIntervals = rrIntervals.slice().sort((a, b) => a - b); // Copy and sort

    // Median 3dp
    const midIndex = Math.floor(sortedIntervals.length / 2);
    const median =
        sortedIntervals.length % 2 === 0
            ? (sortedIntervals[midIndex - 1] + sortedIntervals[midIndex]) / 2
            : sortedIntervals[midIndex];
    const median3dp = parseFloat(median.toFixed(3)); // Round to 3 decimals

    // Mean, Max, Min
    const sum = rrIntervals.reduce((acc, val) => acc + val, 0);
    const mean = sum / rrIntervals.length;
    const max = Math.max(...rrIntervals);
    const min = Math.min(...rrIntervals);
    const dfa = calculateDFA(rrIntervals); // Make sure calculateDFA is defined correctly
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
    const avgNN = mean; // Mean RR is the same as the average NN interval
    const sdnn = Math.sqrt(
        rrIntervals.reduce((acc, val) => acc + Math.pow(val - avgNN, 2), 0) /
        (rrIntervals.length - 1)
    );

    // Pad to power of two
    const paddedRRIntervals = padToPowerOfTwo(rrIntervals);
    console.log(paddedRRIntervals.length, 'Padded rrIntervals');

    // FFT implementation
    const fftResult = fft(paddedRRIntervals);
    const powerSpectrum = fftResult.map((value) => Math.sqrt(value.real * value.real + value.imag * value.imag) / paddedRRIntervals.length);

    // Frequency bins
    const samplingRate = 1; // Adjust according to actual sampling rate
    const frequencies = Array.from({ length: paddedRRIntervals.length / 2 }, (_, i) => i * (samplingRate / paddedRRIntervals.length));

    let hf = 0, lf = 0;
    for (let i = 0; i < powerSpectrum.length; i++) {
        if (frequencies[i] >= 0.15 && frequencies[i] <= 0.4) {
            hf += powerSpectrum[i] * powerSpectrum[i];
        } else if (frequencies[i] >= 0.04 && frequencies[i] <= 0.15) {
            lf += powerSpectrum[i] * powerSpectrum[i];
        }
    }

    const lfHfRatio = hf === 0 ? 0 : lf / hf; // Avoid division by zero

    return {
        dfa,
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

  export function padToPowerOfTwo(arr) {
    const nextPowerOfTwo = Math.pow(2, Math.ceil(Math.log2(arr.length)));
    const paddedArray = new Array(nextPowerOfTwo).fill(0);
    for (let i = 0; i < arr.length; i++) {
      paddedArray[i] = arr[i];
    }
    return paddedArray;
  }

  // Simple FFT function (Cooley-Tukey algorithm)
function fft(input) {
  const N = input.length;
  const output = new Array(N).fill(0).map(() => ({ real: 0, imag: 0 }));

  // Bit-reversed copy
  const bits = Math.log2(N);
  for (let i = 0; i < N; i++) {
      const j = parseInt(i.toString(2).padStart(bits, '0').split('').reverse().join(''), 2);
      output[j] = { real: input[i], imag: 0 };
  }

  // FFT computation
  for (let len = 2; len <= N; len *= 2) {
      const ang = (2 * Math.PI) / len;
      const wlen = { real: Math.cos(ang), imag: Math.sin(ang) };
      for (let i = 0; i < N; i += len) {
          let w = { real: 1, imag: 0 };
          for (let j = 0; j < len / 2; j++) {
              const u = output[i + j];
              const v = {
                  real: w.real * output[i + j + len / 2].real - w.imag * output[i + j + len / 2].imag,
                  imag: w.real * output[i + j + len / 2].imag + w.imag * output[i + j + len / 2].real,
              };
              output[i + j] = { real: u.real + v.real, imag: u.imag + v.imag };
              output[i + j + len / 2] = { real: u.real - v.real, imag: u.imag - v.imag };
              const wTemp = { real: w.real * wlen.real - w.imag * wlen.imag, imag: w.real * wlen.imag + w.imag * wlen.real };
              w = wTemp; // Update w
          }
      }
  }

  return output;
}
  

  export const fillMissingRRForLogsWithHR = async () => {
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

// Function to calculate frequency domain features
export const calculateFrequencyDomain = (rrIntervals) => {
    if (!Array.isArray(rrIntervals) || rrIntervals.length === 0) {
      throw new Error('Invalid RR intervals array');
    }
  
    const fs = 4; // Sampling frequency (4 Hz is common in HRV analysis)
    const interpolatedRR = interpolateRR(rrIntervals, fs);
  
    // Pad RR intervals to the next power of two
    const paddedRR = padToPowerOfTwo(interpolatedRR);
  
    const N = paddedRR.length;
    const real = paddedRR.slice();
    const imag = new Array(N).fill(0);
  
    const { real: realFFT, imag: imagFFT } = customFFT(real, imag);
  
    const magnitudes = calculateMagnitude(realFFT, imagFFT);
    const frequencies = getFrequencyBins(N, fs);
  
    let lfPower = 0;
    let hfPower = 0;
  
    for (let i = 0; i < frequencies.length; i++) {
      const freq = frequencies[i];
      const power = magnitudes[i] ** 2;
  
      if (freq >= 0.04 && freq < 0.15) {
        lfPower += power;
      }
  
      if (freq >= 0.15 && freq < 0.4) {
        hfPower += power;
      }
    }
  
    const lfhratio = lfPower / hfPower;
  
    return {
      lf: lfPower,
      hf: hfPower,
      lfhratio
    };
  };

  // Helper function: Bit-reverse copy
const bitReverse = (n, bits) => {
    let reversed = 0;
    for (let i = 0; i < bits; i++) {
      reversed <<= 1;
      reversed |= n & 1;
      n >>= 1;
    }
    return reversed;
  };
  
  // Custom FFT function
  const customFFT = (real, imag) => {
    const N = real.length;
    const bits = Math.log2(N);
  
    if (!Number.isInteger(bits)) {
      throw new Error("Array length must be a power of two");
    }
  
    // Bit-reverse copy
    const reversedReal = new Array(N);
    const reversedImag = new Array(N);
    for (let i = 0; i < N; i++) {
      const j = bitReverse(i, bits);
      reversedReal[i] = real[j];
      reversedImag[i] = imag[j];
    }
  
    // FFT
    for (let size = 2; size <= N; size *= 2) {
      const halfSize = size / 2;
      const tableStep = Math.PI / halfSize;
  
      for (let i = 0; i < N; i += size) {
        for (let j = 0; j < halfSize; j++) {
          const angle = j * tableStep;
          const wr = Math.cos(angle);
          const wi = -Math.sin(angle);
  
          const realPart = wr * reversedReal[i + j + halfSize] - wi * reversedImag[i + j + halfSize];
          const imagPart = wr * reversedImag[i + j + halfSize] + wi * reversedReal[i + j + halfSize];
  
          reversedReal[i + j + halfSize] = reversedReal[i + j] - realPart;
          reversedImag[i + j + halfSize] = reversedImag[i + j] - imagPart;
  
          reversedReal[i + j] += realPart;
          reversedImag[i + j] += imagPart;
        }
      }
    }
  
    return { real: reversedReal, imag: reversedImag };
  };
  
  // Magnitude calculation from FFT output
  const calculateMagnitude = (real, imag) => {
    const magnitudes = [];
    for (let i = 0; i < real.length; i++) {
      magnitudes.push(Math.sqrt(real[i] ** 2 + imag[i] ** 2));
    }
    return magnitudes;
  };
  
  // Frequency bins calculation
  const getFrequencyBins = (N, fs) => {
    const frequencies = [];
    for (let i = 0; i < N / 2; i++) {
      frequencies.push(i * fs / N);
    }
    return frequencies;
  };
  
  // Function to interpolate RR intervals
  const interpolateRR = (rrIntervals, fs) => {
    const time = [];
    const interpolatedRR = [];
  
    let currentTime = 0;
    for (let i = 0; i < rrIntervals.length; i++) {
      time.push(currentTime);
      currentTime += rrIntervals[i] / 1000; // RR interval in seconds
    }
  
    const duration = time[time.length - 1];
    const interpolatedTime = [];
    for (let t = 0; t <= duration; t += 1 / fs) {
      interpolatedTime.push(t);
    }
  
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