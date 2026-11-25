import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRecoveryTime,
  recoveryHeartRate,
} from './caparDynamicRecovery.js';

test('first-order recovery curve starts at initial HR and decays by one tau', () => {
  assert.equal(recoveryHeartRate(0, 75, 135, 3), 135);
  assert.ok(Math.abs(recoveryHeartRate(3, 75, 135, 3) - (75 + (60 / Math.E))) < 1e-10);
});

test('time-to-recovery uses the selected tolerance and returns zero within band', () => {
  const time = calculateRecoveryTime(75, 135, 3, 10);
  assert.ok(Math.abs(recoveryHeartRate(time, 75, 135, 3) - 85) < 1e-10);
  assert.equal(calculateRecoveryTime(75, 80, 3, 10), 0);
});

test('recovery calculations reject invalid model parameters', () => {
  assert.throws(() => recoveryHeartRate(1, 75, 135, 0), RangeError);
  assert.throws(() => calculateRecoveryTime(75, 135, 3, 0), RangeError);
});
