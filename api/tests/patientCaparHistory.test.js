import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePatientCaparHistoryQuery } from '../utils/patientCaparHistory.js';

test('CAPAR history query defaults to a paginated all-category response', () => {
  assert.deepEqual(parsePatientCaparHistoryQuery(), {
    category: 'all',
    limit: 25,
    cursor: null,
  });
});

test('CAPAR history query accepts supported category, page size, and cursor', () => {
  assert.deepEqual(
    parsePatientCaparHistoryQuery({
      category: 'recovery',
      limit: '50',
      before: '1792390000000:6a8f9fab74156d89d1dc3c47',
    }),
    {
      category: 'recovery',
      limit: 50,
      cursor: {
        timestamp: 1792390000000,
        id: '6a8f9fab74156d89d1dc3c47',
      },
    }
  );
});

test('CAPAR history query rejects unknown categories, invalid limits, and malformed cursors', () => {
  assert.equal(
    parsePatientCaparHistoryQuery({ category: 'raw_passwords' }),
    null
  );
  assert.equal(parsePatientCaparHistoryQuery({ limit: '0' }), null);
  assert.equal(parsePatientCaparHistoryQuery({ limit: '101' }), null);
  assert.equal(
    parsePatientCaparHistoryQuery({ before: 'not-a-cursor' }),
    null
  );
  assert.equal(
    parsePatientCaparHistoryQuery({ before: '1792390000000:not-an-object-id' }),
    null
  );
});

test('CAPAR history query accepts the learning category', () => {
  assert.equal(
    parsePatientCaparHistoryQuery({ category: 'learning' })?.category,
    'learning'
  );
});
