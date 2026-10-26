import { numberOrNull } from './formatters.js';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function localDayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function buildHourlySeries(samples, field, now = new Date()) {
  const realSamples = samples.filter((sample) => !sample.is_simulated);
  const todayKey = localDayKey(now);
  const todays = realSamples.filter(
    (sample) => localDayKey(sample.recorded_at) === todayKey,
  );
  const todayReadings = todays
    .map((sample) => ({
      hour: new Date(sample.recorded_at).getHours(),
      value: numberOrNull(sample[field]),
      weight: Math.max(1, numberOrNull(sample.sample_count) || 1),
    }))
    .filter((item) => item.value != null);

  const useToday = todayReadings.length > 0;
  const source = useToday
    ? todayReadings
    : realSamples
      .map((sample) => ({
        day: localDayKey(sample.recorded_at),
        hour: new Date(sample.recorded_at).getHours(),
        value: numberOrNull(sample[field]),
        weight: Math.max(1, numberOrNull(sample.sample_count) || 1),
      }))
      .filter((item) => item.day && item.value != null);

  const buckets = new Map(HOURS.map((hour) => [hour, { total: 0, weight: 0, days: new Set() }]));
  for (const item of source) {
    const bucket = buckets.get(item.hour);
    bucket.total += item.value * item.weight;
    bucket.weight += item.weight;
    if (item.day) bucket.days.add(item.day);
  }
  const contributingDays = new Set(
    source.map((item) => item.day).filter(Boolean),
  ).size;

  return {
    points: HOURS.map((hour) => {
      const bucket = buckets.get(hour);
      return {
        hour,
        value: bucket.weight ? bucket.total / bucket.weight : null,
        days: bucket.days.size,
      };
    }),
    mode: useToday ? 'today' : 'historical',
    contributingDays,
    readingCount: source.length,
  };
}
