const RMSSD_RR_MIN_MS = 300;
const RMSSD_RR_MAX_MS = 2000;
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_GAP_MS = 30_000;

function timestampMilliseconds(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.abs(timestamp) >= 10_000_000_000
    ? timestamp
    : timestamp * 1000;
}

export function calculateRmssd(rrIntervals) {
  if (!Array.isArray(rrIntervals)) return null;
  const valid = rrIntervals.filter((rr) =>
    Number.isFinite(rr) && rr >= RMSSD_RR_MIN_MS && rr <= RMSSD_RR_MAX_MS
  );
  if (valid.length < 2) return null;
  let squaredDifferenceSum = 0;
  for (let index = 1; index < valid.length; index++) {
    squaredDifferenceSum += (valid[index] - valid[index - 1]) ** 2;
  }
  return Math.sqrt(squaredDifferenceSum / (valid.length - 1));
}

export function calculateRollingRmssd(
  readings,
  {
    windowMs = DEFAULT_WINDOW_MS,
    maxGapMs = DEFAULT_MAX_GAP_MS,
  } = {}
) {
  const results = new Array(Array.isArray(readings) ? readings.length : 0).fill(null);
  if (!Array.isArray(readings) || readings.length === 0) return results;

  const ordered = readings
    .map((reading, index) => {
      const timestamp = timestampMilliseconds(
        reading.timestamp ?? reading.ts ?? reading.recorded_at
      );
      const rr = Number(
        reading.rr_interval ?? reading.rr ?? reading.rrInterval
      );
      return {
        index,
        timestamp,
        rr,
        activity: reading.activity ?? reading.motion_state ?? null,
      };
    })
    .filter((reading) => (
      reading.timestamp !== null
      && Number.isFinite(reading.rr)
      && reading.rr >= RMSSD_RR_MIN_MS
      && reading.rr <= RMSSD_RR_MAX_MS
    ))
    .sort((left, right) => left.timestamp - right.timestamp || left.index - right.index);

  let window = [];
  let previous = null;
  for (const reading of ordered) {
    if (
      previous
      && (
        reading.activity !== previous.activity
        || reading.timestamp - previous.timestamp > maxGapMs
      )
    ) {
      window = [];
    }
    const cutoff = reading.timestamp - windowMs;
    window = window.filter((item) => item.timestamp >= cutoff);
    window.push(reading);
    const rmssd = calculateRmssd(window.map((item) => item.rr));
    results[reading.index] = rmssd === null ? null : Number(rmssd.toFixed(2));
    previous = reading;
  }
  return results;
}
