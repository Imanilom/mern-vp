import { patientCaparTimePeriod } from './patientDeviationExplanation.js';

function activityBaselineClass(activity, intensity = 'unknown') {
  const normalized = String(activity ?? '').trim().toLowerCase();
  if (
    [
      'rest',
      'sitting',
      'standing',
      'sleep',
      'duduk',
      'berdiri',
      'tidur',
      'berbaring',
      'istirahat',
    ].includes(normalized)
  ) {
    return 'Rest';
  }
  if (normalized === 'walking' || normalized.includes('berjalan')) {
    return normalized.includes('cepat') || intensity === 'vigorous'
      ? 'Moderate'
      : 'Light';
  }
  if (
    ['running', 'exercise', 'berlari', 'lari cepat', 'olahraga berat'].includes(
      normalized
    )
  ) {
    if (
      intensity === 'vigorous'
      || normalized === 'lari cepat'
      || normalized === 'olahraga berat'
    ) {
      return 'Intense';
    }
    return intensity === 'low' ? 'Light' : 'Moderate';
  }
  return ['Rest', 'Light', 'Moderate', 'Intense'].includes(activity)
    ? activity
    : 'Unknown';
}

export function withWearableBaselineComparison(item, baselineByContext) {
  if (item.is_simulated) {
    return {
      ...item,
      baseline_comparison: {
        available: false,
        reason: 'simulated_data_excluded',
      },
    };
  }

  const activity = activityBaselineClass(
    item.activity,
    item.activity_intensity
  );
  const timePeriod = patientCaparTimePeriod(item.recorded_at);
  const baseline = baselineByContext.get(`${activity}:${timePeriod}`);
  const baselineHr = baseline?.stats?.mean_hr?.mean;
  const baselineSampleCount = baseline?.stats?.mean_hr?.n ?? 0;
  const available = Number.isFinite(baselineHr)
    && Number.isFinite(baselineSampleCount)
    && baselineSampleCount > 0;

  return {
    ...item,
    baseline_comparison: {
      available,
      reason: available ? null : 'matching_baseline_unavailable',
      activity,
      time_period: timePeriod,
      baseline_level: baseline?.maturity_detail?.level ?? null,
      sample_count: baselineSampleCount,
      heart_rate_baseline_bpm: available ? baselineHr : null,
      delta_bpm: available && Number.isFinite(item.heart_rate_bpm)
        ? Number((item.heart_rate_bpm - baselineHr).toFixed(2))
        : null,
    },
  };
}
