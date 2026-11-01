import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessScenarioBaseline,
  buildScenarioInterpretation,
  isScenarioRealRecordedSample,
  isScenarioQualityGatedSegment,
  mapScenarioActivity,
  scenarioBaselineActivityAliases,
  SCENARIO_DEFINITIONS,
} from '../utils/scenarioEngine.js';

const baseline = {
  activity: 'Rest',
  time_period: 'morning',
  is_mature: false,
};

test('HCI A/B/C definitions retain their original interactions', () => {
  assert.equal(SCENARIO_DEFINITIONS.a.title, 'Satu arah');
  assert.equal(SCENARIO_DEFINITIONS.b.title, 'Dua arah nonadaptif');
  assert.equal(SCENARIO_DEFINITIONS.c.title, 'Dua arah adaptif');
});

function windows(count, start = Date.UTC(2026, 0, 5, 8)) {
  return Array.from({ length: count }, (_, index) => ({
    window_start: start + index * 60_000,
    signal_quality_detail: {
      q_signal: 0.8,
      q_complete: 0.9,
    },
  }));
}

test('scenario baseline requires one formation day and five quality-valid minutes', () => {
  const ready = assessScenarioBaseline(baseline, windows(5));
  assert.equal(ready.ready, true);
  assert.equal(ready.valid_duration_seconds, 300);
  assert.equal(ready.distinct_days, 1);
  assert.equal(ready.status, 'ELIGIBLE');

  const tooShort = assessScenarioBaseline(baseline, windows(4));
  assert.equal(tooShort.ready, false);
  assert.equal(tooShort.reason_code, 'VALID_DATA_UNDER_MINIMUM_DURATION');

  const lowQuality = windows(5);
  lowQuality[2].signal_quality_detail.q_signal = 0.4;
  const qualityGated = assessScenarioBaseline(baseline, lowQuality);
  assert.equal(qualityGated.ready, false);
  assert.equal(qualityGated.valid_duration_seconds, 240);
});

test('stored CAPAR baseline history exposes HIL readiness after five valid minutes', () => {
  const baselineHistory = {
    window_timestamps: windows(5).map((segment) => segment.window_start),
    q_signal_history: Array(5).fill(0.8),
    q_complete_history: Array(5).fill(0.9),
  };
  const readiness = assessScenarioBaseline(baselineHistory);
  assert.equal(readiness.ready, true);
  assert.equal(readiness.valid_window_count, 5);
  assert.equal(readiness.valid_duration_seconds, 300);
});

test('quality-gated cold-start windows count toward scenario readiness without CAPAR maturity', () => {
  const coldStartWindows = windows(5).map((segment) => ({
    ...segment,
    is_valid: true,
    analyzed: true,
    rr_status: 'INSUFFICIENT_BASELINE',
    quality_audit: { gate_passed: true },
  }));
  assert.ok(coldStartWindows.every(isScenarioQualityGatedSegment));
  const readiness = assessScenarioBaseline(null, coldStartWindows);
  assert.equal(readiness.ready, true);
  assert.equal(readiness.valid_duration_seconds, 300);
  assert.equal(readiness.reason_code, null);
});

test('scenario baseline reports insufficient quality-gated duration without a CAPAR document', () => {
  const lowQualityWindows = windows(5).map((segment) => ({
    ...segment,
    signal_quality_detail: { q_signal: 0.4, q_complete: 0.9 },
  }));
  const readiness = assessScenarioBaseline(null, lowQualityWindows);
  assert.equal(readiness.ready, false);
  assert.equal(readiness.valid_duration_seconds, 0);
  assert.equal(readiness.reason_code, 'VALID_DATA_UNDER_MINIMUM_DURATION');
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
  assert.equal(mapScenarioActivity('Duduk'), 'Rest');
  assert.equal(mapScenarioActivity('Tidur'), 'Rest');
  assert.equal(mapScenarioActivity('unsure'), null);
});

test('scenario baseline lookup matches legacy Indonesian CAPAR activity labels', () => {
  const restAliases = scenarioBaselineActivityAliases('Rest', 'sitting');
  assert.equal(restAliases[0], 'Duduk');
  assert.equal(restAliases[1], 'Rest');
  assert.ok(restAliases.includes('Duduk'));
  assert.ok(restAliases.includes('Rest'));
  assert.ok(!restAliases.includes('Tidur'));

  const sleepAliases = scenarioBaselineActivityAliases('Rest', 'sleep');
  assert.equal(sleepAliases[0], 'Tidur');
  assert.equal(sleepAliases[1], 'Rest');
  assert.ok(sleepAliases.includes('Tidur'));
  assert.equal(scenarioBaselineActivityAliases('Duduk')[0], 'Duduk');

  const walkingAliases = scenarioBaselineActivityAliases('Light', 'walking');
  assert.ok(walkingAliases.includes('Berjalan'));
});

test('scenario interpretation distinguishes a stored immature production baseline from experiment readiness', () => {
  const result = buildScenarioInterpretation({
    version: 1,
    scenarioId: 'c',
    segment: {
      is_valid: true,
      analyzed: true,
      activity_label: 'Rest',
      signal_quality_detail: { q_signal: 0.9, q_complete: 0.9 },
      quality_audit: { gate_passed: true },
      features: { mean_hr: 65, rmssd: 40 },
      window_start: Date.UTC(2026, 0, 5, 8),
    },
    baseline: {
      activity: 'Duduk',
      time_period: 'morning',
      segment_count: 397,
      is_mature: false,
      status: 'learning',
    },
    baselineReadiness: {
      ready: false,
      status: 'INELIGIBLE',
      valid_duration_seconds: 60,
      distinct_days: 1,
    },
    score: { available: false, reason: 'insufficient_baseline' },
  });
  assert.equal(result.baseline.activity, 'Duduk');
  assert.equal(result.baseline.production_segment_count, 397);
  assert.equal(result.baseline.production_is_mature, false);
  assert.equal(result.baseline.status, 'INELIGIBLE');
  assert.equal(result.status, 'UNRESOLVED');
});

test('scenario accepts only quality-accepted Polar H10 records from the wearable bridge', () => {
  const realSample = {
    provider: 'polar_h10',
    source: 'mobile_wearable_bridge',
    ingestion_source: 'mobile_wearable_bridge',
    sensor_contact: true,
    data_quality: { status: 'accepted' },
  };
  assert.equal(isScenarioRealRecordedSample(realSample), true);
  assert.equal(
    isScenarioRealRecordedSample({
      ...realSample,
      provider: 'other',
    }),
    false
  );
  assert.equal(
    isScenarioRealRecordedSample({
      ...realSample,
      sensor_contact: false,
    }),
    false
  );
  assert.equal(
    isScenarioRealRecordedSample({
      ...realSample,
      data_quality: { status: 'warning' },
    }),
    false
  );
  assert.equal(
    isScenarioRealRecordedSample({
      ...realSample,
      ingestion_source: 'simulation',
    }),
    false
  );
});
