const QUALITY_THRESHOLD = 0.95;
const MINIMUM_PAIRS = 18;
const MINIMUM_RANK = 3;
const MAXIMUM_CONDITION_NUMBER = 100;
const DISTANCE_THRESHOLD = 1.5;
const RECOVERY_DWELL_WINDOWS = 2;
const WINDOW_DURATIONS = { '1min': 60_000, '5min': 300_000 };

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getEpisodeWindowCount(episode, episodes) {
  const segmentIds = episode?.segment_ids || [];
  if (segmentIds.length || !episode?.parent_episode_id) return segmentIds.length;
  const parent = episodes.find((item) => String(item._id || '') === String(episode.parent_episode_id));
  return (parent?.segment_ids || []).length;
}

function unitIntervalOrNull(value) {
  const parsed = numberOrNull(value);
  return parsed !== null && parsed >= 0 && parsed <= 1 ? parsed : null;
}

function toEpochMs(value) {
  if (typeof value === 'string' && value.trim() && !Number.isFinite(Number(value))) {
    const parsedDate = Date.parse(value);
    return Number.isFinite(parsedDate) ? parsedDate : null;
  }
  const parsed = numberOrNull(value);
  if (parsed === null) return null;
  return Math.abs(parsed) < 100_000_000_000 ? parsed * 1000 : parsed;
}

export function getJakartaDay(timestamp) {
  const value = toEpochMs(timestamp);
  return value === null
    ? null
    : new Date(value + (7 * 60 * 60 * 1000)).toISOString().slice(0, 10);
}

