import test from 'node:test';
import assert from 'node:assert/strict';
import { PATIENT_DECISION_POLICIES } from '../config/patientDecisionPolicies.js';
import {
  applyProvisionalTauFallback,
  computeTauFromStableScores,
} from '../utils/capar.thresholds.js';

test('CAPAR configured fallback carries policy metadata and uses central policy values', () => {
  const result = computeTauFromStableScores([]);
  assert.equal(result.source, 'configured');
  assert.equal(result.tau_in, PATIENT_DECISION_POLICIES.capar_default_tau_in.value);
  assert.equal(result.policy_status, 'NON-CLINICAL / PLACEHOLDER');
  assert.ok(result.policy.rules.some(
    (rule) => rule.rule_id === 'capar_tau_in_quantile'
  ));
});

test('CAPAR provisional fallback exposes the formula provenance', () => {
  const result = applyProvisionalTauFallback(
    computeTauFromStableScores([]),
    { mean_hr: { std: 2 } }
  );
  assert.equal(result.source, 'provisional');
  assert.equal(result.tau_in, 1.66);
  assert.equal(result.tau_out, 1.08);
  assert.equal(result.tau_normal, 0.75);
  assert.ok(result.policy.rules.some(
    (rule) => rule.rule_id === 'capar_provisional_tau_in_hr_std_weight'
  ));
});

test('CAPAR overrides require full policy provenance and legacy numeric options fail explicitly', () => {
  assert.throws(
    () => computeTauFromStableScores([], { min_stable_scores: 10 }),
    /policyOverrides with provenance/
  );

  const result = computeTauFromStableScores([], {
    policyOverrides: {
      capar_default_tau_in: {
        ...PATIENT_DECISION_POLICIES.capar_default_tau_in,
        value: 2,
      },
    },
  });
  assert.equal(result.tau_in, 2);
  assert.equal(result.policy.rules.find(
    (rule) => rule.rule_id === 'capar_default_tau_in'
  ).value, 2);
});
