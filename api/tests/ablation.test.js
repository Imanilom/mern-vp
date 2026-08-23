/**
 * ablation.test.js
 *
 * Unit test suite for E1–E6 Ablation Framework
 * Tests:
 *  - E1 (Global, Non-Context)
 *  - E2 (Global + Context)
 *  - E3 (Personal, Non-Context)
 *  - E4 (Personal + Context)
 *  - E5 (Quality Gating / Abstention)
 *  - E6 (Temporal FSM: Persistence, Hysteresis, Dwell, Recovery, Relapse)
 */

import assert from 'assert';
import {
  evaluateE1,
  evaluateE2,
  evaluateE3,
  evaluateE4,
  evaluateE5,
  TemporalFSM,
  DEFAULT_ABLATION_CONFIG,
  computeDirectionalDeviation
} from '../utils/ablationEngine.js';

console.log('----------------------------------------------------');
console.log('         RUNNING ABLATION E1–E6 UNIT TESTS          ');
console.log('----------------------------------------------------\n');

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ FAIL: ${name}`);
    console.error(`  Error: ${err.message}`);
  }
}

// 1. Test Directional Deviation Formula
test('Directional Deviation: dHR = max(0, Z_HR), dRMSSD = max(0, -Z_RMSSD), dDFA = |Z_DFA|', () => {
  const d = computeDirectionalDeviation(2.0, -1.5, 0.8, 0);
  // (2.0 + 1.5 + 0.8) / 3 = 4.3 / 3 = 1.433
  assert.strictEqual(d, 1.433);
});

// 2. Test E1 (Global, Non-Context)
test('E1 Model: Uses global priors, ignores context and personal baseline', () => {
  const features = { mean_hr: 95.0, rmssd: 18.0, dfa_alpha1: 0.70 };
  const res = evaluateE1(features, DEFAULT_ABLATION_CONFIG);
  assert.ok(typeof res.score === 'number');
  assert.ok(res.pred === '1' || res.pred === '0');
});

// 3. Test E2 (Global + Context)
test('E2 Model: Uses global context priors, differentiates sitting vs running', () => {
  const features = { mean_hr: 95.0, rmssd: 18.0, dfa_alpha1: 0.70 };
  const resSit = evaluateE2(features, 'sitting', DEFAULT_ABLATION_CONFIG);
  const resRun = evaluateE2(features, 'running', DEFAULT_ABLATION_CONFIG);
  assert.notStrictEqual(resSit.score, resRun.score);
});

// 4. Test E3 (Personal, Non-Context)
test('E3 Model: Uses personal baseline stats, ignores context label', () => {
  const features = { mean_hr: 85.0, rmssd: 25.0, dfa_alpha1: 0.90 };
  const personalBaseline = {
    stats: {
      mean_hr: { mean: 80.0, std: 5.0 },
      rmssd: { mean: 30.0, std: 8.0 },
      dfa_alpha1: { mean: 1.0, std: 0.1 }
    }
  };
  const res = evaluateE3(features, personalBaseline, DEFAULT_ABLATION_CONFIG);
  assert.ok(res.score > 0);
});

// 5. Test E4 (Personal + Context)
test('E4 Model: Combines personal context baseline and delta HR adjustment', () => {
  const features = { mean_hr: 105.0, rmssd: 15.0, dfa_alpha1: 0.75 };
  const personalCtxBaseline = {
    stats: {
      mean_hr: { mean: 70.0, std: 5.0 },
      rmssd: { mean: 35.0, std: 8.0 },
      dfa_alpha1: { mean: 1.05, std: 0.1 }
    }
  };
  const res = evaluateE4(features, personalCtxBaseline, DEFAULT_ABLATION_CONFIG);
  assert.ok(res.score > 1.5);
  assert.strictEqual(res.pred, '1');
});

// 6. Test E5 (Quality Gating / Abstention)
test('E5 Model: Returns ABSTAIN_QUALITY when Q < Qmin, returns E4 decision when Q >= Qmin', () => {
  const e4 = { score: 2.1, pred: '1' };
  const abstainRes = evaluateE5(e4, 0.50, DEFAULT_ABLATION_CONFIG);
  assert.strictEqual(abstainRes.pred, 'ABSTAIN_QUALITY');
  assert.strictEqual(abstainRes.qualityPass, false);

  const passRes = evaluateE5(e4, 0.90, DEFAULT_ABLATION_CONFIG);
  assert.strictEqual(passRes.pred, '1');
  assert.strictEqual(passRes.qualityPass, true);
});

// 7. Test E6 (Temporal FSM: Persistence requirement m=3)
test('E6 FSM: Single window anomaly does NOT trigger PERSISTENT_DEVIATION state', () => {
  const fsm = new TemporalFSM(DEFAULT_ABLATION_CONFIG);
  const highE5 = { score: 2.2, status: 'VALID', evaluated: true };
  const step1 = fsm.step(highE5);
  assert.strictEqual(step1.state, 'CANDIDATE');
  assert.strictEqual(fsm.currentState, 'CANDIDATE');
});

// 8. Test E6 (Temporal FSM: Persistence threshold met after m consecutive windows)
test('E6 FSM: m=3 consecutive anomaly windows transitions to PERSISTENT_DEVIATION', () => {
  const fsm = new TemporalFSM(DEFAULT_ABLATION_CONFIG);
  const highE5 = { score: 2.2, status: 'VALID', evaluated: true };

  fsm.step(highE5); // Step 1: CANDIDATE
  fsm.step(highE5); // Step 2: CANDIDATE
  const step3 = fsm.step(highE5); // Step 3: PERSISTENT_DEVIATION

  assert.strictEqual(step3.state, 'PERSISTENT_DEVIATION');
  assert.strictEqual(step3.reason, 'PERSISTENCE_MET');
});

// 9. Test E6 (Temporal FSM: Hysteresis exit and Recovery transition)
test('E6 FSM: Deviation below tau_exit enters RECOVERY_START, dwell windows leads to RECOVERED', () => {
  const fsm = new TemporalFSM(DEFAULT_ABLATION_CONFIG);
  const highE5 = { score: 2.2, status: 'VALID', evaluated: true };
  const normalE5 = { score: 0.6, status: 'VALID', evaluated: true };

  // Trigger PERSISTENT
  fsm.step(highE5);
  fsm.step(highE5);
  fsm.step(highE5);

  // Additional dwell in PERSISTENT
  fsm.step(highE5);

  // Transition to RECOVERY_START
  const stepRec = fsm.step(normalE5);
  assert.strictEqual(stepRec.state, 'RECOVERY_START');

  // Recovery Dwell steps to RECOVERED
  fsm.step(normalE5);
  const stepDone = fsm.step(normalE5);
  assert.strictEqual(stepDone.state, 'RECOVERED');
});

console.log(`\nResults: ${passed}/${total} tests passed.\n`);
if (passed !== total) {
  process.exit(1);
}
