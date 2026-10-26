import { numberOrNull } from './formatters.js';

const CIRCADIAN_PERIODS = [
  { key: 'night', label: 'Malam', start: 0, end: 6 },
  { key: 'morning', label: 'Pagi', start: 6, end: 12 },
  { key: 'afternoon', label: 'Siang', start: 12, end: 18 },
  { key: 'evening', label: 'Sore / malam', start: 18, end: 24 },
];

const JAKARTA_HOUR_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jakarta',
  hour: '2-digit',
  hourCycle: 'h23',
});
const JAKARTA_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function hourInJakarta(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const hour = JAKARTA_HOUR_FORMATTER.format(date);
  return Number(hour);
}

function summarize(samples) {
  const result = { heartRate: 0, heartRateWeight: 0, rmssd: 0, rmssdWeight: 0, records: 0 };
  for (const sample of samples) {
    const weight = Math.max(1, numberOrNull(sample.sample_count) || 1);
    const heartRate = numberOrNull(sample.heart_rate_bpm);
    const rmssd = numberOrNull(sample.rmssd_ms);
    if (heartRate != null) {
      result.heartRate += heartRate * weight;
      result.heartRateWeight += weight;
    }
    if (rmssd != null && rmssd > 0) {
      result.rmssd += rmssd * weight;
      result.rmssdWeight += weight;
    }
    if (heartRate != null || rmssd != null) result.records += weight;
  }
  return {
    heartRate: result.heartRateWeight ? result.heartRate / result.heartRateWeight : null,
    rmssd: result.rmssdWeight ? result.rmssd / result.rmssdWeight : null,
    records: result.records,
  };
}

export function groupPhysiologyByCircadianPeriod(samples = []) {
  return CIRCADIAN_PERIODS.map((period) => {
    const matching = samples.filter((sample) => {
      if (sample.is_simulated) return false;
      const hour = hourInJakarta(sample.recorded_at);
      return hour != null && hour >= period.start && hour < period.end;
    });
    return { ...period, ...summarize(matching) };
  });
}

export function groupPhysiologyByActivity(samples = []) {
  const groups = new Map();
  for (const sample of samples) {
    if (sample.is_simulated) continue;
    const activity = sample.activity || 'Tidak dicatat';
    const group = groups.get(activity) || [];
    group.push(sample);
    groups.set(activity, group);
  }
  return [...groups.entries()]
    .map(([activity, group]) => ({ activity, ...summarize(group) }))
    .sort((first, second) => second.records - first.records);
}

export function groupPhysiologyByFeeling(samples = [], checkIns = [], windowMinutes = 60) {
  const groups = new Map();
  const maximumDistance = windowMinutes * 60 * 1000;
  const realSamples = samples.filter((sample) => !sample.is_simulated);

  for (const checkIn of checkIns) {
    if (!checkIn.feeling) continue;
    const checkInTime = new Date(checkIn.recorded_at).getTime();
    if (!Number.isFinite(checkInTime)) continue;
    let closestSample = null;
    let closestDistance = maximumDistance + 1;
    for (const sample of realSamples) {
      const distance = Math.abs(new Date(sample.recorded_at).getTime() - checkInTime);
      if (Number.isFinite(distance) && distance < closestDistance) {
        closestSample = sample;
        closestDistance = distance;
      }
    }
    if (!closestSample) continue;
    const group = groups.get(checkIn.feeling) || [];
    group.push(closestSample);
    groups.set(checkIn.feeling, group);
  }

  return [...groups.entries()]
    .map(([feeling, group]) => ({ feeling, ...summarize(group) }))
    .sort((first, second) => second.records - first.records);
}

export function groupRecoveryMetricsByDay(episodes = [], limit = 7) {
  const days = new Map();
  for (const episode of episodes) {
    if (!episode.start_at) continue;
    const date = new Date(episode.start_at);
    if (Number.isNaN(date.getTime())) continue;
    const dateKey = JAKARTA_DATE_FORMATTER.format(date);
    const day = days.get(dateKey) || {
      date,
      aucTotal: 0,
      aucCount: 0,
      ttrTotal: 0,
      ttrCount: 0,
      episodes: 0,
    };
    const auc = numberOrNull(episode.deviation_auc);
    const ttr = numberOrNull(episode.recovery_time_ms);
    if (auc != null && auc >= 0) {
      day.aucTotal += auc;
      day.aucCount += 1;
    }
    if (ttr != null && ttr >= 0) {
      day.ttrTotal += ttr;
      day.ttrCount += 1;
    }
    day.episodes += 1;
    days.set(dateKey, day);
  }
  const rows = [...days.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([dateKey, day]) => ({
      dateKey,
      date: day.date,
      auc: day.aucCount ? day.aucTotal / day.aucCount : null,
      ttrMinutes: day.ttrCount ? day.ttrTotal / day.ttrCount / 60000 : null,
      episodes: day.episodes,
    }));
  const dayLimit = Number.isInteger(limit) ? Math.max(0, limit) : 7;
  return dayLimit ? rows.slice(-dayLimit) : [];
}
