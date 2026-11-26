import { getJakartaDateKey, normalizeEpochMs } from './caparWindowAnalytics.js';

const WINDOW_DURATION_MS = {
  '1min': 60_000,
  '5min': 300_000,
};

function numericValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function sampleVariance(values) {
  if (values.length < 2) return null;
  const mean = average(values);
  return values.reduce((total, value) => total + ((value - mean) ** 2), 0)
    / (values.length - 1);
}

function sampleCovariance(pairs) {
  if (pairs.length < 2) return null;
  const meanHr = average(pairs.map(([hr]) => hr));
  const meanRr = average(pairs.map(([, rr]) => rr));
  return pairs.reduce(
    (total, [hr, rr]) => total + ((hr - meanHr) * (rr - meanRr)),
    0
  ) / (pairs.length - 1);
}

function getPoint(window) {
  return {
    segment_id: window._id,
    window_start: normalizeEpochMs(window.window_start),
    window_end: normalizeEpochMs(window.window_end),
    is_valid: window.is_valid === true,
    rr_status: window.rr_status || null,
    raw_count: Number(window.raw_count) || 0,
    mean_hr: numericValue(window.features?.mean_hr),
    mean_rr: numericValue(window.features?.mean_rr),
    sdnn: numericValue(window.features?.sdnn),
    motion_intensity: numericValue(window.features?.motion_intensity),
    rmssd: numericValue(window.features?.rmssd),
    dfa_alpha1: numericValue(window.features?.dfa_alpha1),
    dfa_alpha2: numericValue(window.features?.dfa_alpha2),
    q_signal: numericValue(window.signal_quality_detail?.q_signal),
    confidence_score: numericValue(window.missing_data_info?.confidence_score),
    classification: window.rr_status || window.classification || null,
  };
}

function summarize(points) {
  const validPoints = points.filter((point) => point.is_valid);
  const heartRates = validPoints
    .map((point) => point.mean_hr)
    .filter(Number.isFinite);
  const hrRrPairs = validPoints
    .map((point) => [point.mean_hr, point.mean_rr])
    .filter(([hr, rr]) => Number.isFinite(hr) && Number.isFinite(rr));
  const valuesFor = (key) => validPoints
    .map((point) => point[key])
    .filter(Number.isFinite);

  return {
    window_count: points.length,
    valid_window_count: validPoints.length,
    invalid_window_count: points.length - validPoints.length,
    raw_sample_count: points.reduce((total, point) => total + point.raw_count, 0),
    mean_hr: average(heartRates),
    min_hr: heartRates.length ? Math.min(...heartRates) : null,
    max_hr: heartRates.length ? Math.max(...heartRates) : null,
    hr_variance: sampleVariance(heartRates),
    hr_rr_covariance: sampleCovariance(hrRrPairs),
    hr_rr_pair_count: hrRrPairs.length,
    mean_rr: average(valuesFor('mean_rr')),
    mean_sdnn: average(valuesFor('sdnn')),
    min_sdnn: valuesFor('sdnn').length ? Math.min(...valuesFor('sdnn')) : null,
    max_sdnn: valuesFor('sdnn').length ? Math.max(...valuesFor('sdnn')) : null,
    mean_motion_intensity: average(valuesFor('motion_intensity')),
    min_motion_intensity: valuesFor('motion_intensity').length
      ? Math.min(...valuesFor('motion_intensity'))
      : null,
    max_motion_intensity: valuesFor('motion_intensity').length
      ? Math.max(...valuesFor('motion_intensity'))
      : null,
    mean_rmssd: average(valuesFor('rmssd')),
    min_rmssd: valuesFor('rmssd').length ? Math.min(...valuesFor('rmssd')) : null,
    max_rmssd: valuesFor('rmssd').length ? Math.max(...valuesFor('rmssd')) : null,
    mean_dfa_alpha1: average(valuesFor('dfa_alpha1')),
    mean_dfa_alpha2: average(valuesFor('dfa_alpha2')),
    mean_confidence_score: average(valuesFor('confidence_score')),
    quality_valid_window_count: points.filter((point) => point.is_valid).length,
    quality_invalid_window_count: points.filter((point) => !point.is_valid).length,
    state_transition_count: 0,
  };
}

export function buildCaparActivityTimeSeries(windows, { accountId, generatedBy }) {
  const ordered = [...windows].sort((first, second) => (
    String(first.device_id || '').localeCompare(String(second.device_id || ''))
    || String(first.window_type || '').localeCompare(String(second.window_type || ''))
    || (normalizeEpochMs(first.window_start) ?? 0) - (normalizeEpochMs(second.window_start) ?? 0)
    || String(first._id).localeCompare(String(second._id))
  ));
  const episodes = [];

  for (const window of ordered) {
    const start = normalizeEpochMs(window.window_start);
    if (start === null) continue;
    const end = normalizeEpochMs(window.window_end) ?? start;
    const dayKey = getJakartaDateKey(start);
    const deviceId = String(window.device_id || 'UNKNOWN');
    const windowType = window.window_type || '5min';
    const activity = String(window.activity_label || 'Unknown');
    const expectedWindowMs = WINDOW_DURATION_MS[windowType] || WINDOW_DURATION_MS['5min'];
    const previousEpisode = episodes[episodes.length - 1];
    const previousPoint = previousEpisode?.series_points.at(-1);
    const gapMs = previousPoint
      ? start - (previousPoint.window_end ?? previousPoint.window_start)
      : null;
    const continuesEpisode = previousEpisode
      && previousEpisode.device_id === deviceId
      && previousEpisode.window_type === windowType
      && previousEpisode.day_key === dayKey
      && previousEpisode.activity_label === activity
      && gapMs <= expectedWindowMs;

    if (!continuesEpisode) {
      episodes.push({
        account_id: accountId,
        device_id: deviceId,
        window_type: windowType,
        day_key: dayKey,
        activity_label: activity,
        episode_start: start,
        episode_end: end,
        source_segment_ids: [],
        series_points: [],
        state_transitions: [],
      });
    }

    const episode = episodes[episodes.length - 1];
    const statePreviousPoint = episode.series_points.at(-1);
    const previousState = statePreviousPoint?.rr_status || statePreviousPoint?.classification || null;
    const currentPoint = getPoint(window);
    const currentState = currentPoint.rr_status || currentPoint.classification || null;
    if (statePreviousPoint && previousState && currentState && previousState !== currentState) {
      episode.state_transitions.push({
        from_segment_id: statePreviousPoint.segment_id,
        to_segment_id: currentPoint.segment_id,
        timestamp: currentPoint.window_start,
        from_state: previousState,
        to_state: currentState,
      });
    }
    episode.episode_end = Math.max(episode.episode_end, end);
    episode.source_segment_ids.push(window._id);
    episode.series_points.push(currentPoint);
  }

  return episodes.map((episode) => {
    const firstSegmentId = String(episode.source_segment_ids[0]);
    const episodeKey = [
      episode.day_key,
      episode.device_id,
      episode.window_type,
      firstSegmentId,
    ].join(':');
    const summary = summarize(episode.series_points);
    summary.state_transition_count = episode.state_transitions.length;
    return {
      ...episode,
      episode_key: episodeKey,
      generated_by: generatedBy,
      summary,
      state_transitions: episode.state_transitions,
    };
  });
}
