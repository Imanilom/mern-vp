const DAY_MS = 24 * 60 * 60 * 1000;

export function parseActivityTime(value) {
  if (typeof value !== 'string') return null;
  const match = /^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] || 0);
}

export function summarizeManualActivityDurations(records, { truncated = false } = {}) {
  const byActivity = new Map();
  const dates = new Set();
  const byDay = new Map();
  let totalSeconds = 0;
  let validRecords = 0;

  for (const record of records) {
    const start = parseActivityTime(record.awal);
    const end = parseActivityTime(record.akhir);
    if (start === null || end === null || start === end) continue;

    const seconds = end > start ? end - start : DAY_MS / 1000 - start + end;
    const label = typeof record.aktivitas === 'string' && record.aktivitas.trim()
      ? record.aktivitas.trim().slice(0, 80)
      : 'Tidak disebutkan';
    totalSeconds += seconds;
    validRecords += 1;

    const activity = byActivity.get(label) || { records: 0, seconds: 0 };
    activity.records += 1;
    activity.seconds += seconds;
    byActivity.set(label, activity);

    const recordedAt = record.Date instanceof Date ? record.Date : new Date(record.Date);
    if (!Number.isNaN(recordedAt.getTime())) {
      const date = recordedAt.toISOString().slice(0, 10);
      dates.add(date);
      const daily = byDay.get(date) || { records: 0, seconds: 0 };
      daily.records += 1;
      daily.seconds += seconds;
      byDay.set(date, daily);
    }
  }

  return {
    total_hours: Number((totalSeconds / 3600).toFixed(2)),
    average_hours_per_recorded_day: dates.size
      ? Number((totalSeconds / 3600 / dates.size).toFixed(2))
      : 0,
    valid_records: validRecords,
    recorded_days: dates.size,
    truncated,
    daily: [...byDay.entries()]
      .map(([date, value]) => ({
        date,
        records: value.records,
        hours: Number((value.seconds / 3600).toFixed(2)),
      }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    activities: [...byActivity.entries()]
      .map(([activity, value]) => ({
        activity,
        records: value.records,
        hours: Number((value.seconds / 3600).toFixed(2)),
      }))
      .sort((a, b) => b.hours - a.hours),
  };
}

export function getPersonalChatDateFilter(question, now = new Date()) {
  const normalized = question.toLowerCase();
  let from;

  const relative = normalized.match(/(\d{1,4})\s*(hari|minggu|bulan|tahun)\s*(terakhir|terakhirnya|lalu)?/);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2];
    if (amount > 0) {
      const multiplier = unit === 'hari' ? 1
        : unit === 'minggu' ? 7
          : unit === 'bulan' ? 30
            : 365;
      from = new Date(now.getTime() - amount * multiplier * DAY_MS);
    }
  } else if (normalized.includes('hari ini')) {
    from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  } else if (normalized.includes('minggu ini')) {
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    from = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * DAY_MS);
  } else if (normalized.includes('bulan ini')) {
    from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  } else if (normalized.includes('tahun ini')) {
    from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  }

  return from ? { from, to: now } : null;
}
