import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGO || 'mongodb://capar_admin:SecurePassword123!@127.0.0.1:27017/test?authSource=admin';

async function runBenchmark() {
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const segColl = db.collection('segments');

    console.log('Connected to MongoDB. Running empirical benchmark on actual segments...');

    // 1. Fetch 5min and 1min segments
    const segs5 = await segColl.find({ window_type: '5min' }).toArray();
    const segs1 = await segColl.find({ window_type: '1min' }).toArray();

    console.log(`Retrieved ${segs5.length} segments of 5-min and ${segs1.length} segments of 1-min.`);

    function computeStats(arr, extractor) {
      const vals = arr.map(extractor).filter(v => typeof v === 'number' && !isNaN(v));
      if (vals.length === 0) return { count: 0, mean: 0, std: 0, min: 0, max: 0, cv: 0, nullCount: arr.length };
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (vals.length > 1 ? vals.length - 1 : 1);
      const std = Math.sqrt(variance);
      const sorted = [...vals].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const cv = mean !== 0 ? (std / Math.abs(mean)) * 100 : 0;
      return {
        count: vals.length,
        nullCount: arr.length - vals.length,
        validPct: Number(((vals.length / arr.length) * 100).toFixed(1)),
        mean: Number(mean.toFixed(2)),
        std: Number(std.toFixed(2)),
        median: Number(median.toFixed(2)),
        min: Number(sorted[0].toFixed(2)),
        max: Number(sorted[sorted.length - 1].toFixed(2)),
        cv: Number(cv.toFixed(1))
      };
    }

    // 2. Feature stability comparison
    const features = ['mean_hr', 'std_hr', 'delta_hr', 'mean_rr', 'sdnn', 'rmssd', 'pnn50', 'dfa_alpha1', 'dfa_alpha2', 'lf', 'hf', 'rolling_variance'];

    const benchmarkResults = {};

    for (const f of features) {
      benchmarkResults[f] = {
        '5min': computeStats(segs5, s => s.features?.[f]),
        '1min': computeStats(segs1, s => s.features?.[f])
      };
    }

    // 3. Artifact / Extreme Jump Sensitivity Analysis
    // Count extreme jumps between consecutive windows for the same user
    function analyzeTemporalTransitions(segs) {
      // Group by user_id
      const byUser = {};
      for (const s of segs) {
        const u = String(s.user_id);
        if (!byUser[u]) byUser[u] = [];
        byUser[u].push(s);
      }

      let totalPairs = 0;
      let hrJumpsOver15 = 0; // sudden jump > 15 bpm
      let rmssdJumpsOver30 = 0; // sudden jump > 30 ms
      let stateSwitches = 0;

      for (const list of Object.values(byUser)) {
        list.sort((a, b) => a.window_start - b.window_start);
        for (let i = 1; i < list.length; i++) {
          const prev = list[i - 1];
          const curr = list[i];
          // Check if contiguous (within 1.5x window duration)
          const dt = (curr.window_start - prev.window_start) / 1000;
          if (dt <= 600) {
            totalPairs++;
            if (Math.abs((curr.features?.mean_hr || 0) - (prev.features?.mean_hr || 0)) > 15) {
              hrJumpsOver15++;
            }
            if (Math.abs((curr.features?.rmssd || 0) - (prev.features?.rmssd || 0)) > 30) {
              rmssdJumpsOver30++;
            }
            if (curr.classification && prev.classification && curr.classification !== prev.classification) {
              stateSwitches++;
            }
          }
        }
      }

      return {
        totalPairs,
        hrJumpPct: totalPairs > 0 ? Number(((hrJumpsOver15 / totalPairs) * 100).toFixed(2)) : 0,
        rmssdJumpPct: totalPairs > 0 ? Number(((rmssdJumpsOver30 / totalPairs) * 100).toFixed(2)) : 0,
        switchPct: totalPairs > 0 ? Number(((stateSwitches / totalPairs) * 100).toFixed(2)) : 0
      };
    }

    const transitions5 = analyzeTemporalTransitions(segs5);
    const transitions1 = analyzeTemporalTransitions(segs1);

    // 4. Activity breakdown
    const activity5 = {};
    for (const s of segs5) {
      const a = s.activity_label || 'Unknown';
      activity5[a] = (activity5[a] || 0) + 1;
    }

    const activity1 = {};
    for (const s of segs1) {
      const a = s.activity_label || 'Unknown';
      activity1[a] = (activity1[a] || 0) + 1;
    }

    // 5. Output JSON Summary
    const summary = {
      dataset: {
        total_5min_segments: segs5.length,
        total_1min_segments: segs1.length,
        activity_distribution_5min: activity5,
        activity_distribution_1min: activity1
      },
      features: benchmarkResults,
      noise_and_stability: {
        '5min': transitions5,
        '1min': transitions1
      }
    };

    console.log('===BENCHMARK_RESULT_START===');
    console.log(JSON.stringify(summary, null, 2));
    console.log('===BENCHMARK_RESULT_END===');

    process.exit(0);
  } catch (err) {
    console.error('Benchmark error:', err);
    process.exit(1);
  }
}

runBenchmark();
