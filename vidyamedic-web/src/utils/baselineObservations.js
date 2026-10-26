import { numberOrNull } from './formatters.js';

export function describeMotionBaseline(baseline, baselines) {
  const value = numberOrNull(baseline?.feature_stats?.motion_intensity?.mean);
  if (value == null) return 'Data ACC belum tersedia';

  const values = (baselines || [])
    .map((item) => numberOrNull(item.feature_stats?.motion_intensity?.mean))
    .filter((item) => item != null);

  if (values.length < 2) return 'Belum ada konteks pembanding';

  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (Math.abs(maximum - minimum) < 1e-9) return 'Setara antar konteks tersimpan';
  if (Math.abs(value - maximum) < 1e-9) return 'ACC tertinggi antar konteks';
  if (Math.abs(value - minimum) < 1e-9) return 'ACC terendah antar konteks';
  return 'Di antara baseline konteks lain';
}
