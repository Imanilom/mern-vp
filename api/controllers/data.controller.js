import Log from '../models/log.model.js';
import Segment from '../models/segment.model.js';
import FFT from 'fft.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cron from 'node-cron';


// Fungsi untuk menghitung DFA
function calculateDFA(data, order = 1) {
        const y = data.map((val, i) => data.slice(0, i + 1).reduce((acc, v) => acc + (v - data.reduce((acc, val) => acc + val, 0) / data.length), 0));
        const boxSizes = [...new Set(Array.from({ length: Math.log2(data.length) }, (_, i) => Math.pow(2, i + 1)).filter(val => val <= data.length / 2))];
        const fluctuation = boxSizes.map(boxSize => {
            const reshaped = Array.from({ length: Math.floor(data.length / boxSize) }, (_, i) => y.slice(i * boxSize, (i + 1) * boxSize));
            const localTrends = reshaped.map(segment => {
                const x = Array.from({ length: segment.length }, (_, i) => i);
                const [a, b] = [0, 1].map(deg => segment.reduce((acc, val, i) => acc + Math.pow(x[i], deg) * val, 0) / segment.length);
                return segment.map((val, i) => a * x[i] + b);
            });
            return Math.sqrt(localTrends.flatMap((trend, i) => trend.map((val, j) => Math.pow(val - reshaped[i][j], 2))).reduce((acc, val) => acc + val, 0) / (reshaped.length * reshaped[0].length));
        });
        const [logBoxSizes, logFluctuation] = [boxSizes, fluctuation].map(arr => arr.map(val => Math.log10(val)));
        const alpha = (logFluctuation.reduce((acc, val, i) => acc + (val * logBoxSizes[i]), 0) - (logFluctuation.reduce((acc, val) => acc + val, 0) * logBoxSizes.reduce((acc, val) => acc + val, 0) / logBoxSizes.length)) / 
        (logBoxSizes.reduce((acc, val) => acc + Math.pow(val, 2), 0) - Math.pow(logBoxSizes.reduce((acc, val) => acc + val, 0), 2) / logBoxSizes.length);
        return alpha;
    }
    

// Fungsi filterIQ yang sama seperti sebelumnya
async function filterIQ(logs, multiplier = 1.5) {
    const filteredLogs = [];
    for (const [interval, logData] of Object.entries(logs)) {
        const hrValues = logData.HR.filter(value => value != null);
        const rrValues = logData.RR.filter(value => value != null);
        const hrStats = calculateQuartilesAndIQR(hrValues);
        const rrStats = calculateQuartilesAndIQR(rrValues);
        const filteredHr = hrValues.filter(
            (value) =>
                value >= hrStats.Q1 - multiplier * hrStats.IQR &&
                value <= hrStats.Q3 + multiplier * hrStats.IQR
        );
        const filteredRr = rrValues.filter(
            (value) =>
                value >= rrStats.Q1 - multiplier * rrStats.IQR &&
                value <= rrStats.Q3 + multiplier * rrStats.IQR
        );
        if (filteredHr.length > 0 && filteredRr.length > 0) {
            filteredLogs.push({
                interval,
                logs: filteredHr.map((hr, index) => ({
                    HR: hr,
                    RR: filteredRr[index],
                    create_at: new Date(interval),
                })),
            });
        }
    }
    return filteredLogs;
}

function calculateQuartilesAndIQR(values) {
    values.sort((a, b) => a - b);
    const midIndex = Math.floor(values.length / 2);
    const Q1 = values[Math.floor(midIndex / 2)];
    const Q3 = values[Math.floor(midIndex + midIndex / 2)];
    const IQR = Q3 - Q1;
    return { Q1, Q3, IQR };
}

