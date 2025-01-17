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

// DFA
export const calculateDFA = (data, minWindowSize = 4, maxWindowSize = 32) => {
  // Ensure data is valid and sufficient
  if (data.length < minWindowSize) {
    console.error(
      `Insufficient data for DFA (minimum ${minWindowSize} elements required). Data length: ${data.length}`
    );
    return { alpha1: null, alpha2: null };
  }

  // 1. Compute the cumulative sum (integration)
  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
  const integratedSeries = data.map((val, i) =>
    data.slice(0, i + 1).reduce((sum, v) => sum + (v - mean), 0)
  );

  // 2. Define window sizes
  const windowSizes = Array.from(
    { length: maxWindowSize - minWindowSize + 1 },
    (_, i) => minWindowSize + i
  );

  const calculateFluctuations = (sizes) =>
    sizes.map((windowSize) => {
      const nSegments = Math.floor(integratedSeries.length / windowSize);
      let fluctuation = 0;

      for (let i = 0; i < nSegments; i++) {
        const start = i * windowSize;
        const end = start + windowSize;
        const segment = integratedSeries.slice(start, end);

        // Linear regression
        const x = Array.from({ length: segment.length }, (_, i) => i);
        const n = segment.length;
        const sumX = x.reduce((sum, val) => sum + val, 0);
        const sumY = segment.reduce((sum, val) => sum + val, 0);
        const sumXY = x.reduce((sum, val, idx) => sum + val * segment[idx], 0);
        const sumX2 = x.reduce((sum, val) => sum + val * val, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // Calculate deviations
        const deviations = segment.map(
          (val, idx) => val - (slope * idx + intercept)
        );
        fluctuation += Math.sqrt(
          deviations.reduce((sum, val) => sum + val ** 2, 0) / deviations.length
        );
      }

      return fluctuation / nSegments;
    });

  // 3. Calculate fluctuations for window sizes
  const fluctuationValues1 = calculateFluctuations(
    windowSizes.filter((size) => size <= 16)
  );
  const fluctuationValues2 = calculateFluctuations(
    windowSizes.filter((size) => size >= 17)
  );

  // 4. Compute alpha values (slopes of log-log plots)
  const computeAlpha = (sizes, fluctuations) => {
    const logSizes = sizes.map(Math.log10);
    const logFluctuations = fluctuations.map(Math.log10);

    const n = logSizes.length;
    const sumX = logSizes.reduce((sum, val) => sum + val, 0);
    const sumY = logFluctuations.reduce((sum, val) => sum + val, 0);
    const sumXY = logSizes.reduce(
      (sum, val, idx) => sum + val * logFluctuations[idx],
      0
    );
    const sumX2 = logSizes.reduce((sum, val) => sum + val ** 2, 0);

    const denominator = n * sumX2 - sumX ** 2;
    return denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
  };

  const alpha1 = computeAlpha(
    windowSizes.filter((size) => size <= 16),
    fluctuationValues1
  );
  const alpha2 = computeAlpha(
    windowSizes.filter((size) => size >= 17),
    fluctuationValues2
  );

  return {
    alpha1: parseFloat(alpha1.toFixed(4)),
    alpha2: parseFloat(alpha2.toFixed(4)),
  };
};



// Nilai DFA disimpan dan masuk ke array untuk di olah standar deviasi
// data dfa / minggu untuk menentukan apakah ada anomali
// Fungsi ADFA
export const calculateADFA = (data, order = 1) => {
  // Calculate cumulative profile  baseline
  const y = data.map((val, i) => 
      data.slice(0, i + 1)
          .reduce((acc, v) => acc + (v - data.reduce((acc, val) => acc + val, 0) / data.length), 0)
  );

  // Define box sizes
  const boxSizes = [...new Set(
      Array.from({ length: Math.log2(data.length) }, (_, i) => Math.pow(2, i + 1))
          .filter(val => val <= data.length / 2)
  )];

  // Separate upward and downward trends
  const splitTrends = (segment) => {
      const diff = segment.map((val, idx, arr) => (idx > 0 ? val - arr[idx - 1] : 0));
      const upward = diff.map(d => (d >= 0 ? 1 : 0));
      const downward = diff.map(d => (d < 0 ? 1 : 0));
      return { upward, downward };
  };

  // Helper to calculate fluctuation for a specific trend
  const calculateFluctuation = (boxSize, trend) => {
      const reshaped = Array.from(
          { length: Math.floor(data.length / boxSize) },
          (_, i) => y.slice(i * boxSize, (i + 1) * boxSize)
      );
      const filtered = reshaped.filter((segment, i) => trend[i % trend.length]);
      if (filtered.length === 0) return 0; // Avoid division by zero
      const localTrends = filtered.map(segment => {
          const x = Array.from({ length: segment.length }, (_, i) => i);
          const [a, b] = [0, 1].map(deg => 
              segment.reduce((acc, val, i) => acc + Math.pow(x[i], deg) * val, 0) / segment.length
          );
          return segment.map((val, i) => a * x[i] + b);
      });
      return Math.sqrt(localTrends.flatMap((trend, i) => 
          trend.map((val, j) => Math.pow(val - filtered[i][j], 2))
      ).reduce((acc, val) => acc + val, 0) / (filtered.length * filtered[0].length));
  };

  // Calculate fluctuation for upward and downward trends
  const fluctuationsUp = boxSizes.map(boxSize => calculateFluctuation(boxSize, splitTrends(data).upward));
  const fluctuationsDown = boxSizes.map(boxSize => calculateFluctuation(boxSize, splitTrends(data).downward));

  // Calculate α+ and α-
  const calculateAlpha = (fluctuation) => {
      const [logBoxSizes, logFluctuation] = [boxSizes, fluctuation].map(arr => arr.map(val => Math.log10(val)));
      return (logFluctuation.reduce((acc, val, i) => acc + (val * logBoxSizes[i]), 0) - 
          (logFluctuation.reduce((acc, val) => acc + val, 0) * 
           logBoxSizes.reduce((acc, val) => acc + val, 0) / logBoxSizes.length)) /
          (logBoxSizes.reduce((acc, val) => acc + Math.pow(val, 2), 0) - 
           Math.pow(logBoxSizes.reduce((acc, val) => acc + val, 0), 2) / logBoxSizes.length);
  };

  const alphaPlus = calculateAlpha(fluctuationsUp);
  const alphaMinus = calculateAlpha(fluctuationsDown);


  return { 
    alphaPlus: parseFloat(alphaPlus.toFixed(4)), 
    alphaMinus: parseFloat(alphaMinus.toFixed(4)) 
  };
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

  // MSE & RMSE

  // dfa a1 merah jika a1 < 1.5 dan a2 kurang dari 1 
  // hijau a1 > 1,5 dan a2 > 1
  //  oranye salah satu tidak memenhi 


  // adfa 
  
  // average sigma lambda, buat predicted lenght nya sama dengan actual
  // tabel disimpan di bawah grafik 
  // MSE  = 1/2 lambda(error)^2
  function calculateErrors(actual, predicted) {
    // Pastikan actual dan predicted tidak null/undefined
    if (!Array.isArray(actual) || !Array.isArray(predicted)) {
      throw new Error("Input data harus berupa array.");
    }
  
    // Fungsi untuk format tanggal menjadi yyyy-mm-dd
    function formatDate(date) {
      const d = new Date(date);
      return d.toISOString().split('T')[0]; // Mengambil bagian yyyy-mm-dd
    }

    // Filter `actual` agar hanya berisi data yang ada di `predicted`
    const filteredActual = actual.filter((act) => {
      const formattedDate = formatDate(act.date_created);
      return predicted.some((pred) => formatDate(pred.date_created) === formattedDate && pred.time_created === act.time_created);
    });
  
    // Pastikan panjang `actual` dan `predicted` sama setelah disaring
    if (filteredActual.length !== predicted.length) {
      throw new Error("Array 'actual' dan 'predicted' harus memiliki panjang yang sama setelah pencocokan.");
    }
  
    // Perbarui `actual` dengan hasil filter
    actual = filteredActual;
  
    // Pastikan n bukan 0 dan data tidak kosong
    if (actual.length === 0 || predicted.length === 0) {
      throw new Error("Data 'actual' atau 'predicted' kosong setelah pencocokan.");
    }
  
    const n = actual.length;
    let sumSquaredErrors = 0;
  
    // Hitung squared errors
    const squaredErrors = actual.map((value, index) => {
      // Temukan prediksi yang cocok berdasarkan date_created dan time_created
      const matchedPredicted = predicted.find((pred) => 
        formatDate(pred.date_created) === formatDate(value.date_created) && pred.time_created === value.time_created
      );
  
      // Pastikan ada prediksi yang cocok
      if (!matchedPredicted) {
        throw new Error(`Tidak ditemukan prediksi yang cocok untuk data actual dengan date_created: ${value.date_created} dan time_created: ${value.time_created}`);
      }
  
      // Hitung error antara actual dan predicted
      const error = value.RR - matchedPredicted.RR;
      const squaredError = error ** 2;
      sumSquaredErrors += squaredError;
      return squaredError;
    });
  
    const mse = sumSquaredErrors / n;
    const rmse = Math.sqrt(mse);
  
    return { mse, rmse };
  }
  
  
  export function calculateAdvancedMetrics(allRRIntervals) {


    if (allRRIntervals.length < 2) {
        return null; // Not enough data for calculation
    }

    const sortedIntervals = allRRIntervals.slice().sort((a, b) => a - b); // Copy and sort

    // Median 3dp
    const midIndex = Math.floor(sortedIntervals.length / 2);
    const median =
        sortedIntervals.length % 2 === 0
            ? (sortedIntervals[midIndex - 1] + sortedIntervals[midIndex]) / 2
            : sortedIntervals[midIndex];
    const median3dp = parseFloat(median.toFixed(3)); // Round to 3 decimals

    // Mean, Max, Min
    const sum = allRRIntervals.reduce((acc, val) => acc + val, 0);
    const mean = sum / allRRIntervals.length;
    const max = Math.max(...allRRIntervals);
    const min = Math.min(...allRRIntervals);
    const dfa = calculateDFA(allRRIntervals);
    const adfa = calculateADFA(allRRIntervals);
    // const mseAndRmse = calculateErrors(logs, filteredLogs);

    // S1 & S2
    const diff1 = allRRIntervals.slice(1).map((val, index) => val - allRRIntervals[index]);
    const sum1 = allRRIntervals.slice(1).map((val, index) => val + allRRIntervals[index]);
  
    const s1 = Math.sqrt(diff1.reduce((sum, val) => sum + Math.pow(val, 2), 0) / diff1.length) / Math.sqrt(2);
    const s2 = Math.sqrt(sum1.reduce((sum, val) => sum + Math.pow(val, 2), 0) / sum1.length) / Math.sqrt(2);
    // RMSSD
    const squaredDiffs = [];
    for (let i = 1; i < allRRIntervals.length; i++) {
        const diff = allRRIntervals[i] - allRRIntervals[i - 1];
        squaredDiffs.push(diff * diff);
    }
    const rmssd = Math.sqrt(
        squaredDiffs.reduce((acc, val) => acc + val, 0) / squaredDiffs.length
    );

    // SDNN (Standard Deviation of NN intervals)
    const avgNN = mean; // Mean RR is the same as the average NN interval
    const sdnn = Math.sqrt(
      allRRIntervals.reduce((acc, val) => acc + Math.pow(val - avgNN, 2), 0) /
        (allRRIntervals.length - 1)
    );
    
    // NN50 (Number of pairs of successive NN intervals that differ by more than 50 ms)
    const nn50 = squaredDiffs.filter((val) => val > 50 * 50).length;

    // PNN50 (Proportion derived by dividing NN50 by total number of NN intervals)
    const pnn50 = (nn50 / allRRIntervals.length) * 100;

    // Pad to power of two
    const paddedallRRIntervals = padToPowerOfTwo(allRRIntervals);

    // FFT implementation
    const fftResult = fft(paddedallRRIntervals);
    const powerSpectrum = fftResult.map((value) => Math.sqrt(value.real * value.real + value.imag * value.imag) / paddedallRRIntervals.length);

    // Frequency bins
    const samplingRate = 1; // Adjust according to actual sampling rate
    const frequencies = Array.from({ length: paddedallRRIntervals.length / 2 }, (_, i) => i * (samplingRate / paddedallRRIntervals.length));

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
        adfa,
        median3dp,
        mean,
        max,
        min,
        rmssd,
        sdnn,
        nn50,
        pnn50,
        hf,
        lf,
        lfHfRatio,
        s1,
        s2,
        // mseAndRmse
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

// Fungsi Box-Cox Transformasi
function boxCoxTransform(values, lambda) {
  if (lambda === 0) {
    return values.map(x => Math.log(x)); 
  }
  return values.map(x => (Math.pow(x, lambda) - 1) / lambda);
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
export const calculateFrequencyDomain = (allHRIntervals) => {
    if (!Array.isArray(allHRIntervals) || allHRIntervals.length === 0) {
      throw new Error('Invalid RR intervals array');
    }
  
    const fs = 4; // Sampling frequency (4 Hz is common in HRV analysis)
    const interpolatedRR = interpolateRR(allHRIntervals, fs);
  
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
  const interpolateRR = (allHRIntervals, fs) => {
    const time = [];
    const interpolatedRR = [];
  
    let currentTime = 0;
    for (let i = 0; i < allHRIntervals.length; i++) {
      time.push(currentTime);
      currentTime += allHRIntervals[i] / 1000; // RR interval in seconds
    }
  
    const duration = time[time.length - 1];
    const interpolatedTime = [];
    for (let t = 0; t <= duration; t += 1 / fs) {
      interpolatedTime.push(t);
    }
  
    for (let i = 1; i < time.length; i++) {
      const t1 = time[i - 1];
      const t2 = time[i];
      const rr1 = allHRIntervals[i - 1];
      const rr2 = allHRIntervals[i];
  
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