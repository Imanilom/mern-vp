import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPatientRecoveryMarkovForecast } from '../utils/patientRecoveryMarkov.js';

test('CAPAR recovery forecast uses scoped transition counts and sums to 100 percent', () => {
  const result = buildPatientRecoveryMarkovForecast({
    currentState: 'RECOVERING',
    horizon: 3,
    transitions: [{
      from_RECOVERY: {
        to_RECOVERY: 4,
        to_RECOVERED: 16,
        to_PERSISTENT_DEVIATION: 2,
      },
      from_RECOVERED: {
        to_RECOVERED: 10,
        to_BASELINE_COMPATIBLE: 4,
      },
      total_transitions: 36,
    }],
  });

  assert.equal(result.status, 'available');
  assert.equal(result.current_state, 'RECOVERY');
  assert.equal(result.observed_transitions, 36);
  assert.equal(
    result.probabilities.recovered_or_baseline_compatible
      + result.probabilities.further_observation,
    100,
  );
  assert.equal(result.insufficient_data_pct, null);
});

test('CAPAR recovery forecast abstains without observed transitions from current state', () => {
  const result = buildPatientRecoveryMarkovForecast({
    currentState: 'PERSISTENT_DEVIATION',
    transitions: [{
      from_BASELINE_COMPATIBLE: {
        to_BASELINE_COMPATIBLE: 10,
        to_DEVIATION_CANDIDATE: 2,
      },
      total_transitions: 12,
    }],
  });

  assert.equal(result.status, 'insufficient_data');
  assert.equal(result.probabilities, null);
  assert.match(result.reason, /state PERSISTENT_DEVIATION/);
});

test('CAPAR recovery forecast does not expose a prior-only estimate for sparse data', () => {
  const result = buildPatientRecoveryMarkovForecast({
    currentState: 'RECOVERY',
    transitions: [{
      from_RECOVERY: { to_RECOVERY: 4 },
      total_transitions: 4,
    }],
  });

  assert.equal(result.status, 'insufficient_data');
  assert.equal(result.probabilities, null);
  assert.match(result.reason, /ambang pembelajaran 10/);
});

test('CAPAR recovery forecast never invents probabilities when state data is missing', () => {
  const result = buildPatientRecoveryMarkovForecast({
    currentState: 'Alert',
    transitions: [],
  });

  assert.equal(result.status, 'insufficient_data');
  assert.equal(result.probabilities, null);
  assert.equal(result.insufficient_data_pct, undefined);
});
