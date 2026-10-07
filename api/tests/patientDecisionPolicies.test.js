import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPatientDecisionPolicy,
  getPatientDecisionPolicyBundle,
  PATIENT_DECISION_POLICIES,
} from '../config/patientDecisionPolicies.js';

test('every configured patient decision rule has required provenance and placeholder status', () => {
  assert.ok(Object.keys(PATIENT_DECISION_POLICIES).length > 0);
  for (const rule of Object.values(PATIENT_DECISION_POLICIES)) {
    assert.equal(typeof rule.policy_id, 'string');
    assert.equal(typeof rule.rule_id, 'string');
    assert.equal(typeof rule.version, 'string');
    assert.equal(typeof rule.source, 'string');
    assert.equal(typeof rule.rationale, 'string');
    assert.match(rule.effective_date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(rule.confidence, 0);
    assert.equal(rule.status, 'NON-CLINICAL / PLACEHOLDER');
    assert.notEqual(rule.value, undefined);
  }
});

test('policy bundles include complete rules and reject incomplete overrides', () => {
  const bundle = getPatientDecisionPolicyBundle([
    'red_flag_chest_pain_enabled',
    'red_flag_symptom_severity_min',
  ]);
  assert.equal(bundle.status, 'NON-CLINICAL / PLACEHOLDER');
  assert.deepEqual(
    bundle.rules.map((rule) => rule.rule_id),
    ['red_flag_chest_pain_enabled', 'red_flag_symptom_severity_min']
  );

  assert.throws(
    () => getPatientDecisionPolicy('red_flag_symptom_severity_min', {
      red_flag_symptom_severity_min: { value: 8 },
    }),
    /missing/
  );
});

test('policy override requires a valid effective date and bounded confidence', () => {
  const current = getPatientDecisionPolicy('red_flag_symptom_severity_min');
  assert.throws(
    () => getPatientDecisionPolicy('red_flag_symptom_severity_min', {
      red_flag_symptom_severity_min: { ...current, effective_date: '2026-02-31' },
    }),
    /effective_date/
  );
  assert.throws(
    () => getPatientDecisionPolicy('red_flag_symptom_severity_min', {
      red_flag_symptom_severity_min: { ...current, confidence: 1.1 },
    }),
    /confidence/
  );
});
