import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computePatientMahalanobis,
  fitPatientMahalanobisModel,
  scorePatientMahalanobis,
} from '../utils/patientMahalanobis.js';

const baseline = Array.from({ length: 40 }, (_, index) => {
  const offset = index - 19.5;
  return [70 + offset * 0.2, 1 + offset * 0.01];
});

test('Mahalanobis score is near zero at the baseline mean and finite for correlated features', () => {
  const center = [
    baseline.reduce((sum, sample) => sum + sample[0], 0) / baseline.length,
    baseline.reduce((sum, sample) => sum + sample[1], 0) / baseline.length,
  ];
  const result = computePatientMahalanobis(center, baseline);
  assert.equal(result.status, 'computed');
  assert.ok(result.distance_squared < 1e-8);
  assert.equal(result.degrees_of_freedom, 2);
});

test('Mahalanobis score declines to classify without enough baseline samples', () => {
  const result = computePatientMahalanobis([70, 1], baseline.slice(0, 29));
  assert.equal(result.status, 'insufficient_data');
  assert.equal(result.baseline_samples, 29);
});

test('Mahalanobis score refuses a degenerate baseline', () => {
  const result = computePatientMahalanobis(
    [70, 1],
    Array.from({ length: 30 }, () => [70, 1])
  );
  assert.equal(result.status, 'insufficient_data');
  assert.equal(result.reason, 'baseline_variance_too_low');
});

test('multivariate score decomposes squared Mahalanobis distance into feature contributions', () => {
  const featureKeys = ['mean_hr', 'mean_rr', 'rmssd'];
  const samples = Array.from({ length: 60 }, (_, index) => {
    const offset = index - 29.5;
    return {
      mean_hr: 70 + offset * 0.2,
      mean_rr: 850 - offset * 1.5,
      rmssd: 40 + offset * 0.3,
    };
  });
  const model = fitPatientMahalanobisModel(samples, featureKeys);
  const result = scorePatientMahalanobis({
    mean_hr: 80,
    mean_rr: 800,
    rmssd: 25,
  }, model);

  assert.equal(result.available, true);
  assert.equal(result.feature_keys.length, 3);
  assert.ok(result.distance > 0);
  assert.ok(Math.abs(
    result.features.reduce((sum, feature) => sum + feature.contribution, 0)
    - result.squared_distance
  ) < 1e-8);
  assert.ok(Math.abs(
    result.features.reduce((sum, feature) => sum + feature.contribution_share, 0)
    - 1
  ) < 1e-8);
});

test('multivariate score abstains when baseline features or current values are incomplete', () => {
  const model = fitPatientMahalanobisModel(
    Array.from({ length: 40 }, (_, index) => ({
      hr: 60 + index,
      rmssd: index % 2 ? 30 + index : null,
    })),
    ['hr', 'rmssd']
  );
  assert.equal(model.available, false);
  assert.equal(model.reason, 'insufficient_baseline');

  const completeModel = fitPatientMahalanobisModel(
    baseline.map(([hr, dfa]) => ({ hr, dfa })),
    ['hr', 'dfa']
  );
  assert.equal(
    scorePatientMahalanobis({ hr: 70 }, completeModel).reason,
    'incomplete_current_features'
  );
});
