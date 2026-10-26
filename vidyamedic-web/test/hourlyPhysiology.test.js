import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHourlySeries } from '../src/utils/hourlyPhysiology.js';

test('builds a 24-hour series from real readings recorded today', () => {
  const now = new Date(2026, 9, 26, 12);
  const samples = [
    {
      recorded_at: new Date(2026, 9, 26, 9).toISOString(),
      heart_rate_bpm: 100,
      sample_count: 2,
    },
    {
      recorded_at: new Date(2026, 9, 26, 9, 30).toISOString(),
      heart_rate_bpm: 70,
      sample_count: 1,
    },
    {
      recorded_at: new Date(2026, 9, 26, 9, 45).toISOString(),
      heart_rate_bpm: 190,
      is_simulated: true,
    },
    {
      recorded_at: new Date(2026, 9, 25, 9).toISOString(),
      heart_rate_bpm: 60,
    },
  ];

  const result = buildHourlySeries(samples, 'heart_rate_bpm', now);

  assert.equal(result.points.length, 24);
  assert.equal(result.mode, 'today');
  assert.equal(result.points[9].value, 90);
  assert.equal(result.points[8].value, null);
  assert.equal(result.readingCount, 2);
});

test('falls back to weighted hourly averages across days with data', () => {
  const now = new Date(2026, 9, 26, 12);
  const samples = [
    {
      recorded_at: new Date(2026, 9, 25, 7).toISOString(),
      rmssd_ms: 80,
      sample_count: 3,
    },
    {
      recorded_at: new Date(2026, 9, 24, 7, 30).toISOString(),
      rmssd_ms: 100,
      sample_count: 1,
    },
    {
      recorded_at: new Date(2026, 9, 26, 8).toISOString(),
      heart_rate_bpm: 75,
    },
    {
      recorded_at: new Date(2026, 9, 25, 7).toISOString(),
      rmssd_ms: 500,
      is_simulated: true,
    },
  ];

  const result = buildHourlySeries(samples, 'rmssd_ms', now);

  assert.equal(result.mode, 'historical');
  assert.equal(result.points[7].value, 85);
  assert.equal(result.points[7].days, 2);
  assert.equal(result.contributingDays, 2);
  assert.equal(result.points[8].value, null);
});
