export const PATIENT_HIL_BASELINE_POLICY = Object.freeze({
  version: 'patient-hil-baseline-v1',
  minimum_valid_minutes: 5,
  minimum_quality: 0.6,
  window_seconds: 60,
});

const supportedActivities = new Set(['sitting', 'standing', 'walking']);

export function buildPatientHilBaselineWindow(sample, accountId, accountType) {
  if (
    sample?.provider !== 'polar_h10'
    || sample?.source !== 'mobile_wearable_bridge'
    || sample?.ingestion_source !== 'mobile_wearable_bridge'
    || sample?.is_simulated === true
    || sample?.sensor_contact !== true
    || sample?.data_quality?.status !== 'accepted'
    || !supportedActivities.has(sample?.activity)
    || !Number.isFinite(new Date(sample.recorded_at).getTime())
  ) {
    return null;
  }

  const recordedAt = new Date(sample.recorded_at);
  const rrIntervals = Array.isArray(sample.rr_intervals_ms)
    ? sample.rr_intervals_ms.filter(Number.isFinite)
    : [];
  const meanRr = rrIntervals.length
    ? rrIntervals.reduce((sum, value) => sum + value, 0) / rrIntervals.length
    : null;

  return {
    account_id: accountId,
    account_type: accountType,
    activity: sample.activity,
    window_start: Math.floor(recordedAt.getTime() / 60_000) * 60_000,
    sample_id: sample._id,
    recorded_at: recordedAt,
    quality: {
      q_signal: sample.data_quality.q_signal,
      q_complete: sample.data_quality.q_complete,
    },
    features: {
      mean_hr: sample.heart_rate_bpm,
      mean_rr: meanRr,
      rmssd: sample.rmssd_ms,
      sdnn: sample.sdnn_ms,
      dfa_alpha1: sample.dfa_alpha1,
      motion_intensity: sample.motion_intensity ?? null,
    },
  };
}

function summarizeFeature(windows, feature) {
  const values = windows
    .map((window) => window.features?.[feature])
    .filter(Number.isFinite);
  if (!values.length) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce(
    (sum, value) => sum + (value - mean) ** 2,
    0
  ) / values.length;
  return {
    count: values.length,
    mean,
    standard_deviation: Math.sqrt(variance),
  };
}

export function summarizePatientHilBaselines(windows) {
  const byActivity = new Map();
  for (const window of windows) {
    if (!supportedActivities.has(window.activity)) continue;
    const activityWindows = byActivity.get(window.activity) ?? new Map();
    const minute = Math.floor(window.window_start / 60_000);
    const current = activityWindows.get(minute);
    if (!current || new Date(window.recorded_at) > new Date(current.recorded_at)) {
      activityWindows.set(minute, window);
    }
    byActivity.set(window.activity, activityWindows);
  }

  return [...byActivity.entries()].map(([activity, minuteMap]) => {
    const allWindows = [...minuteMap.values()];
    const acceptedWindows = allWindows.filter((window) => (
      Number.isFinite(window.quality?.q_signal)
      && Number.isFinite(window.quality?.q_complete)
      && window.quality.q_signal >= PATIENT_HIL_BASELINE_POLICY.minimum_quality
      && window.quality.q_complete >= PATIENT_HIL_BASELINE_POLICY.minimum_quality
    ));
    const distinctDays = new Set(
      acceptedWindows.map((window) => new Date(window.window_start).toISOString().slice(0, 10))
    ).size;
    const validWindowCount = acceptedWindows.length;
    const ready = validWindowCount >= PATIENT_HIL_BASELINE_POLICY.minimum_valid_minutes
      && distinctDays > 0;
    const features = [
      'mean_hr',
      'mean_rr',
      'rmssd',
      'sdnn',
      'dfa_alpha1',
      'motion_intensity',
    ];

    return {
      activity,
      segment_count: allWindows.length,
      feature_stats: Object.fromEntries(
        features
          .map((feature) => [feature, summarizeFeature(acceptedWindows, feature)])
          .filter(([, stats]) => stats !== null)
      ),
      scenario_readiness: {
        ready,
        status: ready ? 'ELIGIBLE' : 'INELIGIBLE',
        reason_code: ready
          ? null
          : 'VALID_DATA_UNDER_MINIMUM_DURATION',
        valid_duration_seconds:
          validWindowCount * PATIENT_HIL_BASELINE_POLICY.window_seconds,
        distinct_days: distinctDays,
        valid_window_count: validWindowCount,
        policy: PATIENT_HIL_BASELINE_POLICY,
      },
    };
  });
}
