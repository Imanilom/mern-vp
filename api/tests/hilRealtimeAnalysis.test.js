import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeHilRealtimeEvaluation } from '../utils/hilRealtimeAnalysis.js';

function readings({ heartRate = 70, count = 6 } = {}) {
  const start = Date.now() - count * 5000;
  return Array.from({ length: count }, (_, index) => ({
    recorded_at: new Date(start + index * 5000),
    heart_rate_bpm: heartRate + index,
    rr_interval_ms: 820 + (index % 5) * 7,
    acceleration_g: [0.02, -0.01, 0.98],
    sensor_contact: true,
    signal_confidence: 0.95,
  }));
}

const provisionalBaseline = {
  stats: {
    mean_hr: { mean: 70, std: 5 },
    rmssd: { mean: 15, std: 10 },
    sdnn: { mean: 10, std: 10 },
    dfa_alpha1: { mean: 0.8, std: 0.1 },
  },
  maturity_detail: { level: 'provisional' },
};

test('HIL synchronous evaluator calculates HR features and uses provisional baselines', () => {
  const result = analyzeHilRealtimeEvaluation({
    activity: 'sitting',
    readings: readings(),
  }, [provisionalBaseline]);

  assert.equal(result.source, 'synchronous_hil_backend');
  assert.equal(result.metrics.mean_hr, 72.5);
  assert.ok(result.metrics.hr_slope_bpm_per_minute > 0);
  assert.equal(result.baseline.level, 'provisional');
  assert.equal(result.interpretation.status, 'normal');
  assert.equal(result.interpretation.provisional_baseline, true);
});

test('HIL synchronous evaluator labels high HR and subsequent recovery trends', () => {
  const elevated = analyzeHilRealtimeEvaluation({
    activity: 'sitting',
    readings: readings({ heartRate: 95 }),
  }, [provisionalBaseline]);
  assert.equal(elevated.interpretation.status, 'candidate_deviation');

  const recovery = analyzeHilRealtimeEvaluation({
    activity: 'sitting',
    readings: readings({ heartRate: 70 }).map((reading) => ({
      ...reading,
      heart_rate_bpm: 70,
    })),
    previous_mean_hr: 95,
    previous_elevated: true,
  }, [provisionalBaseline]);
  assert.equal(recovery.interpretation.status, 'recovered');
  assert.equal(recovery.interpretation.is_recovery, true);
});

test('HIL synchronous evaluator computes DFA only from the five-minute RR batch', () => {
  const dfaBatch = Array.from({ length: 180 }, (_, index) =>
    800 + 40 * Math.sin(index * 0.7) + 15 * Math.sin(index * 0.13)
  );
  const result = analyzeHilRealtimeEvaluation({
    activity: 'sitting',
    readings: readings(),
    dfa_rr_intervals_ms: dfaBatch,
  }, [provisionalBaseline]);

  assert.equal(result.metrics.dfa_rr_count, 180);
  assert.equal(typeof result.metrics.dfa_alpha1, 'number');
});

test('HIL synchronous evaluator withholds interpretation when baseline or signal is insufficient', () => {
  const noBaseline = analyzeHilRealtimeEvaluation({
    activity: 'walking',
    readings: readings(),
  }, []);
  assert.equal(noBaseline.interpretation.status, 'not_assessable');

  const poorQuality = analyzeHilRealtimeEvaluation({
    activity: 'sitting',
    readings: readings().map((reading) => ({
      ...reading,
      signal_confidence: 0.1,
    })),
  }, [provisionalBaseline]);
  assert.equal(poorQuality.interpretation.status, 'not_assessable');
});