async function calculateMetricsAfterIQFilter(filteredLogs) {
    const results = {};
    for (const intervalData of filteredLogs) {
        const { interval, logs } = intervalData;
        const rrValues = logs.map((log) => log.RR).filter(value => value != null);
        const hrValues = logs.map((log) => log.HR).filter(value => value != null);
        if (rrValues.length < 2 || hrValues.length < 2) continue;
        const hrMetrics = calculateMetrics(hrValues);
        const rrMetrics = calculateMetrics(rrValues);
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

function segmentDataByInterval(logs, intervalType = 'hour') {
    const segmentedData = {};
    logs.forEach((log) => {
        const timestamp = new Date(log.create_at);
        let intervalKey;
        if (intervalType === 'hour') {
            intervalKey = `${timestamp.getUTCFullYear()}-${timestamp.getUTCMonth() + 1}-${timestamp.getUTCDate()}T${timestamp.getUTCHours()}`;
        } else if (intervalType === 'day') {
            intervalKey = `${timestamp.getUTCFullYear()}-${timestamp.getUTCMonth() + 1}-${timestamp.getUTCDate()}`;
        }
        if (!segmentedData[intervalKey]) {
            segmentedData[intervalKey] = { HR: [], RR: [] };
        }
        segmentedData[intervalKey].HR.push(log.HR);
        segmentedData[intervalKey].RR.push(log.RR);
    });
    return segmentedData;
}

const processAndSaveData = async () => {
    try {
        const now = new Date();
        const formattedDate = `${now.getUTCFullYear()}${now.getUTCMonth() + 1}${now.getUTCDate()}`;
        
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 hari yang lalu
        const oneDayBeforeThat = new Date(oneDayAgo.getTime() - 24 * 60 * 60 * 1000); // 1 hari sebelumnya hingga 1 hari yang lalu
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

        // Resolve __dirname for ES6 module
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);

        const outputDir = path.resolve(__dirname, 'data');
        fs.mkdirSync(outputDir, { recursive: true });
        const filePath = path.join(outputDir, `data_${formattedDate}.json`);

        const jsonContent = JSON.stringify(results, null, 2);
        fs.writeFileSync(filePath, jsonContent, 'utf8');
        console.log(`Metrics saved successfully at ${formattedDate}.`);
    } catch (error) {
        console.error('Error processing and saving data:', error);
    }
};

setInterval(processAndSaveData, 5 * 60 * 1000); // Set interval untuk 5 menit
// Jadwalkan cron job untuk berjalan setiap 5 menit untuk menghitung metrik
cron.schedule('*/5 * * * *', () => {
    console.log('Cron job started for metrics calculation');
    processAndSaveData();
});

function calculateMetrics(values) {
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const sortedValues = values.slice().sort((a, b) => a - b);
    const midIndex = Math.floor(sortedValues.length / 2);
    const median =
        sortedValues.length % 2 === 0
            ? (sortedValues[midIndex - 1] + sortedValues[midIndex]) / 2
            : sortedValues[midIndex];
    return { mean, max, min, median };
}

function calculateAdvancedMetrics(rrIntervals) {
    if (rrIntervals.length < 2) {
        return null;
    }

    const sortedIntervals = rrIntervals.slice().sort((a, b) => a - b);
    const midIndex = Math.floor(sortedIntervals.length / 2);
    const median =
        sortedIntervals.length % 2 === 0
            ? (sortedIntervals[midIndex - 1] + sortedIntervals[midIndex]) / 2
            : sortedIntervals[midIndex];
    const median3dp = parseFloat(median.toFixed(3));
    const sum = rrIntervals.reduce((acc, val) => acc + val, 0);
    const mean = sum / rrIntervals.length;
    const max = Math.max(...rrIntervals);
    const min = Math.min(...rrIntervals);
    const squaredDiffs = [];
    for (let i = 1; i < rrIntervals.length; i++) {
        const diff = rrIntervals[i] - rrIntervals[i - 1];
        squaredDiffs.push(diff * diff);
    }
    const rmssd = Math.sqrt(
        squaredDiffs.reduce((acc, val) => acc + val, 0) / squaredDiffs.length
    );
    const avgNN = mean;
    const sdnn = Math.sqrt(
        rrIntervals.reduce((acc, val) => acc + Math.pow(val - avgNN, 2), 0) /
            (rrIntervals.length - 1)
    );

    const fftSize = getNearestPowerOfTwo(rrIntervals.length);
    if (fftSize <= 1) {
        return {
            median3dp,
            mean,
            max,
            min,
            rmssd,
            sdnn,
            hf: 0,
            lf: 0,
            lfHfRatio: 0,
        };
    }

    const fft = new FFT(fftSize);
    const out = fft.createComplexArray();
    fft.realTransform(out, rrIntervals);
    const powerSpectrum = [];
    for (let i = 0; i < out.length / 2; i++) {
        powerSpectrum.push(Math.sqrt(out[2 * i] * out[2 * i] + out[2 * i + 1] * out[2 * i + 1]) / rrIntervals.length);
    }

    const samplingRate = 1; // Ubah sesuai dengan laju sampling yang benar
    const frequencies = Array.from({ length: powerSpectrum.length }, (_, i) => i * (samplingRate / fftSize));

    let hf = 0, lf = 0;
    for (let i = 0; i < powerSpectrum.length; i++) {
        if (frequencies[i] >= 0.15 && frequencies[i] <= 0.4) {
            hf += powerSpectrum[i] * powerSpectrum[i];
        } else if (frequencies[i] >= 0.04 && frequencies[i] <= 0.15) {
            lf += powerSpectrum[i] * powerSpectrum[i];
        }
    }
    const lfHfRatio = lf / hf;
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

function getNearestPowerOfTwo(num) {
    return Math.pow(2, Math.ceil(Math.log2(num)));
}
