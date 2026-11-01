import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPatientHilBaselineWindow,
  buildPatientHilRealtimeBaselines,
  summarizePatientHilBaselines,
} from '../utils/patientHilBaseline.js';

const sample = (overrides = {}) => ({
  _id: '507f1f77bcf86cd799439011',
  recording_purpose: 'hil_baseline',
  provider: 'polar_h10',
  source: 'mobile_wearable_bridge',
  ingestion_source: 'mobile_wearable_bridge',
  is_simulated: false,
  sensor_contact: true,
  data_quality: {
    status: 'accepted',
    q_signal: 0.9,
    q_complete: 0.95,
  },
  recorded_at: '2026-11-01T04:00:15.000Z',
  activity: 'sitting',
  heart_rate_bpm: 70,
  rr_intervals_ms: [800, 810],
  rmssd_ms: 10,
  sdnn_ms: 15,
  dfa_alpha1: 0.8,
  motion_index: 0.25,
  ...overrides,
});

test('HIL baseline windows are constructed from accepted wearable samples only', () => {
  const window = buildPatientHilBaselineWindow(
    sample(),
    '507f1f77bcf86cd799439012',
    'user'
  );
  assert.equal(window.activity, 'sitting');
  assert.equal(window.recording_purpose, 'hil_baseline');
  assert.equal(window.window_start, Date.parse('2026-11-01T04:00:00.000Z'));
  assert.equal(window.features.mean_rr, 805);
  assert.equal(window.features.motion_intensity, 0.25);
  assert.equal(window.account_type, 'user');
  assert.equal(buildPatientHilBaselineWindow(
    sample({ is_simulated: true }),
    '507f1f77bcf86cd799439012',
    'user'
  ), null);
  assert.equal(buildPatientHilBaselineWindow(
    sample({ activity: 'running' }),
    '507f1f77bcf86cd799439012',
    'user'
  ), null);
  assert.equal(buildPatientHilBaselineWindow(
    sample({ recording_purpose: 'standard' }),
    '507f1f77bcf86cd799439012',
    'user'
  ), null);
});

test('HIL baseline readiness requires five quality-gated minutes per activity', () => {
  const start = Date.parse('2026-11-01T04:00:00.000Z');
  const windows = Array.from({ length: 5 }, (_, index) => ({
    recording_purpose: 'hil_baseline',
    activity: 'sitting',
    window_start: start + index * 60_000,
    recorded_at: new Date(start + index * 60_000),
    quality: { q_signal: 0.9, q_complete: 0.9 },
    features: { mean_hr: 70 + index, mean_rr: 800, rmssd: 10 },
  }));
  const [context] = summarizePatientHilBaselines(windows);
  assert.equal(context.scenario_readiness.ready, true);
  assert.equal(context.scenario_readiness.valid_window_count, 5);
  assert.equal(context.segment_count, 5);
  assert.equal(context.feature_stats.mean_hr.mean, 72);

  const [notReady] = summarizePatientHilBaselines(windows.slice(0, 4));
  assert.equal(notReady.scenario_readiness.ready, false);
  assert.equal(notReady.scenario_readiness.valid_duration_seconds, 240);
});

test('real-time HIL analysis uses only ready isolated HIL feature statistics', () => {
  const start = Date.parse('2026-11-01T04:00:00.000Z');
  const windows = Array.from({ length: 5 }, (_, index) => ({
    recording_purpose: 'hil_baseline',
    activity: 'sitting',
    window_start: start + index * 60_000,
    recorded_at: new Date(start + index * 60_000),
    quality: { q_signal: 0.9, q_complete: 0.9 },
    features: { mean_hr: 70 + index, mean_rr: 820 },
  }));
  const [baseline] = buildPatientHilRealtimeBaselines(windows, 'sitting');

  assert.equal(baseline.stats.mean_hr.mean, 72);
  assert.equal(baseline.stats.mean_hr.std, Math.sqrt(2));
  assert.equal(baseline.is_mature, false);
  assert.deepEqual(buildPatientHilRealtimeBaselines(windows.slice(0, 4), 'sitting'), []);
  assert.deepEqual(buildPatientHilRealtimeBaselines(windows, 'walking'), []);
});

test('HIL baseline windows deduplicate minutes and exclude low-quality windows', () => {
  const start = Date.parse('2026-11-01T04:00:00.000Z');
  const windows = Array.from({ length: 5 }, (_, index) => ({
    recording_purpose: 'hil_baseline',
    activity: 'walking',
    window_start: start + index * 60_000,
    recorded_at: new Date(start + index * 60_000),
    quality: {
      q_signal: index === 4 ? 0.4 : 0.9,
      q_complete: 0.9,
    },
    features: { mean_hr: 80 },
  }));
  windows.push({ ...windows[0], recorded_at: new Date(start + 20_000) });

  const [context] = summarizePatientHilBaselines(windows);
  assert.equal(context.scenario_readiness.ready, false);
  assert.equal(context.scenario_readiness.valid_window_count, 4);
  assert.equal(context.segment_count, 5);
});

test('ordinary recording windows do not contribute to HIL readiness', () => {
  const start = Date.parse('2026-11-01T04:00:00.000Z');
  const windows = Array.from({ length: 5 }, (_, index) => ({
    recording_purpose: 'standard',
    activity: 'sitting',
    window_start: start + index * 60_000,
    recorded_at: new Date(start + index * 60_000),
    quality: { q_signal: 0.9, q_complete: 0.9 },
    features: { mean_hr: 70 },
  }));

  assert.deepEqual(summarizePatientHilBaselines(windows), []);
});
