import test from 'node:test';
import assert from 'node:assert/strict';
import { fitPatientBayesianEventState } from '../utils/patientBayesianEventState.js';

function samples(count, heartRate) {
  return Array.from({ length: count }, (_, index) => ({
    recorded_at: index,
    features: {
      mean_hr: heartRate + (index % 5) * 0.1,
      rmssd: 40 - (heartRate - 70) + (index % 7) * 0.1,
      dfa_alpha1: 0.9 + (index % 3) * 0.01,
    },
  }));
}

test('fits a per-context Bayesian candidate and reports chronological holdout validation', () => {
  const model = fitPatientBayesianEventState({
    stableSamples: samples(100, 70),
    deviationSamples: samples(100, 95),
  });

  assert.equal(model.method, 'personal_gaussian_naive_bayes');
  assert.equal(model.status, 'validation_required');
  assert.deepEqual(model.training_samples, { stable: 80, deviation: 80 });
  assert.deepEqual(model.validation_samples, { stable: 20, deviation: 20 });
  assert.ok(model.validation.brier_score < 0.01);
  assert.equal(model.distribution, null);
  assert.equal('posterior_probability' in model, false);
});

test('withholds model output when either CAPAR label class is too small', () => {
  const model = fitPatientBayesianEventState({
    stableSamples: samples(100, 70),
    deviationSamples: samples(20, 95),
  });

  assert.equal(model.status, 'insufficient_data');
  assert.equal(model.distribution, null);
  assert.match(model.reason, /Insufficient/);
});
