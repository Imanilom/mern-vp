import test from 'node:test';
import assert from 'node:assert/strict';
import {
  explainPatientDeviation,
  attributePatientContext,
  isPatientCaparNocturnalTime,
  mapPatientContextToRagAxes,
  patientCaparTimePeriod,
} from '../utils/patientDeviationExplanation.js';

const baseline = {
  stats: {
    mean_hr: { n: 50, mean: 70, std: 5 },
    delta_hr: { n: 50, mean: 15, std: 5 },
    slope_hr: { n: 50, mean: 0, std: 1 },
    sdnn: { n: 50, mean: 50, std: 10 },
    rmssd: { n: 50, mean: 40, std: 10 },
    dfa_alpha1: { n: 50, mean: 1, std: 0.1 },
    motion_intensity: { n: 50, mean: 0.1, std: 0.05 },
  },
};

test('deviation explanation reports signed z-scores and Mahalanobis contributors', () => {
  const mahalanobis = {
    features: [
      { feature: 'mean_hr', contribution: 2.5, contribution_share: 0.6 },
      { feature: 'sdnn', contribution: 1.25, contribution_share: 0.3 },
      { feature: 'rmssd', contribution: 0.4, contribution_share: 0.1 },
    ],
  };
  const result = explainPatientDeviation({
    hr_mean: 80,
    hr_delta: 20,
    hr_slope: 0,
    sdnn: 30,
    rmssd: 20,
    dfa_alpha1: 1,
    motion_index: 0.1,
  }, baseline, {
    mahalanobis,
    previousFeatures: { hr_mean: 76 },
    elapsedMinutes: 2,
  });
  assert.equal(result.status, 'available');
  assert.equal(result.factors[0].feature, 'hr_mean');
  assert.equal(result.factors[0].z_score, 2);
  assert.equal(result.factors[0].contribution_share, 0.6);
  assert.equal(result.factors[0].recent_change_per_minute, 2);
  assert.equal(result.factors.find((factor) => factor.feature === 'rmssd').z_score, -2);
  assert.equal(result.factors.find((factor) => factor.feature === 'sdnn').z_score, -2);
  assert.equal(
    result.contribution_method,
    'delta_i_times_inverse_covariance_delta_i'
  );
});

test('deviation explanation abstains when comparable CAPAR features are missing', () => {
  const result = explainPatientDeviation({ hr_mean: 80 }, baseline);
  assert.equal(result.status, 'insufficient_data');
  assert.equal(result.reason, 'too_few_comparable_features');
  assert.deepEqual(result.factors, []);
});

test('deviation explanation does not invent a contributor when available features are not deviating', () => {
  const result = explainPatientDeviation({
    hr_mean: 70,
    hr_delta: 15,
    hr_slope: 0,
    sdnn: 50,
    rmssd: 40,
    dfa_alpha1: 1,
    motion_index: 0.1,
  }, baseline);
  assert.equal(result.status, 'unexplained');
  assert.equal(result.reason, 'no_feature_change_from_personal_baseline');
  assert.deepEqual(result.factors, []);
});

test('context attribution reports association hypotheses without causal claims', () => {
  const result = attributePatientContext({
    factors: [{ feature: 'hr_mean', z_score: 2 }],
    contexts: [{ type: 'mental_stress' }, { type: 'sleep_duration' }],
  });
  assert.equal(result.status, 'hypotheses_available');
  assert.equal(result.candidates[0].type, 'stress');
  assert.equal(result.candidates[0].association, 'consistent_with');
  assert.equal(result.candidates[0].causal_claim, false);
  assert.equal(result.elevated_heart_rate_without_motion, true);
});

test('RAG axes are derived only from observed context and physiological factors', () => {
  assert.deepEqual(
    mapPatientContextToRagAxes([
      { type: 'physical_activity' },
      { type: 'caffeine' },
      { type: 'rmssd' },
      { type: 'recovery' },
      { type: 'sleep_duration', time_context: 'nocturnal_sleep' },
    ]),
    {
      behavior: ['physical_activity', 'caffeine', 'sleep_duration'],
      physiology: ['rmssd', 'recovery'],
      caparDimension: ['AR', 'RC'],
      timeContext: ['nocturnal_sleep'],
    }
  );
});

test('baseline contexts use the CAPAR WIB timezone', () => {
  assert.equal(patientCaparTimePeriod(Date.parse('2026-10-05T00:00:00.000Z')), 'morning');
  assert.equal(patientCaparTimePeriod(Date.parse('2026-10-05T12:30:00.000Z')), 'evening');
  assert.equal(isPatientCaparNocturnalTime(Date.parse('2026-10-05T00:00:00.000Z')), false);
  assert.equal(isPatientCaparNocturnalTime(Date.parse('2026-10-05T12:30:00.000Z')), true);
});
