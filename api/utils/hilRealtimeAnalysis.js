import { assessRRQuality, extractRRFeatures } from './rrBaselinePipeline.js';

const FEATURES = ['rmssd', 'sdnn', 'dfa_alpha1'];
const MIN_HR_SAMPLES = 1;
const MIN_SIGNAL_CONFIDENCE = 0.6;

function average(values) {
  return values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null;
}

function baselineFeature(baselines, feature) {
  const means = [];
  const deviations = [];
  for (const baseline of baselines) {
    const stat = baseline.stats?.[feature];
    if (Number.isFinite(stat?.mean)) means.push(stat.mean);
    if (Number.isFinite(stat?.std) && stat.std >= 0) deviations.push(stat.std);
  }
  return { mean: average(means), std: average(deviations) };
}

function accelerationVariability(readings) {
  const magnitudes = readings.map((reading) => {
    const [x, y, z] = reading.acceleration_g;
    return Math.sqrt(x ** 2 + y ** 2 + z ** 2);
  });
  if (magnitudes.length < 4) return null;
  const mean = average(magnitudes);
  return Math.sqrt(
    magnitudes.reduce((sum, value) => sum + (value - mean) ** 2, 0)
      / magnitudes.length
  );
}

export function analyzeHilRealtimeEvaluation(evaluation, baselines) {
  const { readings, dfa_rr_intervals_ms: dfaIntervals = [] } = evaluation;
  const validReadings = readings.filter((reading) =>
    reading.sensor_contact === true
    && Number.isFinite(reading.signal_confidence)
    && reading.signal_confidence >= MIN_SIGNAL_CONFIDENCE
    && Number.isFinite(reading.heart_rate_bpm)
    && reading.heart_rate_bpm >= 20
    && reading.heart_rate_bpm <= 250
  );
  const maximumReading = validReadings.reduce((maximum, reading) =>
    maximum === null || reading.heart_rate_bpm > maximum.heart_rate_bpm
      ? reading
      : maximum
  , null);
  const maxHr = maximumReading?.heart_rate_bpm ?? null;
  const meanConfidence = average(readings.map((reading) => reading.signal_confidence));
  const hrQualityAccepted =
    readings.length >= MIN_HR_SAMPLES
    && validReadings.length === readings.length
    && meanConfidence >= MIN_SIGNAL_CONFIDENCE;

  const windowRr = readings.map((reading) => reading.rr_interval_ms);
  const windowRrQuality = assessRRQuality(windowRr, meanConfidence);
  const windowFeatures = windowRrQuality.accepted
    ? extractRRFeatures(windowRrQuality.rr_clean, [], [], [], Number.MAX_SAFE_INTEGER)
    : null;

  const dfaQuality = dfaIntervals.length
    ? assessRRQuality(dfaIntervals, meanConfidence)
    : null;
  const dfaFeatures = dfaQuality?.accepted
    ? extractRRFeatures(dfaQuality.rr_clean, [], [], [], 64)
    : null;
  const features = {
    rmssd: windowFeatures?.rmssd ?? null,
    sdnn: windowFeatures?.sdnn ?? null,
    dfa_alpha1: dfaFeatures?.dfa_alpha1 ?? null,
  };
  const comparisons = Object.fromEntries(FEATURES.map((feature) => {
    const baseline = baselineFeature(baselines, feature);
    const value = features[feature];
    const zScore = value !== null && baseline.mean !== null
      && baseline.std !== null && baseline.std > 0
      ? (value - baseline.mean) / baseline.std
      : null;
    return [feature, {
      value,
      baseline_mean: baseline.mean,
      baseline_std: baseline.std,
      z_score: zScore,
      candidate: zScore !== null && Math.abs(zScore) >= 2,
    }];
  }));

  const { mean: hrBaseline, std: hrStd } = baselineFeature(baselines, 'mean_hr');
  const contextActivityMeanHr = evaluation.context_activity_mean_hr ?? null;
  const comparisonHrBaseline = contextActivityMeanHr ?? hrBaseline;
  comparisons.max_hr = {
    value: maxHr,
    baseline_mean: comparisonHrBaseline,
    baseline_std: hrStd,
    reference: contextActivityMeanHr === null
      ? 'personal_baseline'
      : 'repeated_activity_session_average',
    candidate: maxHr !== null && hrBaseline !== null
      && maxHr > comparisonHrBaseline
        + (hrStd === null ? 10 : Math.max(10, hrStd * 2)),
  };
  const baselineAvailable = hrBaseline !== null;
  const canAttribute = baselineAvailable && hrQualityAccepted;
  const hrThreshold = hrStd === null ? 10 : Math.max(10, hrStd * 2);
  const temporalAttributions = validReadings.map((reading) => ({
    recorded_at: reading.recorded_at,
    feature: 'heart_rate_bpm',
    value: reading.heart_rate_bpm,
    baseline_mean: hrBaseline,
    is_peak: reading === maximumReading,
    importance: reading === maximumReading ? 1 : 0,
  }));
  const hrElevated = maxHr !== null && comparisonHrBaseline !== null
    && maxHr > comparisonHrBaseline + hrThreshold;
  const previousHr = evaluation.previous_max_hr;
  const approachingBaseline = maxHr !== null && hrBaseline !== null
    && previousHr !== undefined && maxHr < previousHr
    && Math.abs(maxHr - comparisonHrBaseline)
      < Math.abs(previousHr - comparisonHrBaseline);
  const recoveryTrend = evaluation.previous_elevated === true
    && approachingBaseline;

  const qualityAccepted = hrQualityAccepted;
  const status = !qualityAccepted || !baselineAvailable
    ? 'not_assessable'
    : recoveryTrend
      ? Math.abs(maxHr - comparisonHrBaseline) <= hrThreshold
        ? 'recovered'
        : 'recovery_trend'
      : hrElevated
        ? 'candidate_deviation'
        : 'normal';
  const maturityLevels = baselines.map((baseline) =>
    ['mature', 'mature_legacy'].includes(baseline.maturity_detail?.level)
      || baseline.is_mature
      ? 'mature'
      : baseline.maturity_detail?.level || 'provisional'
  );
  const baselineLevel = maturityLevels.length === 0
    ? 'unavailable'
    : maturityLevels.every((level) => level === 'mature')
      ? 'mature'
      : 'provisional';
  const detail = status === 'not_assessable'
    ? !qualityAccepted
      ? 'Kualitas atau jumlah sampel HR belum memenuhi syarat; interpretasi ditahan.'
      : 'Baseline aktivitas belum tersedia di backend; interpretasi ditahan.'
    : status === 'candidate_deviation'
      ? contextActivityMeanHr === null
        ? 'HR maksimum per detik melampaui pembanding personal. Ini bukan diagnosis atau penentuan penyebab.'
        : 'HR maksimum per detik melampaui rerata rekaman ulang aktivitas pada sesi ini. Baseline personal tidak diubah.'
      : status === 'recovery_trend'
        ? 'HR menurun dan mendekati baseline setelah jendela sebelumnya tinggi; pemulihan masih diamati.'
        : status === 'recovered'
          ? 'HR kembali ke rentang observasi baseline setelah jendela sebelumnya tinggi.'
          : 'Metrik yang tersedia berada dalam rentang pembanding baseline personal.';

  return {
    evaluated_at: new Date(),
    source: 'synchronous_hil_backend',
    activity: evaluation.activity,
    metrics: {
      max_hr: maxHr,
      max_hr_recorded_at: maximumReading?.recorded_at ?? null,
      acceleration_variability_g: accelerationVariability(readings),
      rmssd: features.rmssd,
      sdnn: features.sdnn,
      dfa_alpha1: features.dfa_alpha1,
      rr_count: windowRrQuality.rr_clean.length,
      dfa_rr_count: dfaQuality?.rr_clean.length ?? 0,
    },
    quality: {
      hr_accepted: hrQualityAccepted,
      rr_accepted: windowRrQuality.accepted,
      dfa_accepted: dfaQuality?.accepted ?? false,
      mean_signal_confidence: meanConfidence,
      rr_reasons: windowRrQuality.reasons,
      dfa_reasons: dfaQuality?.reasons ?? [],
    },
    baseline: {
      available: baselineAvailable,
      level: baselineLevel,
      context_count: baselines.length,
      mean_hr: hrBaseline,
      mean_hr_std: hrStd,
      hr_threshold: hrThreshold,
      context_activity_mean_hr: contextActivityMeanHr,
      comparison_reference: contextActivityMeanHr === null
        ? 'personal_baseline'
        : 'repeated_activity_session_average',
    },
    comparisons,
    explanation: {
      available: canAttribute,
      method: 'personal_baseline_deviation_proxy',
      temporal_attributions: temporalAttributions,
      note: 'Attribution statistik untuk membantu tinjauan; bukan CAM, kausalitas, atau diagnosis.',
    },
    interpretation: {
      status,
      detail,
      is_candidate: status === 'candidate_deviation',
      is_recovery: status === 'recovery_trend' || status === 'recovered',
      provisional_baseline: baselineAvailable && baselineLevel !== 'mature',
    },
  };
}
