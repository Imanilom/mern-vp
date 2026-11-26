import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCaparActivityTimeSeries } from '../utils/caparActivityTimeSeries.js';

const accountId = 'account-1';
const generatedBy = 'doctor-1';

test('activity aggregates keep each contiguous activity run as a separate time series', () => {
  const windows = [
    {
      _id: 'walk-1',
      device_id: 'polar-1',
      window_type: '5min',
      window_start: Date.parse('2026-10-26T00:00:00.000Z'),
      window_end: Date.parse('2026-10-26T00:05:00.000Z'),
      activity_label: 'Walk',
      is_valid: true,
      raw_count: 10,
      features: { mean_hr: 90, mean_rr: 700, motion_intensity: 0.4 },
    },
    {
      _id: 'walk-2',
      device_id: 'polar-1',
      window_type: '5min',
      window_start: Date.parse('2026-10-26T00:05:00.000Z'),
      window_end: Date.parse('2026-10-26T00:10:00.000Z'),
      activity_label: 'Walk',
      is_valid: true,
      raw_count: 12,
      features: { mean_hr: 100, mean_rr: 600, motion_intensity: 0.6 },
    },
    {
      _id: 'rest-1',
      device_id: 'polar-1',
      window_type: '5min',
      window_start: Date.parse('2026-10-26T00:10:00.000Z'),
      window_end: Date.parse('2026-10-26T00:15:00.000Z'),
      activity_label: 'Rest',
      is_valid: true,
      raw_count: 8,
      features: { mean_hr: 70, mean_rr: 900, motion_intensity: 0.1 },
    },
    {
      _id: 'walk-3',
      device_id: 'polar-1',
      window_type: '5min',
      window_start: Date.parse('2026-10-26T00:15:00.000Z'),
      window_end: Date.parse('2026-10-26T00:20:00.000Z'),
      activity_label: 'Walk',
      is_valid: false,
      raw_count: 3,
      features: { mean_hr: 180, mean_rr: 400, motion_intensity: 1 },
    },
  ];

  const aggregates = buildCaparActivityTimeSeries(windows.reverse(), { accountId, generatedBy });
  assert.deepEqual(aggregates.map((item) => item.activity_label), ['Walk', 'Rest', 'Walk']);
  assert.equal(aggregates[0].summary.mean_hr, 95);
  assert.equal(aggregates[0].summary.raw_sample_count, 22);
  assert.equal(aggregates[0].summary.hr_variance, 50);
  assert.equal(aggregates[0].summary.hr_rr_covariance, -500);
  assert.equal(aggregates[0].series_points.length, 2);
  assert.equal(aggregates[2].summary.valid_window_count, 0);
  assert.equal(aggregates[2].summary.mean_hr, null);
});

test('activity episodes split at day, device, window-type, and long data-gap boundaries', () => {
  const start = Date.parse('2026-10-26T00:00:00.000Z');
  const base = {
    activity_label: 'Rest',
    is_valid: true,
    raw_count: 1,
    features: { mean_hr: 70 },
  };
  const windows = [
    { ...base, _id: 'a', device_id: 'polar-1', window_type: '1min', window_start: start, window_end: start + 60_000 },
    { ...base, _id: 'b', device_id: 'polar-1', window_type: '1min', window_start: start + 60_000, window_end: start + 120_000 },
    { ...base, _id: 'c', device_id: 'polar-2', window_type: '1min', window_start: start + 120_000, window_end: start + 180_000 },
    { ...base, _id: 'd', device_id: 'polar-2', window_type: '5min', window_start: start + 180_000, window_end: start + 480_000 },
    { ...base, _id: 'e', device_id: 'polar-2', window_type: '5min', window_start: start + 900_000, window_end: start + 1_200_000 },
    { ...base, _id: 'f', device_id: 'polar-2', window_type: '5min', window_start: start + 17 * 60 * 60 * 1000, window_end: start + 17 * 60 * 60 * 1000 + 300_000 },
  ];

  const aggregates = buildCaparActivityTimeSeries(windows, { accountId, generatedBy });
  assert.deepEqual(aggregates.map((item) => item.source_segment_ids.map(String)), [
    ['a', 'b'],
    ['c'],
    ['d'],
    ['e'],
    ['f'],
  ]);
});

test('activity series retains HRV, quality, acceleration, and physiological state transitions', () => {
  const start = Date.parse('2026-10-26T00:00:00.000Z');
  const aggregates = buildCaparActivityTimeSeries([
    {
      _id: 'state-a',
      device_id: 'polar-1',
      window_type: '1min',
      window_start: start,
      window_end: start + 60_000,
      activity_label: 'Rest',
      is_valid: true,
      rr_status: 'NORMAL',
      missing_data_info: { confidence_score: 97 },
      signal_quality_detail: { q_signal: 0.96 },
      raw_count: 15,
      features: {
        mean_hr: 70,
        mean_rr: 900,
        sdnn: 45,
        rmssd: 35,
        dfa_alpha1: 1.05,
        dfa_alpha2: 1.12,
        motion_intensity: 0.1,
      },
    },
    {
      _id: 'state-b',
      device_id: 'polar-1',
      window_type: '1min',
      window_start: start + 60_000,
      window_end: start + 120_000,
      activity_label: 'Rest',
      is_valid: true,
      rr_status: 'RECOVERING',
      missing_data_info: { confidence_score: 93 },
      signal_quality_detail: { q_signal: 0.9 },
      raw_count: 16,
      features: {
        mean_hr: 68,
        mean_rr: 920,
        sdnn: 49,
        rmssd: 39,
        dfa_alpha1: 1.1,
        dfa_alpha2: 1.2,
        motion_intensity: 0.08,
      },
    },
  ], { accountId, generatedBy });

  assert.equal(aggregates.length, 1);
  assert.equal(aggregates[0].summary.mean_sdnn, 47);
  assert.equal(aggregates[0].summary.mean_rmssd, 37);
  assert.ok(Math.abs(aggregates[0].summary.mean_dfa_alpha2 - 1.16) < 1e-10);
  assert.ok(Math.abs(aggregates[0].summary.mean_motion_intensity - 0.09) < 1e-10);
  assert.equal(aggregates[0].summary.mean_confidence_score, 95);
  assert.equal(aggregates[0].summary.state_transition_count, 1);
  assert.deepEqual(aggregates[0].state_transitions[0], {
    from_segment_id: 'state-a',
    to_segment_id: 'state-b',
    timestamp: start + 60_000,
    from_state: 'NORMAL',
    to_state: 'RECOVERING',
  });
});
