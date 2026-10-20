import test from 'node:test';
import assert from 'node:assert/strict';
import { withWearableBaselineComparison } from '../utils/patientWearableHistory.js';

test('real wearable history matches the stored activity and local-time baseline', () => {
  const baselines = new Map([
    [
      'Rest:afternoon',
      {
        stats: { mean_hr: { mean: 72.5, n: 24 } },
        maturity_detail: { level: 'mature' },
      },
    ],
  ]);
  const result = withWearableBaselineComparison({
    recorded_at: new Date('2026-10-20T07:00:00.000Z'),
    activity: 'Duduk',
    heart_rate_bpm: 81,
    is_simulated: false,
  }, baselines);

  assert.deepEqual(result.baseline_comparison, {
    available: true,
    reason: null,
    activity: 'Rest',
    time_period: 'afternoon',
    baseline_level: 'mature',
    sample_count: 24,
    heart_rate_baseline_bpm: 72.5,
    delta_bpm: 8.5,
  });
});

test('simulated and empty baselines are never compared as clinical observations', () => {
  const baselines = new Map([
    ['Rest:afternoon', { stats: { mean_hr: { mean: 72, n: 0 } } }],
  ]);
  const simulated = withWearableBaselineComparison({
    recorded_at: new Date('2026-10-20T07:00:00.000Z'),
    activity: 'Duduk',
    heart_rate_bpm: 81,
    is_simulated: true,
  }, baselines);
  const noBaseline = withWearableBaselineComparison({
    recorded_at: new Date('2026-10-20T07:00:00.000Z'),
    activity: 'Duduk',
    heart_rate_bpm: 81,
    is_simulated: false,
  }, baselines);

  assert.equal(simulated.baseline_comparison.available, false);
  assert.equal(simulated.baseline_comparison.reason, 'simulated_data_excluded');
  assert.equal(noBaseline.baseline_comparison.available, false);
  assert.equal(noBaseline.baseline_comparison.heart_rate_baseline_bpm, null);
});
