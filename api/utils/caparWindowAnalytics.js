const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeEpochMs(value) {
  if (value === null || value === undefined || value === '') return null;
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.abs(timestamp) < 100_000_000_000
    ? timestamp * 1000
    : timestamp;
}

export function getJakartaDayRange(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Tanggal harus berformat YYYY-MM-DD.');
  }
  const utcMidnight = Date.parse(`${date}T00:00:00.000Z`);
  if (
    !Number.isFinite(utcMidnight)
    || new Date(utcMidnight).toISOString().slice(0, 10) !== date
  ) {
    throw new Error('Tanggal tidak valid.');
  }
  const startMs = utcMidnight - JAKARTA_OFFSET_MS;
  return { startMs, endMs: startMs + DAY_MS };
}

export function getJakartaDateKey(value) {
  const timestamp = normalizeEpochMs(value);
  if (timestamp === null) return null;
  return new Date(timestamp + JAKARTA_OFFSET_MS).toISOString().slice(0, 10);
}

export function getTimePeriodForWindow(value) {
  const timestamp = normalizeEpochMs(value);
  if (timestamp === null) return null;
  const hour = new Date(timestamp + JAKARTA_OFFSET_MS).getUTCHours();
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function activityFor(window) {
  return String(window.activity_label || 'Unknown');
}

function featureValues(windows, key) {
  return windows
    .map((window) => {
      const value = window.features?.[key];
      return value === null || value === undefined || value === ''
        ? null
        : Number(value);
    })
    .filter(Number.isFinite);
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function sampleVariance(values) {
  if (values.length < 2) return null;
  const average = mean(values);
  return values.reduce((total, value) => total + ((value - average) ** 2), 0)
    / (values.length - 1);
}

function sampleCovariance(pairs) {
  if (pairs.length < 2) return null;
  const averageX = mean(pairs.map(([value]) => value));
  const averageY = mean(pairs.map(([, value]) => value));
  return pairs.reduce(
    (total, [valueX, valueY]) => total + ((valueX - averageX) * (valueY - averageY)),
    0
  ) / (pairs.length - 1);
}

export function buildCaparDailyAnalysis(windows) {
  const ordered = [...windows].sort((first, second) => (
    (normalizeEpochMs(first.window_start) ?? 0)
    - (normalizeEpochMs(second.window_start) ?? 0)
    || String(first._id).localeCompare(String(second._id))
  ));
  const groups = new Map();
  for (const window of ordered) {
    const activity = activityFor(window);
    if (!groups.has(activity)) groups.set(activity, []);
    groups.get(activity).push(window);
  }

  const activitySummaries = [...groups.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([activity, group]) => {
      const valid = group.filter((window) => window.is_valid === true);
      const heartRates = featureValues(valid, 'mean_hr');
      const rrPairs = valid
        .map((window) => {
          const hr = window.features?.mean_hr;
          const rr = window.features?.mean_rr;
          return [
            hr === null || hr === undefined || hr === '' ? NaN : Number(hr),
            rr === null || rr === undefined || rr === '' ? NaN : Number(rr),
          ];
        })
        .filter(([hr, rr]) => Number.isFinite(hr) && Number.isFinite(rr));
      const heartRatesWithRr = rrPairs.map(([hr]) => hr);
      const rrValues = rrPairs.map(([, rr]) => rr);

      return {
        activity,
        window_count: group.length,
        valid_window_count: valid.length,
        invalid_window_count: group.length - valid.length,
        raw_sample_count: group.reduce(
          (total, window) => total + (Number(window.raw_count) || 0),
          0
        ),
        mean_hr: mean(heartRates),
        mean_rr: mean(featureValues(valid, 'mean_rr')),
        mean_motion_intensity: mean(featureValues(valid, 'motion_intensity')),
        mean_dfa_alpha1: mean(featureValues(valid, 'dfa_alpha1')),
        mean_rmssd: mean(featureValues(valid, 'rmssd')),
        hr_variance: sampleVariance(heartRates),
        hr_rr_covariance: sampleCovariance(rrPairs),
        hr_rr_pair_count: rrPairs.length,
        min_hr: heartRates.length ? Math.min(...heartRates) : null,
        max_hr: heartRates.length ? Math.max(...heartRates) : null,
        paired_mean_hr: mean(heartRatesWithRr),
        paired_mean_rr: mean(rrValues),
      };
    });

  const edges = ordered.slice(0, -1).flatMap((window, index) => {
    const next = ordered[index + 1];
    if (getJakartaDateKey(window.window_start) !== getJakartaDateKey(next.window_start)) {
      return [];
    }
    const startMs = normalizeEpochMs(window.window_start);
    const nextStartMs = normalizeEpochMs(next.window_start);
    const endMs = normalizeEpochMs(window.window_end) ?? startMs;
    return [{
      from_segment_id: window._id,
      to_segment_id: next._id,
      from_activity: activityFor(window),
      to_activity: activityFor(next),
      activity_changed: activityFor(window) !== activityFor(next),
      elapsed_ms: Math.max(0, (nextStartMs ?? startMs) - (startMs ?? nextStartMs)),
      gap_ms: Math.max(0, (nextStartMs ?? endMs) - (endMs ?? nextStartMs)),
      window_duration_ms: Math.max(0, (endMs ?? startMs) - (startMs ?? endMs)),
    }];
  });

  const activityRuns = [];
  const activityRunDayKeys = [];
  for (const window of ordered) {
    const activity = activityFor(window);
    const dayKey = getJakartaDateKey(window.window_start);
    let run = activityRuns[activityRuns.length - 1];
    if (
      !run
      || run.activity !== activity
      || activityRunDayKeys[activityRunDayKeys.length - 1] !== dayKey
    ) {
      const startMs = normalizeEpochMs(window.window_start);
      run = {
        activity,
        start_time: startMs,
        end_time: normalizeEpochMs(window.window_end) ?? startMs,
        duration_ms: 0,
        window_count: 0,
        first_segment_id: window._id,
        last_segment_id: window._id,
      };
      activityRuns.push(run);
      activityRunDayKeys.push(dayKey);
    }
    const endMs = normalizeEpochMs(window.window_end)
      ?? normalizeEpochMs(window.window_start);
    run.end_time = Math.max(run.end_time, endMs);
    run.duration_ms = Math.max(0, run.end_time - run.start_time);
    run.window_count += 1;
    run.last_segment_id = window._id;
  }

  const activityTransitions = activityRuns.slice(0, -1).flatMap((run, index) => {
    const nextRun = activityRuns[index + 1];
    if (activityRunDayKeys[index] !== activityRunDayKeys[index + 1]) return [];
    return [{
      from_activity: run.activity,
      to_activity: nextRun.activity,
      from_segment_id: run.last_segment_id,
      to_segment_id: nextRun.first_segment_id,
      from_start: run.start_time,
      from_end: run.end_time,
      to_start: nextRun.start_time,
      activity_duration_ms: run.duration_ms,
      elapsed_between_activity_starts_ms: Math.max(
        0,
        nextRun.start_time - run.start_time
      ),
      gap_ms: Math.max(0, nextRun.start_time - run.end_time),
    }];
  });

  return {
    source_window_count: ordered.length,
    valid_window_count: ordered.filter((window) => window.is_valid === true).length,
    invalid_window_count: ordered.filter((window) => window.is_valid !== true).length,
    activity_summaries: activitySummaries,
    activity_runs: activityRuns,
    transitions: activityTransitions,
    time_edges: edges,
  };
}
