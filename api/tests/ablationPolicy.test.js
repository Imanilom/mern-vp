import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAblationConfig,
  DEFAULT_ABLATION_CONFIG,
  evaluateAllAblations,
  evaluateE3,
  computeAblationMetrics,
} from '../utils/ablationEngine.js';
import { getPatientDecisionPolicy } from '../config/patientDecisionPolicies.js';

test('ablation defaults carry placeholder provenance for every threshold', () => {
  assert.equal(DEFAULT_ABLATION_CONFIG.policy.status, 'NON-CLINICAL / PLACEHOLDER');
  for (const policy of DEFAULT_ABLATION_CONFIG.policy.rules) {
    assert.ok(policy.policy_id);
    assert.ok(policy.rule_id);
    assert.ok(policy.version);
    assert.ok(policy.source);
    assert.ok(policy.rationale);
    assert.ok(policy.effective_date);
    assert.equal(policy.confidence, 0);
    assert.equal(policy.status, 'NON-CLINICAL / PLACEHOLDER');
  }
});

test('ablation override requires complete provenance and reports its actual value', () => {
  const defaultPolicy = getPatientDecisionPolicy('ablation_tau');
  assert.throws(() => createAblationConfig({
    ablation_tau: { value: 2 },
  }), /missing/);

  const config = createAblationConfig({
    ablation_tau: { ...defaultPolicy, value: 2 },
  });
  assert.equal(config.tau, 2);
  assert.equal(
    config.policy.rules.find((rule) => rule.rule_id === 'ablation_tau').value,
    2
  );
});

test('episode ablation abstains instead of turning missing signals into normal scores', () => {
  const result = evaluateAllAblations({ features: {} });
  assert.equal(result.E1.score, null);
  assert.equal(result.E1.pred, 'ABSTAIN_MISSING_FEATURES');
  assert.equal(result.E3.pred, 'ABSTAIN_MISSING_FEATURES');
  assert.equal(result.E5.evaluated, false);
  assert.ok(result.policy);
});

test('personalized ablation abstains without a real personal baseline', () => {
  const features = { mean_hr: 85, rmssd: 25, dfa_alpha1: 0.9 };
  assert.equal(evaluateE3(features, null).pred, 'ABSTAIN_MISSING_BASELINE');
});

test('unlabeled episode records do not produce fabricated classification metrics', () => {
  const metrics = computeAblationMetrics([
    { y_true: null, pred_E1: '1', pred_E2: '0' },
  ]);
  assert.equal(metrics.E1.total, 0);
  assert.equal(metrics.E1.precision, null);
  assert.equal(metrics.E1.accuracy, null);
  assert.equal(metrics.deltas.delta_context, null);
});
