import { SCENARIO_BASELINE_POLICY } from '../config/scenarioBaselinePolicy.js';

export const SCENARIO_DEFINITIONS = Object.freeze({
  a: {
    id: 'a',
    title: 'Satu arah',
    interaction: 'Hasil awal ditampilkan tanpa kanal koreksi konteks.',
  },
  b: {
    id: 'b',
    title: 'Dua arah nonadaptif',
    interaction: 'Respons dicatat, tetapi interpretasi awal tidak berubah.',
  },
  c: {
    id: 'c',
    title: 'Dua arah adaptif',
    interaction: 'Koreksi konteks dievaluasi ulang terhadap bukti dan baseline.',
  },
});

export const CAPAR_ACTIVITY_LABELS = Object.freeze({
  rest: 'Rest',
  sitting: 'Rest',
  standing: 'Rest',
  sleep: 'Rest',
  walking: 'Light',
  running: 'Intense',
  exercise: 'Moderate',
  work: 'Unknown',
  other: 'Unknown',
});

export const SCENARIO_RULE_VERSION = 'scenario-reasoning-v1';

export function assessScenarioBaseline(baseline, baselineSegments = []) {
  if (!baseline) {
    return {
      ready: false,
      status: 'INELIGIBLE',
      reason_code: 'BASELINE_NOT_FOUND',
      valid_duration_seconds: 0,
      distinct_days: 0,
      valid_window_count: 0,
      policy: SCENARIO_BASELINE_POLICY,
    };
  }

  const timestamps = baselineSegments.length
    ? baselineSegments.map((segment) => segment.window_start)
    : Array.isArray(baseline.window_timestamps)
      ? baseline.window_timestamps
      : [];
  const signals = baselineSegments.length
    ? baselineSegments.map((segment) => segment.signal_quality_detail?.q_signal)
    : Array.isArray(baseline.q_signal_history)
      ? baseline.q_signal_history
      : [];
  const completeness = baselineSegments.length
    ? baselineSegments.map((segment) => segment.signal_quality_detail?.q_complete)
    : Array.isArray(baseline.q_complete_history)
      ? baseline.q_complete_history
      : [];
  const validDays = new Set();
  const validWindows = new Set();

  timestamps.forEach((timestamp, index) => {
    const signal = signals[index];
    const complete = completeness[index];
    if (
      !Number.isFinite(timestamp)
      || !Number.isFinite(signal)
      || !Number.isFinite(complete)
      || signal < SCENARIO_BASELINE_POLICY.minimum_quality
      || complete < SCENARIO_BASELINE_POLICY.minimum_quality
    ) {
      return;
    }
    validWindows.add(Math.floor(timestamp / 60_000));
    validDays.add(new Date(timestamp).toISOString().slice(0, 10));
  });

  const validWindowCount = validWindows.size;
  const validDurationSeconds =
    validWindowCount * SCENARIO_BASELINE_POLICY.window_seconds;
  const distinctDays = validDays.size;
  const hasValidDuration =
    validDurationSeconds >= SCENARIO_BASELINE_POLICY.minimum_valid_seconds;
  const hasFormationDay =
    distinctDays >= SCENARIO_BASELINE_POLICY.minimum_distinct_days;
  const ready = hasValidDuration && hasFormationDay;

  return {
    ready,
    status: ready ? 'ELIGIBLE' : 'INELIGIBLE',
    reason_code: !hasFormationDay
      ? 'BASELINE_FORMATION_DAY_INSUFFICIENT'
      : !hasValidDuration
        ? 'VALID_DATA_UNDER_TEN_MINUTES'
        : null,
    valid_duration_seconds: validDurationSeconds,
    distinct_days: distinctDays,
    valid_window_count: validWindowCount,
    policy: SCENARIO_BASELINE_POLICY,
  };
}

