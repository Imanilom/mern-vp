import test from 'node:test';
import assert from 'node:assert/strict';
import {
  groupRecoveryMetricsByDay,
  groupPhysiologyByActivity,
  groupPhysiologyByCircadianPeriod,
  groupPhysiologyByFeeling,
} from '../../vidyamedic-web/src/utils/physiologyDistributions.js';

const sample = (recorded_at, heart_rate_bpm, rmssd_ms, extra = {}) => ({
  recorded_at,
  heart_rate_bpm,
  rmssd_ms,
  sample_count: 1,
  ...extra,
});

test('circadian means use WIB ranges and exclude simulated data', () => {
  const rows = groupPhysiologyByCircadianPeriod([
    sample('2026-10-05T17:30:00.000Z', 80, 30),
    sample('2026-10-05T23:30:00.000Z', 100, 40),
    sample('2026-10-05T23:45:00.000Z', 120, 60, { is_simulated: true }),
  ]);

  assert.equal(rows.find((row) => row.key === 'night').heartRate, 80);
  assert.equal(rows.find((row) => row.key === 'morning').heartRate, 100);
  assert.equal(rows.find((row) => row.key === 'morning').records, 1);
});

test('activity groups calculate sample-weighted means', () => {
  const rows = groupPhysiologyByActivity([
    sample('2026-10-05T08:00:00.000Z', 60, 20, { activity: 'sitting', sample_count: 2 }),
    sample('2026-10-05T08:30:00.000Z', 90, 40, { activity: 'sitting', sample_count: 1 }),
    sample('2026-10-05T09:00:00.000Z', 120, 50, { activity: 'running', is_simulated: true }),
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].activity, 'sitting');
  assert.equal(rows[0].heartRate, 70);
  assert.ok(Math.abs(rows[0].rmssd - (80 / 3)) < 1e-9);
});

test('mood association uses nearest real wearable sample within the time window', () => {
  const rows = groupPhysiologyByFeeling(
    [
      sample('2026-10-05T08:00:00.000Z', 65, 35),
      sample('2026-10-05T10:00:00.000Z', 95, 20),
    ],
    [
      { recorded_at: '2026-10-05T08:10:00.000Z', feeling: 'good' },
      { recorded_at: '2026-10-05T09:00:00.000Z', feeling: 'poor' },
    ],
    30,
  );

  assert.deepEqual(rows.map((row) => row.feeling), ['good']);
  assert.equal(rows[0].heartRate, 65);
});

test('recovery daily means use AUC and TTR recorded on the CAPAR episode', () => {
  const rows = groupRecoveryMetricsByDay([
    { start_at: '2026-10-05T18:00:00.000Z', deviation_auc: 2, recovery_time_ms: 60000 },
    { start_at: '2026-10-05T19:00:00.000Z', deviation_auc: 4, recovery_time_ms: null },
    { start_at: '2026-10-06T18:00:00.000Z', deviation_auc: null, recovery_time_ms: 120000 },
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].dateKey, '2026-10-06');
  assert.equal(rows[0].auc, 3);
  assert.equal(rows[0].ttrMinutes, 1);
  assert.equal(rows[0].episodes, 2);
  assert.equal(rows[1].auc, null);
  assert.equal(rows[1].ttrMinutes, 2);
});
