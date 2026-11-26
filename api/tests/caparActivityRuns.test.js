import test from 'node:test';
import assert from 'node:assert/strict';
import { groupChronologicalActivityRuns } from '../../vidyamedic-web/src/utils/caparActivityRuns.js';

const start = Date.parse('2026-11-26T00:00:00.000Z');

function group(windows) {
  return groupChronologicalActivityRuns(windows, {
    getActivity: (window) => window.activity,
    getTime: (window) => window.start,
    getEndTime: (window) => window.end,
    getStreamKey: (window) => `${window.device}:${window.type}`,
    getMaxGap: (_previous, next) => (next.type === '1min' ? 60_000 : 300_000),
  });
}

test('activity runs follow timestamp order and repeat activities form separate groups', () => {
  const windows = [
    { _id: 'walk', activity: 'Berjalan', device: 'polar', type: '1min', start: start + 60 * 60_000, end: start + 2 * 60 * 60_000 },
    { _id: 'sit-later', activity: 'Duduk', device: 'polar', type: '1min', start: start + 2 * 60 * 60_000, end: start + 3 * 60 * 60_000 },
    { _id: 'sit-first', activity: 'Duduk', device: 'polar', type: '1min', start, end: start + 60 * 60_000 },
  ];

  const runs = group(windows);
  assert.deepEqual(runs.map((run) => run.activity), ['Duduk', 'Berjalan', 'Duduk']);
  assert.deepEqual(runs.map((run) => run.entries.map((entry) => entry._id)), [
    ['sit-first'],
    ['walk'],
    ['sit-later'],
  ]);
});

test('adjacent equal activities merge, while long gaps and separate streams create new runs', () => {
  const windows = [
    { _id: 'a', activity: 'Duduk', device: 'polar', type: '1min', start, end: start + 60_000 },
    { _id: 'b', activity: 'Duduk', device: 'polar', type: '1min', start: start + 60_000, end: start + 120_000 },
    { _id: 'c', activity: 'Duduk', device: 'polar', type: '1min', start: start + 10 * 60_000, end: start + 11 * 60_000 },
    { _id: 'd', activity: 'Duduk', device: 'other', type: '1min', start: start + 11 * 60_000, end: start + 12 * 60_000 },
  ];

  const runs = group(windows);
  assert.deepEqual(runs.map((run) => run.entries.map((entry) => entry._id)), [
    ['a', 'b'],
    ['c'],
    ['d'],
  ]);
});
