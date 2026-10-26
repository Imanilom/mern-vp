import test from 'node:test';
import assert from 'node:assert/strict';
import { describeMotionBaseline } from '../src/utils/baselineObservations.js';

function baseline(activity, mean) {
  return {
    activity,
    feature_stats: {
      motion_intensity: { mean },
    },
  };
}

test('compares baseline motion only against available personal contexts', () => {
  const baselines = [
    baseline('rest', 0.1),
    baseline('walking', 0.8),
    baseline('work', 0.4),
  ];

  assert.equal(describeMotionBaseline(baselines[0], baselines), 'ACC terendah antar konteks');
  assert.equal(describeMotionBaseline(baselines[1], baselines), 'ACC tertinggi antar konteks');
  assert.equal(describeMotionBaseline(baselines[2], baselines), 'Di antara baseline konteks lain');
});

test('does not infer movement tendency when there is no usable comparison', () => {
  assert.equal(
    describeMotionBaseline(baseline('rest', 0.1), [baseline('rest', 0.1)]),
    'Belum ada konteks pembanding',
  );
  assert.equal(
    describeMotionBaseline(baseline('rest', null), [baseline('rest', 0.1)]),
    'Data ACC belum tersedia',
  );
});

test('reports ties without ranking a context as more active', () => {
  const baselines = [baseline('rest', 0.2), baseline('work', 0.2)];
  assert.equal(
    describeMotionBaseline(baselines[0], baselines),
    'Setara antar konteks tersimpan',
  );
});