function getTimePeriod(timestamp) {
  const value = toEpochMs(timestamp);
  if (value === null) return null;
  const hour = new Date(value + (7 * 60 * 60 * 1000)).getUTCHours();
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function getBaseline(window, baselines) {
  const activity = window.activity_label || 'Unknown';
  const timePeriod = window.time_period || getTimePeriod(window.window_start);
  return baselines.find((baseline) => (
    baseline.activity === activity && baseline.time_period === timePeriod
  )) || null;
}

function getBaselineParameters(baseline) {
  const stats = baseline?.stats || {};
  const hrMean = numberOrNull(stats.mean_hr?.mean);
  const hrStd = numberOrNull(stats.mean_hr?.std);
  const rmssdMean = numberOrNull(stats.rmssd?.mean);
  const rmssdStd = numberOrNull(stats.rmssd?.std);
  const dfaMean = numberOrNull(stats.dfa_alpha1?.mean);
  const dfaStd = numberOrNull(stats.dfa_alpha1?.std);
  if (![hrMean, hrStd, rmssdMean, rmssdStd, dfaMean, dfaStd].every(Number.isFinite)
    || hrStd <= 0 || rmssdMean <= 0 || rmssdStd <= 0 || dfaStd <= 0) {
    return null;
  }
  const logVariance = Math.log1p((rmssdStd / rmssdMean) ** 2);
  if (!Number.isFinite(logVariance) || logVariance <= 0) return null;
  return {
    hrMean,
    hrStd,
    logRmssdMean: Math.log(rmssdMean) - (logVariance / 2),
    logRmssdStd: Math.sqrt(logVariance),
    dfaMean,
    dfaStd,
    mature: baseline.is_mature === true,
    baselineId: String(baseline._id || `${baseline.activity}:${baseline.time_period}`),
  };
}

function getQuality(window) {
  const quality = window.signal_quality_detail || {};
  const missing = window.missing_data_info || {};
  const signalQuality = unitIntervalOrNull(
    quality.q_signal ?? (quality.artifact_fraction === null
      ? null
      : 1 - Number(quality.artifact_fraction)),
  );
  const completeness = unitIntervalOrNull(
    quality.q_complete
      ?? (missing.missing_ratio !== null && missing.missing_ratio !== undefined
        ? 1 - Number(missing.missing_ratio)
        : null),
  );
  const reasons = [];
  if (window.is_valid === false) reasons.push('window ditandai tidak valid');
  if (signalQuality === null) reasons.push('kualitas sinyal tidak tersedia');
  else if (signalQuality < QUALITY_THRESHOLD) reasons.push('kualitas sinyal di bawah 95%');
  if (completeness === null) reasons.push('kelengkapan data tidak tersedia');
  else if (completeness < QUALITY_THRESHOLD) reasons.push('kelengkapan data di bawah 95%');
  return {
    signalQuality,
    completeness,
    passed: window.is_valid !== false
      && signalQuality !== null
      && completeness !== null
      && signalQuality >= QUALITY_THRESHOLD
      && completeness >= QUALITY_THRESHOLD,
    reasons,
  };
}

export function prepareDynamicWindow(window, baselines = []) {
  const timestamp = toEpochMs(window.window_start ?? window.timestamp);
  const hr = numberOrNull(window.features?.mean_hr ?? window.hr);
  const rmssd = numberOrNull(window.features?.rmssd ?? window.rmssd);
  const dfa = numberOrNull(window.features?.dfa_alpha1 ?? window.dfa_alpha1);
  const baseline = getBaseline(window, baselines);
  const baselineParameters = getBaselineParameters(baseline);
  const quality = getQuality(window);
  const reasons = [...quality.reasons];
  if (!baseline) reasons.push('baseline aktivitas dan waktu tidak ditemukan');
  else if (!baselineParameters) reasons.push('statistik baseline belum lengkap');
  else if (!baselineParameters.mature) reasons.push('baseline belum matang');
  if (timestamp === null) {
    reasons.push('timestamp window tidak valid');
  }
  if (hr === null || rmssd === null || dfa === null || rmssd <= 0) {
    reasons.push('fitur HR, RMSSD, atau DFA α1 tidak lengkap');
  }

  let state = null;
  if (baselineParameters && baselineParameters.mature
    && hr !== null && rmssd !== null && rmssd > 0 && dfa !== null) {
    state = [
      (hr - baselineParameters.hrMean) / baselineParameters.hrStd,
      (baselineParameters.logRmssdMean - Math.log(rmssd)) / baselineParameters.logRmssdStd,
      (baselineParameters.dfaMean - dfa) / baselineParameters.dfaStd,
    ];
  }

  return {
    id: String(window._id || window.segment_id || ''),
    timestamp,
    endTimestamp: toEpochMs(window.window_end),
    activity: window.activity_label || 'Unknown',
    deviceId: String(window.device_id || 'UNKNOWN'),
    windowType: window.window_type || '5min',
    day: getJakartaDay(timestamp),
    hr,
    rmssd,
    dfa,
    motion: numberOrNull(window.features?.motion_intensity ?? window.motion_intensity),
    quality,
    state,
    baselineKey: baselineParameters?.baselineId || null,
    eligible: quality.passed && state !== null && timestamp !== null,
    reasons: [...new Set(reasons)],
    source: window,
  };
}

function compareWindows(first, second) {
  return first.timestamp - second.timestamp || first.id.localeCompare(second.id);
}

export function groupDynamicEpisodes(windows, activitySeries = []) {
  const activityByWindow = new Map();
  for (const activity of activitySeries) {
    const episodeId = String(activity.episode_key || activity._id || '');
    if (!episodeId) continue;
    for (const segmentId of activity.source_segment_ids || []) {
      const key = String(segmentId);
      if (!activityByWindow.has(key)) {
        activityByWindow.set(key, {
          id: episodeId,
          activity: activity.activity_label || 'Unknown',
          day: activity.day_key || getJakartaDay(activity.episode_start),
          deviceId: String(activity.device_id || 'UNKNOWN'),
          windowType: activity.window_type || '5min',
        });
      }
    }
  }

  const episodes = new Map();
  const fallbackGroups = new Map();
  for (const window of windows) {
    const timestamp = toEpochMs(window.window_start);
    if (timestamp === null) continue;
    const id = String(window._id || window.segment_id || '');
    const activityEpisode = activityByWindow.get(id);
    const episodeKey = activityEpisode
      ? `activity:${activityEpisode.id}`
      : `fallback:${window.device_id || 'UNKNOWN'}:${window.window_type || '5min'}:${getJakartaDay(timestamp)}:${window.activity_label || 'Unknown'}`;
    if (!episodes.has(episodeKey)) {
      episodes.set(episodeKey, {
        id: activityEpisode?.id || episodeKey,
        activity: activityEpisode?.activity || window.activity_label || 'Unknown',
        day: activityEpisode?.day || getJakartaDay(timestamp),
        deviceId: activityEpisode?.deviceId || String(window.device_id || 'UNKNOWN'),
        windowType: activityEpisode?.windowType || window.window_type || '5min',
        windows: [],
      });
    }
    episodes.get(episodeKey).windows.push(window);
    if (!activityEpisode) fallbackGroups.set(episodeKey, true);
  }

  return [...episodes.values()]
    .map((episode) => ({
      ...episode,
      windows: episode.windows.sort((first, second) => (
        (toEpochMs(first.window_start) ?? 0) - (toEpochMs(second.window_start) ?? 0)
        || String(first._id).localeCompare(String(second._id))
      )),
      inferredGrouping: fallbackGroups.has(`fallback:${episode.deviceId}:${episode.windowType}:${episode.day}:${episode.activity}`),
    }))
    .sort((first, second) => (
      String(first.day).localeCompare(String(second.day))
      || first.activity.localeCompare(second.activity)
      || first.id.localeCompare(second.id)
    ));
}

function multiplyMatrices(first, second) {
  return first.map((row) => second[0].map((_, column) => (
    row.reduce((sum, value, index) => sum + (value * second[index][column]), 0)
  )));
}

function transpose(matrix) {
  return matrix[0].map((_, column) => matrix.map((row) => row[column]));
}

function invert3(matrix) {
  const rows = matrix.map((row, index) => [
    ...row,
    ...[0, 1, 2].map((column) => Number(index === column)),
  ]);
  for (let column = 0; column < 3; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 3; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (Math.abs(rows[pivot][column]) < 1e-12) return null;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    rows[column] = rows[column].map((value) => value / divisor);
    for (let row = 0; row < 3; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      rows[row] = rows[row].map((value, index) => value - factor * rows[column][index]);
    }
  }
  return rows.map((row) => row.slice(3));
}

function symmetricEigenvalues(matrix) {
  const values = matrix.map((row) => [...row]);
  for (let iteration = 0; iteration < 48; iteration += 1) {
    let p = 0;
    let q = 1;
    for (const [first, second] of [[0, 2], [1, 2]]) {
      if (Math.abs(values[first][second]) > Math.abs(values[p][q])) {
        p = first;
        q = second;
      }
    }
    if (Math.abs(values[p][q]) < 1e-12) break;
    const angle = 0.5 * Math.atan2(2 * values[p][q], values[q][q] - values[p][p]);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const app = values[p][p];
    const aqq = values[q][q];
    const apq = values[p][q];
    values[p][p] = (cosine ** 2 * app) - (2 * sine * cosine * apq) + (sine ** 2 * aqq);
    values[q][q] = (sine ** 2 * app) + (2 * sine * cosine * apq) + (cosine ** 2 * aqq);
    values[p][q] = 0;
    values[q][p] = 0;
    for (let index = 0; index < 3; index += 1) {
      if (index === p || index === q) continue;
      const aip = values[index][p];
      const aiq = values[index][q];
      values[index][p] = (cosine * aip) - (sine * aiq);
      values[p][index] = values[index][p];
      values[index][q] = (sine * aip) + (cosine * aiq);
      values[q][index] = values[index][q];
    }
  }
  return values.map((row, index) => row[index]).sort((first, second) => second - first);
}

function matrixEigenvalues(matrix) {
  const trace = matrix[0][0] + matrix[1][1] + matrix[2][2];
  const secondCoefficient = (
    (matrix[0][0] * matrix[1][1])
    + (matrix[0][0] * matrix[2][2])
    + (matrix[1][1] * matrix[2][2])
    - (matrix[0][1] * matrix[1][0])
    - (matrix[0][2] * matrix[2][0])
    - (matrix[1][2] * matrix[2][1])
  );
  const determinant = (
    matrix[0][0] * ((matrix[1][1] * matrix[2][2]) - (matrix[1][2] * matrix[2][1]))
    - matrix[0][1] * ((matrix[1][0] * matrix[2][2]) - (matrix[1][2] * matrix[2][0]))
    + matrix[0][2] * ((matrix[1][0] * matrix[2][1]) - (matrix[1][1] * matrix[2][0]))
  );
  const p = secondCoefficient - ((trace * trace) / 3);
  const q = (-2 * (trace ** 3) / 27) + ((trace * secondCoefficient) / 3) - determinant;
  const discriminant = ((q / 2) ** 2) + ((p / 3) ** 3);
  const shift = trace / 3;
  let roots;
  if (discriminant > 1e-12) {
    const root = Math.sqrt(discriminant);
    const first = Math.cbrt((-q / 2) + root);
    const second = Math.cbrt((-q / 2) - root);
    roots = [
      { re: first + second + shift, im: 0 },
      { re: shift - ((first + second) / 2), im: (Math.sqrt(3) * (first - second)) / 2 },
      { re: shift - ((first + second) / 2), im: -(Math.sqrt(3) * (first - second)) / 2 },
    ];
  } else if (p < -1e-15) {
    const angle = Math.acos(Math.max(-1, Math.min(1, -q / (2 * Math.sqrt(-((p / 3) ** 3))))));
    roots = [0, 1, 2].map((index) => ({
      re: shift + (2 * Math.sqrt(-p / 3) * Math.cos((angle + (2 * Math.PI * index)) / 3)),
      im: 0,
    }));
  } else {
    const root = Math.cbrt(-q / 2);
    roots = [
      { re: shift + (2 * root), im: 0 },
      { re: shift - root, im: 0 },
      { re: shift - root, im: 0 },
    ];
  }
  return roots
    .map((root) => ({ ...root, magnitude: Math.hypot(root.re, root.im) }))
    .sort((first, second) => second.magnitude - first.magnitude);
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function getExpectedDuration(windowType, pair) {
  return WINDOW_DURATIONS[windowType]
    || (pair.window_end && pair.window_start
      ? pair.window_end - pair.window_start
      : null);
}

function parseCsvDocument(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const source = String(text).replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error('CSV tidak valid: tanda kutip tidak berpasangan.');
  row.push(cell);
  if (row.some((value) => value !== '')) rows.push(row);
  return rows;
}

export function parseDynamicAnalysisCsv(text) {
  const [headerRow, ...dataRows] = parseCsvDocument(text);
  if (!headerRow?.length) throw new Error('CSV kosong.');
  const headers = headerRow.map((header) => header.trim().toLowerCase());
  if (new Set(headers).size !== headers.length) {
    throw new Error('CSV tidak valid: nama kolom duplikat.');
  }
  const requiredHeaders = [
    'granularity',
    'node_id',
    'timestamp',
    'end_timestamp',
    'hr_bpm',
    'rmssd_ms',
    'dfa_alpha1',
    'activity',
    'device_id',
    'signal_quality',
    'q_complete',
    'window_type',
    'baseline_activity',
    'baseline_time_period',
    'baseline_hr_mean',
    'baseline_hr_std',
    'baseline_rmssd_mean',
    'baseline_rmssd_std',
    'baseline_dfa_alpha1_mean',
    'baseline_dfa_alpha1_std',
    'baseline_mature',
    'source_reference',
  ];
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length) {
    throw new Error(`Kolom CSV tidak lengkap: ${missingHeaders.join(', ')}.`);
  }
  const readRows = dataRows.map((values) => Object.fromEntries(headers.map((header, index) => (
    [header, values[index] ?? '']
  ))));
  const windows = [];
  const activities = [];
  const baselines = new Map();
  for (const row of readRows) {
    if (row.granularity === 'window') {
      const timestamp = toEpochMs(row.timestamp);
      if (!row.node_id || timestamp === null) {
        throw new Error('Baris window CSV harus memiliki node_id dan timestamp yang valid.');
      }
      const activity = row.activity || 'Unknown';
      const baselineActivity = row.baseline_activity || activity;
      const timePeriod = row.baseline_time_period || getTimePeriod(timestamp);
      const baselineValues = {
        hrMean: numberOrNull(row.baseline_hr_mean),
        hrStd: numberOrNull(row.baseline_hr_std),
        rmssdMean: numberOrNull(row.baseline_rmssd_mean),
        rmssdStd: numberOrNull(row.baseline_rmssd_std),
        dfaMean: numberOrNull(row.baseline_dfa_alpha1_mean),
        dfaStd: numberOrNull(row.baseline_dfa_alpha1_std),
      };
      if (Object.values(baselineValues).every(Number.isFinite) && timePeriod) {
        const key = `${baselineActivity}\u0000${timePeriod}`;
        const existing = baselines.get(key);
        const values = Object.values(baselineValues);
        if (existing && values.some((value, index) => value !== existing.values[index])) {
          throw new Error(`Baseline CSV tidak konsisten untuk ${baselineActivity} · ${timePeriod}.`);
        }
        if (!existing) {
          baselines.set(key, {
            values,
            baseline: {
              _id: `imported:${key}`,
              activity: baselineActivity,
              time_period: timePeriod,
              is_mature: row.baseline_mature.toLowerCase() === 'true'
                || row.baseline_mature === '1',
              stats: {
                mean_hr: { mean: baselineValues.hrMean, std: baselineValues.hrStd },
                rmssd: { mean: baselineValues.rmssdMean, std: baselineValues.rmssdStd },
                dfa_alpha1: { mean: baselineValues.dfaMean, std: baselineValues.dfaStd },
              },
            },
          });
        }
      }
      windows.push({
        _id: row.node_id,
        window_start: timestamp,
        window_end: toEpochMs(row.end_timestamp),
        window_type: row.window_type || '5min',
        activity_label: activity,
        device_id: row.device_id || 'UNKNOWN',
        features: {
          mean_hr: numberOrNull(row.hr_bpm),
          rmssd: numberOrNull(row.rmssd_ms),
          dfa_alpha1: numberOrNull(row.dfa_alpha1),
        },
        signal_quality_detail: {
          q_signal: numberOrNull(row.signal_quality),
          q_complete: numberOrNull(row.q_complete),
        },
      });
    } else if (row.granularity === 'activity') {
      activities.push({
        _id: row.node_id,
        episode_key: row.node_id,
        activity_label: row.activity || 'Unknown',
        device_id: row.device_id || 'UNKNOWN',
        episode_start: toEpochMs(row.timestamp),
        episode_end: toEpochMs(row.end_timestamp),
        source_segment_ids: row.source_reference.split('|').filter(Boolean),
        window_type: row.window_type || '5min',
      });
    }
  }
  if (!windows.length) throw new Error('CSV tidak memiliki baris granularity=window.');
  return {
    windows,
    activities,
    baselines: [...baselines.values()].map(({ baseline }) => baseline),
  };
}

export function collectDynamicPairs(episodes) {
  const pairs = [];
  for (const episode of episodes) {
    const rows = episode.rows || episode.windows.map((window) => prepareDynamicWindow(window, episode.baselines || []));
    for (let index = 1; index < rows.length; index += 1) {
      const previous = rows[index - 1];
      const current = rows[index];
      if (!previous.eligible || !current.eligible
        || previous.baselineKey !== current.baselineKey
        || !previous.state || !current.state) continue;
      const elapsedMs = current.timestamp - previous.timestamp;
      const expectedMs = getExpectedDuration(
        previous.windowType || episode.windowType,
        previous.source || previous,
      );
      if (!Number.isFinite(elapsedMs) || !Number.isFinite(expectedMs)
        || elapsedMs <= 0 || Math.abs(elapsedMs - expectedMs) > expectedMs * 0.25) continue;
      pairs.push({
        previous: previous.state,
        current: current.state,
        elapsedMinutes: elapsedMs / 60_000,
        baselineKey: previous.baselineKey,
      });
    }
  }
  return pairs;
}

export function fitDynamicModel(episodes) {
  const pairs = collectDynamicPairs(episodes);
  const dtMinutes = median(pairs.map(({ elapsedMinutes }) => elapsedMinutes));
  const audit = {
    episode_count: episodes.length,
    pair_count: pairs.length,
    rank: 0,
    condition_number: null,
    rmse: null,
    dt_minutes: dtMinutes,
    baseline_context_count: 0,
    baseline_context_keys: [],
  };
  audit.baseline_context_keys = [...new Set(pairs.map(({ baselineKey }) => baselineKey).filter(Boolean))];
  audit.baseline_context_count = audit.baseline_context_keys.length;
  if (!pairs.length) {
    return { status: 'ABSTAIN', reason: 'Belum ada pasangan window berurutan yang lolos gate kualitas.', audit, matrix: null, modes: [] };
  }
  if (pairs.some(({ elapsedMinutes }) => Math.abs(elapsedMinutes - dtMinutes) > Math.max(0.1, dtMinutes * 0.1))) {
    return { status: 'ABSTAIN', reason: 'Interval sampling tidak cukup seragam untuk satu model diskrit.', audit, matrix: null, modes: [] };
  }

  const previous = pairs.map(({ previous: state }) => state);
  const current = pairs.map(({ current: state }) => state);
  const previousTranspose = transpose(previous);
  const gram = multiplyMatrices(previousTranspose, previous);
  const singularValues = symmetricEigenvalues(gram)
    .map((value) => Math.sqrt(Math.max(0, value)));
  const largestSingularValue = singularValues[0] || 0;
  const rank = singularValues.filter((value) => (
    value > largestSingularValue * 1e-7 && value > 1e-9
  )).length;
  const smallestNonzero = singularValues.find((value) => value > largestSingularValue * 1e-7) || 0;
  const conditionNumber = rank === 3 && smallestNonzero > 0
    ? largestSingularValue / smallestNonzero
    : Infinity;
  audit.rank = rank;
  audit.condition_number = Number.isFinite(conditionNumber) ? conditionNumber : null;

  if (pairs.length < MINIMUM_PAIRS || rank < MINIMUM_RANK || conditionNumber > MAXIMUM_CONDITION_NUMBER) {
    return {
      status: 'ABSTAIN',
      reason: `Gate identifiabilitas belum terpenuhi: perlu ${MINIMUM_PAIRS} pasangan, rank 3, dan κ ≤ ${MAXIMUM_CONDITION_NUMBER}.`,
      audit,
      matrix: null,
      modes: [],
    };
  }

  const inverse = invert3(gram);
  if (!inverse) {
    return { status: 'ABSTAIN', reason: 'Matriks normal singular; koefisien tidak dapat diestimasi.', audit, matrix: null, modes: [] };
  }
  const matrix = multiplyMatrices(multiplyMatrices(transpose(current), previous), inverse);
  const residuals = pairs.map(({ previous: before, current: after }) => (
    after.map((value, row) => value - matrix[row].reduce(
      (sum, coefficient, column) => sum + (coefficient * before[column]),
      0,
    ))
  ));
  audit.rmse = Math.sqrt(
    residuals.flat().reduce((sum, value) => sum + (value ** 2), 0) / (3 * pairs.length),
  );
  const modes = matrixEigenvalues(matrix).map((mode) => ({
    ...mode,
    tauMinutes: mode.magnitude > 0 && mode.magnitude < 1
      ? -dtMinutes / Math.log(mode.magnitude)
      : null,
    periodMinutes: Math.abs(Math.atan2(mode.im, mode.re)) > 1e-9
      ? (2 * Math.PI * dtMinutes) / Math.abs(Math.atan2(mode.im, mode.re))
      : null,
  }));
  const spectralRadius = modes[0]?.magnitude ?? null;
  const stable = spectralRadius !== null && spectralRadius < 1;
  return {
    status: stable ? 'ESTIMASI' : 'TIDAK STABIL',
    reason: stable
      ? 'Estimasi eksploratif; belum divalidasi out-of-sample.'
      : 'Model tidak stabil; konstanta waktu pemulihan tidak ditafsirkan.',
    audit: { ...audit, spectral_radius: spectralRadius },
    matrix,
    modes,
    stable,
    dominantTauMinutes: stable ? modes[0]?.tauMinutes ?? null : null,
    pairs,
  };
}

export function buildRecoveryTrajectory(episode, windows, baselines, physiologicalEpisodes = []) {
  const segmentIds = new Set((episode?.segment_ids || []).map(String));
  if (!segmentIds.size && episode?.parent_episode_id) {
    const parentId = String(episode.parent_episode_id);
    const parentEpisode = physiologicalEpisodes.find((item) => String(item._id || '') === parentId);
    (parentEpisode?.segment_ids || []).forEach((id) => segmentIds.add(String(id)));
  }
  const rows = windows
    .filter((window) => segmentIds.has(String(window._id)))
    .map((window) => prepareDynamicWindow(window, baselines))
    .filter((row) => row.timestamp !== null)
    .sort((first, second) => first.timestamp - second.timestamp);
  if (!rows.length) {
    return { points: [], status: 'Bukti window episode tidak tersedia.', ttrMinutes: null };
  }
  const validDistances = rows
    .filter((row) => row.eligible && row.state)
    .map((row) => Math.hypot(...row.state));
  const explicitPeak = toEpochMs(episode?.peak_time);
  const peakIndex = explicitPeak === null
    ? rows.reduce((best, row, index) => (
      row.eligible && row.state
        && Math.hypot(...row.state) > Math.hypot(...(rows[best]?.state || [0, 0, 0]))
        ? index
        : best
    ), 0)
    : rows.reduce((best, row, index) => (
      Math.abs(row.timestamp - explicitPeak) < Math.abs(rows[best].timestamp - explicitPeak) ? index : best
    ), 0);
  let inRangeCount = 0;
  let firstEntryTimestamp = null;
  let confirmedTimestamp = null;
  for (let index = peakIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    const previous = rows[index - 1];
    const expected = WINDOW_DURATIONS[row.windowType] || null;
    const continuous = expected !== null
      && row.timestamp - previous.timestamp > 0
      && Math.abs((row.timestamp - previous.timestamp) - expected) <= expected * 0.25;
    if (!row.eligible || !row.state || !continuous) {
      inRangeCount = 0;
      firstEntryTimestamp = null;
      continue;
    }
    if (Math.hypot(...row.state) <= DISTANCE_THRESHOLD) {
      if (inRangeCount === 0) firstEntryTimestamp = row.timestamp;
      inRangeCount += 1;
      if (inRangeCount >= RECOVERY_DWELL_WINDOWS) {
        confirmedTimestamp = row.timestamp;
        break;
      }
    } else {
      inRangeCount = 0;
      firstEntryTimestamp = null;
    }
  }
  const startTimestamp = rows[0].timestamp;
  const peakTimestamp = rows[peakIndex]?.timestamp ?? startTimestamp;
  const points = rows.map((row, index) => ({
    index: index + 1,
    timestamp: row.timestamp,
    minute: (row.timestamp - startTimestamp) / 60_000,
    distance: row.eligible && row.state ? Math.hypot(...row.state) : null,
    hr: row.hr,
    rmssd: row.rmssd,
    dfa: row.dfa,
    motion: row.motion,
    windowType: row.windowType,
    quality: Math.min(row.quality.signalQuality ?? 0, row.quality.completeness ?? 0),
    eligible: row.eligible,
    isPeak: index === peakIndex,
    isFirstEntry: row.timestamp === firstEntryTimestamp,
    isConfirmation: row.timestamp === confirmedTimestamp,
  }));
  return {
    points,
    peakTimestamp,
    firstEntryTimestamp,
    confirmedTimestamp,
    ttrMinutes: confirmedTimestamp === null ? null : (confirmedTimestamp - peakTimestamp) / 60_000,
    status: confirmedTimestamp === null
      ? validDistances.length ? 'Belum terkonfirmasi' : 'Bukti kualitas/baseline tidak cukup'
      : 'Terkonfirmasi oleh aturan observasional',
    threshold: DISTANCE_THRESHOLD,
    dwellWindows: RECOVERY_DWELL_WINDOWS,
    recordedTtrMinutes: numberOrNull(episode?.ttr_min),
  };
}

export function analyzeDynamicProfile({ windows, baselines, activities, activity }) {
  const episodes = groupDynamicEpisodes(windows, activities)
    .filter((episode) => activity === 'all' || episode.activity === activity)
    .map((episode) => ({
      ...episode,
      rows: episode.windows.map((window) => prepareDynamicWindow(window, baselines)),
    }));
  const overall = fitDynamicModel(episodes);
  const byDayAndActivity = new Map();
  for (const episode of episodes) {
    if (!episode.day) continue;
    const key = `${episode.day}\u0000${episode.activity}`;
    if (!byDayAndActivity.has(key)) byDayAndActivity.set(key, []);
    byDayAndActivity.get(key).push(episode);
  }
  const daily = [...byDayAndActivity.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([, dayEpisodes]) => ({
      day: dayEpisodes[0].day,
      activity: dayEpisodes[0].activity,
      ...fitDynamicModel(dayEpisodes),
    }));
  return { episodes, overall, daily };
}

export function buildDynamicProfileGraph({
  participant,
  scope = 'day',
  day,
  windows = [],
  activity = 'all',
  episodes = [],
  selectedEpisode = null,
  selectedWindow = null,
  selectedWindowAttributes = null,
  selectedWindowState = null,
  model,
  profileTau = null,
  ttrMedian = null,
}) {
  const graphNodes = [];
  const graphEdges = [];
  const nodeWidth = 155;
  const activityByDay = new Map();
  for (const window of windows) {
    const windowDay = getJakartaDay(window.window_start);
    if (!windowDay) continue;
    if (!activityByDay.has(windowDay)) activityByDay.set(windowDay, new Map());
    const label = window.activity_label || 'Unknown';
    const windowsForActivity = activityByDay.get(windowDay).get(label) || [];
    windowsForActivity.push(window);
    activityByDay.get(windowDay).set(label, windowsForActivity);
  }

  const availableDays = [...activityByDay.keys()].sort();
  const days = scope === 'day' && day
    ? [day]
    : availableDays.slice(-5);
  if (!days.length) days.push(day || 'Belum ada hari');
  const dayEntries = days.map((date) => {
    const activities = activityByDay.get(date);
    const entries = activities
      ? [...activities.entries()].map(([label, items]) => ({ label, windows: items }))
      : [];
    if (activity !== 'all') {
      const selected = entries.filter((entry) => entry.label === activity);
      if (selected.length) return { date, entries: selected };
      if (!entries.length) return { date, entries: [{ label: activity, windows: [] }] };
    }
    return {
      date,
      entries: entries.length ? entries.slice(0, 5) : [{ label: 'Belum ada aktivitas', windows: [] }],
    };
  });
  const maxActivityCount = Math.max(1, ...dayEntries.map(({ entries }) => entries.length));
  const graphWidth = Math.max(900, (maxActivityCount + 1) * 190);
  const centerX = graphWidth / 2;
  const personId = 'person';
  graphNodes.push({
    id: personId,
    title: participant || 'Individu',
    sub: 'Individu',
    x: centerX,
    y: 38,
    type: 'context',
    info: 'Subjek pengamatan CAPAR',
    w: nodeWidth,
  });

  let selectedWindowNodeAdded = false;
  dayEntries.forEach(({ date, entries }, dayIndex) => {
    const dayY = scope === 'person' ? 135 : 130 + (dayIndex * 245);
    const dayId = `day:${date}`;
    const totalWindows = entries.reduce((sum, entry) => sum + entry.windows.length, 0);
    graphNodes.push({
      id: dayId,
      title: date,
      sub: `${totalWindows} window`,
      x: scope === 'person'
        ? (dayEntries.length === 1 ? centerX : 80 + (dayIndex * ((graphWidth - 160) / (dayEntries.length - 1))))
        : centerX,
      y: dayY,
      type: 'context',
      info: `Hari pengamatan ${date}`,
      attributes: { day: date, windows: totalWindows },
      action: getJakartaDay(date) ? { type: 'day', value: date } : null,
      w: nodeWidth,
    });
    graphEdges.push({ from: personId, to: dayId, rel: 'hasDay' });

    if (scope === 'person') {
      graphEdges.push({ from: dayId, to: 'observations', rel: 'hasObservation' });
      return;
    }

    entries.forEach(({ label, windows: activityWindows }, activityIndex) => {
      const activityX = ((activityIndex + 1) * graphWidth) / (entries.length + 1);
      const activityId = `activity:${dayIndex}:${activityIndex}`;
      graphNodes.push({
        id: activityId,
        title: label,
        sub: `${activityWindows.length} window`,
        x: activityX,
        y: dayY + 92,
        type: 'context',
        info: `Aktivitas ${label} pada ${date}`,
        attributes: { activity: label, windows: activityWindows.length },
        action: activityWindows.length ? { type: 'activity', value: label } : null,
        w: nodeWidth,
      });
      graphEdges.push({ from: dayId, to: activityId, rel: 'hasActivity' });

      if (scope === 'activity') {
        let episodeNodes = episodes.filter((episode) => (
          (activity === 'all' || (episode.activity || 'Unknown') === label)
          && getJakartaDay(episode.onset_time) === date
        )).slice(-5);
        if (selectedEpisode && !episodeNodes.some((episode) => (
          String(episode._id || '') === String(selectedEpisode._id || '')
        ))) {
          episodeNodes = [...episodeNodes.slice(1), selectedEpisode];
        }
        if (!episodeNodes.length) episodeNodes = [null];
        episodeNodes.forEach((episode, episodeIndex) => {
          const episodeX = episodeNodes.length === 1
            ? activityX
            : 80 + (episodeIndex * ((graphWidth - 160) / (episodeNodes.length - 1)));
          const episodeId = episode?._id ? `episode:${String(episode._id)}` : `episode:unavailable:${dayIndex}:${activityIndex}`;
          graphNodes.push({
            id: episodeId,
            title: episode ? `Episode ${episodeIndex + 1}` : 'Episode fisiologis',
            sub: episode ? `${getEpisodeWindowCount(episode, episodes)} window · TTR ${numberOrNull(episode.ttr_min) ?? '—'} min` : 'Belum tersedia',
            x: episodeX,
            y: dayY + 175,
            type: 'observation',
            info: episode
              ? `${episode.classification || 'Episode'} · ${toEpochMs(episode.onset_time) === null ? 'waktu tidak tersedia' : new Date(toEpochMs(episode.onset_time)).toISOString()}`
              : 'Episode fisiologis belum tersedia untuk aktivitas ini.',
            attributes: episode ? {
              episode_id: String(episode._id),
              classification: episode.classification || null,
              onset_time: toEpochMs(episode.onset_time) === null
                ? null
                : new Date(toEpochMs(episode.onset_time)).toISOString(),
              windows: getEpisodeWindowCount(episode, episodes),
              recorded_ttr_minutes: numberOrNull(episode.ttr_min),
            } : {},
            action: episode?._id ? { type: 'episode', value: String(episode._id) } : null,
            w: nodeWidth,
          });
          graphEdges.push({ from: activityId, to: episodeId, rel: 'hasEpisode' });
        });
      }

      if (scope === 'window' && !selectedWindowNodeAdded && selectedWindow
        && getJakartaDay(selectedWindow.window_start) === date
        && (selectedWindow.activity_label || 'Unknown') === label) {
        const selectedId = String(selectedWindow._id || 'selected');
        const selectedTimestamp = toEpochMs(selectedWindow.window_start);
        const attributes = {
          timestamp: selectedTimestamp === null ? null : new Date(selectedTimestamp).toISOString(),
          hr_bpm: numberOrNull(selectedWindow.features?.mean_hr),
          rmssd_ms: numberOrNull(selectedWindow.features?.rmssd),
          dfa_alpha1: numberOrNull(selectedWindow.features?.dfa_alpha1),
          motion_intensity: numberOrNull(selectedWindow.features?.motion_intensity),
          signal_quality: numberOrNull(selectedWindow.signal_quality_detail?.q_signal),
          signal_completeness: numberOrNull(selectedWindow.signal_quality_detail?.q_complete),
        };
        graphNodes.push({
          id: `window:${selectedId}`,
          title: 'Window terpilih',
          sub: 'Window observasi',
          x: activityX,
          y: dayY + 175,
          type: 'observation',
          info: [
            `${label} · ${attributes.timestamp || 'waktu tidak tersedia'}`,
            `HR: ${attributes.hr_bpm ?? '—'} bpm`,
            `RMSSD: ${attributes.rmssd_ms ?? '—'} ms`,
            `DFA α1: ${attributes.dfa_alpha1 ?? '—'}`,
            `Gerak: ${attributes.motion_intensity ?? '—'}`,
            `Kualitas sinyal: ${attributes.signal_quality ?? '—'}`,
            `Kelengkapan: ${attributes.signal_completeness ?? '—'}`,
          ].join('\n'),
          attributes,
          action: { type: 'window', value: selectedId },
          w: nodeWidth,
        });
        graphEdges.push({ from: activityId, to: `window:${selectedId}`, rel: 'hasWindow' });
        selectedWindowNodeAdded = true;
        const selectedAttributes = selectedWindowAttributes || {};
        const state = selectedWindowState?.state || null;
        const featureSpecs = [
          { key: 'hr', title: 'HR', value: selectedAttributes.hr, unit: 'BPM', state: state?.[0] },
          { key: 'rmssd', title: 'RMSSD', value: selectedAttributes.rmssd, unit: 'ms', state: state?.[1] },
          { key: 'dfa', title: 'DFA α1', value: selectedAttributes.dfa, unit: '', state: state?.[2] },
          { key: 'acc', title: 'ACC', value: selectedAttributes.acc, unit: '', state: null },
        ];
        featureSpecs.forEach((feature, featureIndex) => {
          const x = 95 + (featureIndex * ((graphWidth - 190) / (featureSpecs.length - 1)));
          const featureId = `feature:${feature.key}`;
          graphNodes.push({
            id: featureId,
            title: feature.title,
            sub: feature.value === null || feature.value === undefined
              ? 'Nilai tidak tersedia'
              : `${feature.value}${feature.unit ? ` ${feature.unit}` : ''}`,
            x,
            y: dayY + 260,
            type: 'observation',
            info: `${feature.title}: ${feature.value ?? '—'}${feature.unit ? ` ${feature.unit}` : ''}${Number.isFinite(feature.state) ? ` · xᵢ ${feature.state.toFixed(3)}` : ''}`,
            attributes: {
              value: numberOrNull(feature.value),
              unit: feature.unit || null,
              standardized_state: Number.isFinite(feature.state) ? feature.state : null,
            },
            w: nodeWidth,
          });
          graphEdges.push({ from: `window:${selectedId}`, to: featureId, rel: 'hasFeature' });
        });
        graphNodes.push({
          id: 'baseline',
          title: 'Baseline personal',
          sub: `HR ${selectedAttributes.hr_base ?? '—'} · RMSSD ${selectedAttributes.rmssd_base ?? '—'}`,
          x: centerX - 185,
          y: dayY + 355,
          type: 'context',
          info: 'Baseline yang digunakan untuk standardisasi state.',
          attributes: {
            hr_mean: numberOrNull(selectedAttributes.hr_base),
            hr_sd: numberOrNull(selectedAttributes.hr_sd),
            rmssd_mean: numberOrNull(selectedAttributes.rmssd_base),
            lnrmssd_sd: numberOrNull(selectedAttributes.lnrmssd_sd),
            dfa_mean: numberOrNull(selectedAttributes.dfa_base),
            dfa_sd: numberOrNull(selectedAttributes.dfa_sd),
          },
          w: nodeWidth,
        });
        graphNodes.push({
          id: 'deviation',
          title: 'Deviasi D',
          sub: selectedWindowState?.eligible && state ? `D = ${Math.hypot(...state).toFixed(3)}` : 'ABSTAIN',
          x: centerX + 185,
          y: dayY + 355,
          type: 'model',
          info: selectedWindowState?.reasons?.join('; ') || 'Norma Euclidean dari state terstandardisasi.',
          attributes: {
            distance: state ? Math.hypot(...state) : null,
            state,
            eligible: selectedWindowState?.eligible || false,
          },
          w: nodeWidth,
        });
        graphEdges.push(...['hr', 'rmssd', 'dfa'].flatMap((key) => ([
          { from: `feature:${key}`, to: 'baseline', rel: 'comparedWith' },
          { from: `feature:${key}`, to: 'deviation', rel: 'contributes' },
        ])));
        graphEdges.push({ from: 'baseline', to: 'deviation', rel: 'reference' });
      }
    });
  });

  if (scope === 'person') {
    graphNodes.push({
      id: 'observations',
      title: 'Observasi individu',
      sub: `${windows.length} window`,
      x: centerX,
      y: 245,
      type: 'observation',
      info: 'Gabungan seluruh hari dan aktivitas pemicu.',
      attributes: { windows: windows.length },
      w: nodeWidth,
    });
  }
  if (scope === 'window' && !selectedWindowNodeAdded) {
    const activityNode = graphNodes.find((node) => node.id.startsWith('activity:'));
    graphNodes.push({
      id: 'window:not-selected',
      title: 'Pilih window',
      sub: 'Observasi lokal',
      x: activityNode?.x || centerX,
      y: 305,
      type: 'observation',
      info: 'Pilih window CAPAR untuk membuka fitur, baseline, dan deviasi.',
      attributes: {},
      w: nodeWidth,
    });
    if (activityNode) graphEdges.push({ from: activityNode.id, to: 'window:not-selected', rel: 'hasWindow' });
  }

  const modelY = scope === 'person'
    ? 335
    : scope === 'activity'
      ? 435
      : scope === 'window'
        ? 570
        : 130 + ((dayEntries.length - 1) * 245) + 205;
  const modelId = 'model';
  const audit = model?.audit || {};
  const hasMatrix = Array.isArray(model?.matrix);
  graphNodes.push({
    id: modelId,
    title: hasMatrix ? 'Model Aᵈ' : 'Dynamic Model',
    sub: `${audit.pair_count || 0} transisi valid`,
    x: centerX,
    y: modelY,
    type: 'model',
    info: model?.reason || 'Belum cukup data untuk mengestimasi model.',
    attributes: {
      status: model?.status || 'ABSTAIN',
      pairs: audit.pair_count || 0,
      rank: audit.rank || 0,
      condition_number: audit.condition_number ?? null,
      rmse: audit.rmse ?? null,
    },
    w: nodeWidth,
  });
  graphEdges.push(...graphNodes
    .filter((node) => node.id.startsWith('activity:') && node.attributes?.windows > 0)
    .map((node) => ({ from: node.id, to: modelId, rel: 'usedToEstimate' })));
  graphEdges.push(...graphNodes
    .filter((node) => node.id.startsWith('episode:') && node.action)
    .map((node) => ({ from: node.id, to: modelId, rel: 'usedToEstimate' })));
  if (scope === 'person' && windows.length) {
    graphEdges.push({ from: 'observations', to: modelId, rel: 'usedToEstimate' });
  }
  if (selectedWindowNodeAdded) {
    const selectedWindowNode = graphNodes.find((node) => node.id.startsWith('window:'));
    graphEdges.push({ from: selectedWindowNode.id, to: modelId, rel: 'modelContext' });
    graphEdges.push({ from: 'deviation', to: modelId, rel: 'informsModel' });
    graphEdges.push({ from: 'feature:acc', to: modelId, rel: 'contextEvidence' });
  }

  const modeId = 'mode';
  graphNodes.push({
    id: modeId,
    title: hasMatrix ? 'Eigenmode' : 'Audit kelayakan',
    sub: hasMatrix
      ? `ρ = ${Number.isFinite(audit.spectral_radius) ? audit.spectral_radius.toFixed(3) : '—'}`
      : model?.status || 'ABSTAIN',
    x: centerX - 185,
    y: modelY + 105,
    type: 'model',
    info: `Spektrum model lingkup saat ini; ${model?.reason || 'model belum dapat diestimasi.'}`,
    w: nodeWidth,
  });
  graphNodes.push({
    id: 'profile',
    title: 'Dynamic Profile',
    sub: Number.isFinite(profileTau) ? `τ dom. ${profileTau.toFixed(1)} min` : 'Belum diestimasi',
    x: centerX + 185,
    y: modelY + 105,
    type: 'model',
    info: `TTR median observasional: ${Number.isFinite(ttrMedian) ? `${ttrMedian.toFixed(1)} menit` : 'belum tersedia'}.`,
    w: nodeWidth,
  });
  graphEdges.push(
    { from: modelId, to: modeId, rel: hasMatrix ? 'hasEigenmode' : 'hasAudit' },
    { from: modelId, to: 'profile', rel: 'characterizes' },
  );

  return {
    nodes: graphNodes,
    edges: graphEdges,
    width: graphWidth,
    height: modelY + 165,
  };
}

export const DYNAMIC_ANALYSIS_POLICY = {
  qualityThreshold: QUALITY_THRESHOLD,
  minimumPairs: MINIMUM_PAIRS,
  minimumRank: MINIMUM_RANK,
  maximumConditionNumber: MAXIMUM_CONDITION_NUMBER,
  distanceThreshold: DISTANCE_THRESHOLD,
  recoveryDwellWindows: RECOVERY_DWELL_WINDOWS,
};
