import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessScenarioBaseline,
  buildScenarioInterpretation,
  mapScenarioActivity,
} from '../utils/scenarioEngine.js';

const baseline = {
  activity: 'Rest',
  time_period: 'morning',
  is_mature: false,
};

function windows(count, start = Date.UTC(2026, 0, 5, 8)) {
  return Array.from({ length: count }, (_, index) => ({
    window_start: start + index * 60_000,
    signal_quality_detail: {
      q_signal: 0.8,
      q_complete: 0.9,
    },
  }));
}

test('scenario baseline requires one formation day and ten quality-valid minutes', () => {
  const ready = assessScenarioBaseline(baseline, windows(10));
  assert.equal(ready.ready, true);
  assert.equal(ready.valid_duration_seconds, 600);
  assert.equal(ready.distinct_days, 1);
  assert.equal(ready.status, 'ELIGIBLE');

  const tooShort = assessScenarioBaseline(baseline, windows(9));
  assert.equal(tooShort.ready, false);
  assert.equal(tooShort.reason_code, 'VALID_DATA_UNDER_TEN_MINUTES');

  const lowQuality = windows(10);
  lowQuality[4].signal_quality_detail.q_signal = 0.4;
  const qualityGated = assessScenarioBaseline(baseline, lowQuality);
  assert.equal(qualityGated.ready, false);
  assert.equal(qualityGated.valid_duration_seconds, 540);
});

test('scenario interpretation remains unresolved without statistical evidence', () => {
  const result = buildScenarioInterpretation({
    version: 1,
    scenarioId: 'a',
    segment: {
      _id: 'segment-id',
      is_valid: true,
      analyzed: true,
      activity_label: 'Rest',
      signal_quality_detail: { q_signal: 0.9, q_complete: 0.9 },
      quality_audit: { gate_passed: true },
      features: { mean_hr: 65, rmssd: 40 },
      window_start: Date.UTC(2026, 0, 5, 8),
    },
    baseline,
    baselineReadiness: { ready: true, status: 'ELIGIBLE' },
    score: { available: false, reason: 'insufficient_baseline' },
  });
  assert.equal(result.status, 'UNRESOLVED');
  assert.equal(result.reason_code, 'insufficient_baseline');
  assert.equal(result.statistical_evidence, null);
});

test('scenario classification compares squared distance to the squared threshold', () => {
  const result = buildScenarioInterpretation({
    version: 1,
    scenarioId: 'c',
    segment: {
      _id: 'segment-id',
      is_valid: true,
      analyzed: true,
      activity_label: 'Rest',
      signal_quality_detail: { q_signal: 0.9, q_complete: 0.9 },
      quality_audit: { gate_passed: true },
      features: { mean_hr: 65, rmssd: 40 },
      window_start: Date.UTC(2026, 0, 5, 8),
    },
    baseline,
    baselineReadiness: { ready: true, status: 'ELIGIBLE' },
    score: {
      available: true,
      distance: 20,
      squared_distance: 4,
      thresholds: { mild: 5, significant: 10 },
      feature_keys: ['mean_hr', 'rmssd'],
      sample_count: 50,
    },
  });
  assert.equal(result.status, 'BASELINE_COMPATIBLE');
});

test('activity context maps to CAPAR labels without inventing unsupported mappings', () => {
  assert.equal(mapScenarioActivity('walking'), 'Light');
  assert.equal(mapScenarioActivity('exercise'), 'Moderate');
  assert.equal(mapScenarioActivity('Rest'), 'Rest');
  assert.equal(mapScenarioActivity('unsure'), null);
});