export function buildScenarioInterpretation({
  version,
  scenarioId,
  segment,
  baseline,
  baselineReadiness,
  score = null,
  triggerEventId = null,
  previousVersion = null,
}) {
  const quality = segment?.signal_quality_detail || {};
  const qualityAvailable =
    segment?.is_valid === true
    && segment?.analyzed === true
    && segment?.signal_quality?.is_artifact !== true
    && (segment?.quality_audit?.gate_passed === true
      || (
        Number.isFinite(quality.q_signal)
        && Number.isFinite(quality.q_complete)
        && quality.q_signal >= SCENARIO_BASELINE_POLICY.minimum_quality
        && quality.q_complete >= SCENARIO_BASELINE_POLICY.minimum_quality
      ));
  const baselineAvailable = Boolean(baselineReadiness?.ready && score?.available);
  const state = !qualityAvailable || !baselineAvailable
    ? 'UNRESOLVED'
    : score.squared_distance <= score.thresholds.mild
      ? 'BASELINE_COMPATIBLE'
      : 'DEVIATION_CANDIDATE';
  const reasonCode = !qualityAvailable
    ? 'OBSERVATION_QUALITY_INSUFFICIENT'
    : !baselineReadiness?.ready
      ? baselineReadiness?.reason_code || 'BASELINE_UNAVAILABLE'
      : !score?.available
        ? score?.reason || 'STATISTICAL_COMPARISON_UNAVAILABLE'
        : null;

  return {
    version,
    scenario_id: scenarioId,
    created_at: new Date(),
    status: state,
    processing_state: state === 'UNRESOLVED' ? 'NEEDS_REVIEW' : 'APPLIED',
    reason_code: reasonCode,
    context: {
      activity: segment?.activity ?? segment?.activity_label ?? null,
      time_period: segment?.time_period ?? null,
    },
    observed_at: Number.isFinite(segment?.window_start)
      ? new Date(segment.window_start)
      : null,
    observation: {
      source: 'CAPAR_ANALYZED_SEGMENT',
      source_provenance: 'CAPAR segment; underlying device provenance is not guaranteed by this record.',
      segment_id: segment?._id?.toString?.() ?? null,
      quality: {
        signal: quality.q_signal ?? null,
        completeness: quality.q_complete ?? null,
        gate_passed: qualityAvailable,
        source_gate_passed: segment?.quality_audit?.gate_passed === true,
      },
      features: {
        mean_hr: segment?.features?.mean_hr ?? null,
        rmssd: segment?.features?.rmssd ?? null,
        mean_rr: segment?.features?.mean_rr ?? null,
        motion_intensity: segment?.features?.motion_intensity ?? null,
      },
    },
    baseline: {
      activity: baseline?.activity ?? null,
      time_period: baseline?.time_period ?? null,
      version: baseline?.version ?? null,
      status: baselineReadiness?.status ?? 'INELIGIBLE',
      valid_duration_seconds: baselineReadiness?.valid_duration_seconds ?? 0,
      distinct_days: baselineReadiness?.distinct_days ?? 0,
      reason_code: baselineReadiness?.reason_code ?? 'BASELINE_NOT_FOUND',
      policy: baselineReadiness?.policy ?? SCENARIO_BASELINE_POLICY,
    },
    statistical_evidence: score?.available
      ? {
        distance: score.distance,
        squared_distance: score.squared_distance,
        thresholds: score.thresholds,
        feature_keys: score.feature_keys,
        sample_count: score.sample_count,
      }
      : null,
    uncertainty: state === 'UNRESOLVED'
      ? 'Bukti kualitas atau baseline belum mencukupi untuk perbandingan personal.'
      : 'Interpretasi observasional; bukan diagnosis atau probabilitas klinis.',
    reason: reasonCode
      ? 'Interpretasi personal ditahan karena persyaratan bukti belum terpenuhi.'
      : state === 'BASELINE_COMPATIBLE'
        ? 'Jarak statistik berada dalam ambang perbandingan baseline CAPAR untuk konteks yang sama.'
        : 'Terdapat kandidat perbedaan statistik dari baseline CAPAR; satu window tidak menetapkan persistensi atau risiko klinis.',
    trigger_event_id: triggerEventId,
    previous_version: previousVersion,
    rule_version: SCENARIO_RULE_VERSION,
  };
}

export function mapScenarioActivity(activity) {
  if (['Rest', 'Light', 'Moderate', 'Intense', 'Unknown'].includes(activity)) {
    return activity;
  }
  return CAPAR_ACTIVITY_LABELS[activity] ?? null;
}
