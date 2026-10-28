import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLogRow } from '../utils/validateLog.js';

const validRow = {
  timestamp: 1710000000,
  hr: 72,
  rr: 910,
  activity: 'Duduk',
};

test('CSV log validation does not substitute RR interval for missing RMSSD', () => {
  const { valid, data } = validateLogRow(validRow, '6a8f9fab74156d89d1dc3c47');
  assert.equal(valid, true);
  assert.equal(data.rrms, null);
});

test('CSV log validation preserves supplied zero RMSSD', () => {
  const { valid, data } = validateLogRow(
    { ...validRow, rrms: 0 },
    '6a8f9fab74156d89d1dc3c47'
  );
  assert.equal(valid, true);
  assert.equal(data.rrms, 0);
});
