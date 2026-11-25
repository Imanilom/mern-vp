import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCaparDailyAnalysis,
  getJakartaDayRange,
  getJakartaDateKey,
  getTimePeriodForWindow,
  normalizeEpochMs,
} from '../utils/caparWindowAnalytics.js';

test('CAPAR window timestamps normalize seconds and milliseconds to Jakarta dates', () => {
  const milliseconds = Date.parse('2026-10-25T17:30:00.000Z');
  assert.equal(normalizeEpochMs(milliseconds / 1000), milliseconds);
  assert.equal(normalizeEpochMs(milliseconds), milliseconds);
  assert.equal(getJakartaDateKey(milliseconds), '2026-10-26');
  assert.equal(getTimePeriodForWindow(milliseconds), 'night');
  assert.deepEqual(getJakartaDayRange('2026-10-26'), {
    startMs: Date.parse('2026-10-25T17:00:00.000Z'),
    endMs: Date.parse('2026-10-26T17:00:00.000Z'),
  });
  assert.throws(() => getJakartaDayRange('2026-02-31'), /Tanggal tidak valid/);
});

test('daily summaries use valid windows and calculate HR variance and HR-RR covariance', () => {
  const windows = [
    {
      _id: 'one',
      window_start: Date.parse('2026-10-26T01:00:00.000Z'),
      window_end: Date.parse('2026-10-26T01:05:00.000Z'),
      activity_label: 'Rest',
      raw_count: 20,
      is_valid: true,
      features: { mean_hr: 60, mean_rr: 1000, motion_intensity: 0.2, rmssd: 30, dfa_alpha1: 1.1 },
    },
    {
      _id: 'two',
      window_start: Date.parse('2026-10-26T01:05:00.000Z'),
      window_end: Date.parse('2026-10-26T01:10:00.000Z'),
      activity_label: 'Rest',
      raw_count: 24,
      is_valid: true,
      features: { mean_hr: 80, mean_rr: 750, motion_intensity: 0.4, rmssd: 20, dfa_alpha1: 1.3 },
    },
    {
      _id: 'three',
      window_start: Date.parse('2026-10-26T01:10:00.000Z'),
      window_end: Date.parse('2026-10-26T01:15:00.000Z'),
      activity_label: 'Rest',
      raw_count: 10,
      is_valid: false,
      features: { mean_hr: 300, mean_rr: 200, motion_intensity: 0.9, rmssd: 0, dfa_alpha1: 0 },
    },
  ];

  const result = buildCaparDailyAnalysis(windows);
  assert.equal(result.source_window_count, 3);
  assert.equal(result.valid_window_count, 2);
  assert.equal(result.activity_summaries[0].mean_hr, 70);
  assert.equal(result.activity_summaries[0].mean_rr, 875);
  assert.ok(Math.abs(result.activity_summaries[0].mean_motion_intensity - 0.3) < 1e-10);
  assert.ok(Math.abs(result.activity_summaries[0].mean_dfa_alpha1 - 1.2) < 1e-10);
  assert.equal(result.activity_summaries[0].mean_rmssd, 25);
  assert.equal(result.activity_summaries[0].hr_variance, 200);
  assert.equal(result.activity_summaries[0].hr_rr_covariance, -2500);
  assert.equal(result.activity_summaries[0].min_hr, 60);
  assert.equal(result.activity_summaries[0].max_hr, 80);
});

test('daily timeline separates activity runs and records chronological transitions', () => {
  const windows = [
    { _id: 'rest-1', window_start: 1800000000000, window_end: 1800000001000, activity_label: 'Rest', is_valid: true },
    { _id: 'rest-2', window_start: 1800000001000, window_end: 1800000002000, activity_label: 'Rest', is_valid: true },
    { _id: 'light-1', window_start: 1800000002000, window_end: 1800000004000, activity_label: 'Light', is_valid: true },
    { _id: 'rest-3', window_start: 1800000005000, window_end: 1800000006000, activity_label: 'Rest', is_valid: true },
  ];

  const result = buildCaparDailyAnalysis(windows.reverse());
  assert.deepEqual(result.activity_runs.map((run) => run.activity), ['Rest', 'Light', 'Rest']);
  assert.deepEqual(
    result.transitions.map(({ from_activity, to_activity, activity_duration_ms }) => (
      [from_activity, to_activity, activity_duration_ms]
    )),
    [['Rest', 'Light', 2000], ['Light', 'Rest', 2000]]
  );
  assert.equal(result.time_edges.length, 3);
  assert.equal(result.time_edges[1].activity_changed, true);
});

test('combined timelines keep adjacent days as separate episodes', () => {
  const windows = [
    {
      _id: 'day-one',
      window_start: Date.parse('2026-10-26T16:55:00.000Z'),
      window_end: Date.parse('2026-10-26T16:59:00.000Z'),
      activity_label: 'Rest',
      is_valid: true,
    },
    {
      _id: 'day-two',
      window_start: Date.parse('2026-10-26T17:01:00.000Z'),
      window_end: Date.parse('2026-10-26T17:05:00.000Z'),
      activity_label: 'Rest',
      is_valid: true,
    },
  ];

  const result = buildCaparDailyAnalysis(windows);
  assert.equal(result.activity_runs.length, 2);
  assert.equal(result.transitions.length, 0);
  assert.equal(result.time_edges.length, 0);
});
