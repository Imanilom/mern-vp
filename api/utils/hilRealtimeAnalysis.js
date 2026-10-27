import { assessRRQuality, extractRRFeatures } from './rrBaselinePipeline.js';

const FEATURES = ['mean_hr', 'rmssd', 'sdnn', 'dfa_alpha1'];
const MIN_HR_SAMPLES = 3;
const MIN_SIGNAL_CONFIDENCE = 0.5;

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

function linearSlope(readings) {
  if (readings.length < 3) return null;
  const origin = readings[0].recorded_at.getTime();
  const points = readings.map((reading) => ({
    time: (reading.recorded_at.getTime() - origin) / 1000,
    value: reading.heart_rate_bpm,
  }));
  const meanTime = average(points.map((point) => point.time));
  const meanValue = average(points.map((point) => point.value));
  const numerator = points.reduce(
    (sum, point) => sum + (point.time - meanTime) * (point.value - meanValue),
    0
  );
  const denominator = points.reduce(
    (sum, point) => sum + (point.time - meanTime) ** 2,
    0
  );
  return denominator > 0 ? (numerator / denominator) * 60 : null;
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
  const meanHr = average(readings.map((reading) => reading.heart_rate_bpm));
  const meanConfidence = average(readings.map((reading) => reading.signal_confidence));
  const hrQualityAccepted =
    readings.length >= MIN_HR_SAMPLES
    && readings.every((reading) => reading.sensor_contact)
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
    mean_hr: meanHr,
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

  const hrBaseline = comparisons.mean_hr.baseline_mean;
  const hrStd = comparisons.mean_hr.baseline_std;
  const hrThreshold = hrStd === null ? 10 : Math.max(10, hrStd * 2);
  const hrElevated = meanHr !== null && hrBaseline !== null
    && meanHr > hrBaseline + hrThreshold;
  const previousHr = evaluation.previous_mean_hr;
  const approachingBaseline = meanHr !== null && hrBaseline !== null
    && previousHr !== undefined && meanHr < previousHr
    && Math.abs(meanHr - hrBaseline) < Math.abs(previousHr - hrBaseline);
  const recoveryTrend = evaluation.previous_elevated === true
    && approachingBaseline;

  const baselineAvailable = hrBaseline !== null;
  const qualityAccepted = hrQualityAccepted;
  const isCandidate = hrElevated
    || FEATURES.slice(1).some((feature) => comparisons[feature].candidate);
  const status = !qualityAccepted || !baselineAvailable
    ? 'not_assessable'
    : recoveryTrend
      ? Math.abs(meanHr - hrBaseline) <= hrThreshold
        ? 'recovered'
        : 'recovery_trend'
      : isCandidate
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
      ? 'Teramati kandidat perubahan dibanding baseline personal. Ini bukan diagnosis atau penentuan penyebab.'
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
      mean_hr: meanHr,
      hr_slope_bpm_per_minute: linearSlope(readings),
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
    },
    comparisons,
    interpretation: {
      status,
      detail,
      is_candidate: status === 'candidate_deviation',
      is_recovery: status === 'recovery_trend' || status === 'recovered',
      provisional_baseline: baselineAvailable && baselineLevel !== 'mature',
    },
  };
}
