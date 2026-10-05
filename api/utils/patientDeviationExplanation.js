const FEATURE_CONFIG = [
  {
    key: 'hr_mean',
    baselineKey: 'mean_hr',
    weight: 0.2,
    direction: 'high',
    label: 'Denyut jantung rata-rata',
    unit: 'bpm',
    physiology: 'heart_rate',
  },
  {
    key: 'hr_delta',
    baselineKey: 'delta_hr',
    weight: 0.1,
    direction: 'high',
    label: 'Rentang perubahan denyut jantung',
    unit: 'bpm',
    physiology: 'heart_rate',
  },
  {
    key: 'hr_slope',
    baselineKey: 'slope_hr',
    weight: 0.1,
    direction: 'high',
    label: 'Kenaikan denyut jantung',
    unit: 'bpm/window',
    physiology: 'heart_rate',
  },
  {
    key: 'sdnn',
    baselineKey: 'sdnn',
    weight: 0.15,
    direction: 'low',
    label: 'Variabilitas denyut jantung (SDNN)',
    unit: 'ms',
    physiology: 'rmssd',
  },
  {
    key: 'rmssd',
    baselineKey: 'rmssd',
    weight: 0.2,
    direction: 'low',
    label: 'Variabilitas denyut jantung (RMSSD)',
    unit: 'ms',
    physiology: 'rmssd',
  },
  {
    key: 'dfa_alpha1',
    baselineKey: 'dfa_alpha1',
    weight: 0.2,
    direction: 'absolute',
    label: 'Pola DFA α1',
    unit: '',
    physiology: 'dfa_alpha1',
  },
  {
    key: 'motion_index',
    baselineKey: 'motion_intensity',
    weight: 0.05,
    direction: 'high',
    label: 'Intensitas gerak sensor',
    unit: '',
    physiology: 'acc',
  },
];

const MAX_ABS_Z = 8;

export function patientCaparTimePeriod(timestamp) {
  const hour = (new Date(timestamp).getUTCHours() + 7) % 24;
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18) return 'evening';
  return 'night';
}

export function isPatientCaparNocturnalTime(timestamp) {
  const hour = (new Date(timestamp).getUTCHours() + 7) % 24;
  return hour < 6 || hour >= 18;
}

function round(value, digits = 3) {
  return Number(value.toFixed(digits));
}

export function explainPatientDeviation(
  features,
  baseline,
  {
    minimumWeight = 0.5,
    mahalanobis = null,
    previousFeatures = null,
    elapsedMinutes = null,
  } = {}
) {
  if (!features || !baseline?.stats) {
    return { status: 'insufficient_data', reason: 'matching_baseline_unavailable', factors: [] };
  }

  const factors = [];
  let availableWeight = 0;
  for (const config of FEATURE_CONFIG) {
    const value = features[config.key];
    const stat = baseline.stats[config.baselineKey];
    if (
      !Number.isFinite(value)
      || !stat
      || stat.n < 2
      || !Number.isFinite(stat.mean)
      || !Number.isFinite(stat.std)
      || stat.std < 0.001
    ) {
      continue;
    }

    availableWeight += config.weight;
    const zScore = Math.max(-MAX_ABS_Z, Math.min(MAX_ABS_Z, (value - stat.mean) / stat.std));
    if (Math.abs(zScore) < 0.01) continue;
    const previousValue = previousFeatures?.[config.key];
    const recentChange = Number.isFinite(previousValue)
      ? value - previousValue
      : null;
    const mahalanobisFeature = mahalanobis?.features?.find(
      (item) => item.feature === config.baselineKey
    );

    factors.push({
      feature: config.key,
      label: config.label,
      value: round(value),
      baseline_mean: round(stat.mean),
      baseline_std: round(stat.std),
      unit: config.unit,
      z_score: round(zScore),
      delta_from_baseline: round(value - stat.mean),
      direction: zScore > 0 ? 'above_baseline' : 'below_baseline',
      deviation_level: Math.abs(zScore) >= 2
        ? 'significant'
        : Math.abs(zScore) >= 1
          ? 'mild'
          : 'within_personal_variation',
      recent_change: recentChange == null ? null : round(recentChange),
      recent_change_per_minute:
        recentChange == null || !Number.isFinite(elapsedMinutes) || elapsedMinutes <= 0
          ? null
          : round(recentChange / elapsedMinutes, 4),
      recent_direction: recentChange == null
        ? 'unavailable'
        : recentChange > 0
          ? 'increasing'
          : recentChange < 0
            ? 'decreasing'
            : 'stable',
      mahalanobis_contribution: mahalanobisFeature
        ? round(mahalanobisFeature.contribution)
        : null,
      contribution_share: mahalanobisFeature
        ? round(mahalanobisFeature.contribution_share, 4)
        : null,
      physiology: config.physiology,
    });
  }

  if (availableWeight < minimumWeight) {
    return {
      status: 'insufficient_data',
      reason: 'too_few_comparable_features',
      available_weight: round(availableWeight),
      minimum_weight: minimumWeight,
      factors: [],
    };
  }

  if (factors.length === 0) {
    return {
      status: 'unexplained',
      reason: 'no_feature_change_from_personal_baseline',
      available_weight: round(availableWeight),
      factors: [],
    };
  }

  const hasMahalanobisContributions = factors.some(
    (factor) => factor.contribution_share != null
  );
  const rankedFactors = factors.sort((a, b) => {
    if (hasMahalanobisContributions) {
      return (b.contribution_share || 0) - (a.contribution_share || 0);
    }
    return Math.abs(b.z_score) - Math.abs(a.z_score);
  });

  return {
    status: 'available',
    method: 'personal_z_scores_with_mahalanobis_contribution',
    available_weight: round(availableWeight),
    contribution_method: hasMahalanobisContributions
      ? 'delta_i_times_inverse_covariance_delta_i'
      : 'unavailable_without_mature_multivariate_reference',
    factors: rankedFactors,
  };
}

export function attributePatientContext({ factors = [], contexts = [], motionZScore = null } = {}) {
  const types = new Set(contexts.map((context) => context.type));
  const hrDeviation = factors.find((factor) => factor.feature === 'hr_mean');
  const elevatedHeartRate = Number(hrDeviation?.z_score) >= 1;
  const highMotion = Number.isFinite(motionZScore) && motionZScore >= 1;
  const hypotheses = new Map();
  const add = (type, score, evidence) => {
    const current = hypotheses.get(type) || { type, score: 0, evidence: [] };
    current.score += score;
    current.evidence.push(evidence);
    hypotheses.set(type, current);
  };

  if (types.has('physical_activity') || types.has('exercise') || highMotion) {
    add(
      'physical_activity',
      highMotion ? 2 : 1,
      highMotion ? 'wearable_motion_elevated' : 'patient_or_CAPAR_activity_recorded'
    );
  }
  if (types.has('mental_stress') || types.has('stress')) {
    add('stress', 2, 'patient_reported_stress_context');
  }
  if (types.has('sleep_duration') || types.has('sleep')) {
    add('sleep', 1, 'sleep_context_recorded');
  }
  for (const type of ['caffeine', 'medication', 'meal_timing', 'illness', 'pain_discomfort']) {
    if (types.has(type)) add(type, 1, `patient_context_${type}`);
  }

  const candidates = [...hypotheses.values()]
    .map((item) => ({
      ...item,
      association:
        (item.type === 'physical_activity' && highMotion && elevatedHeartRate)
        || (item.type !== 'physical_activity' && elevatedHeartRate)
          ? 'consistent_with'
          : 'temporally_associated',
      evidence_level:
        (item.type === 'physical_activity' && highMotion && elevatedHeartRate)
        || (item.type !== 'physical_activity' && elevatedHeartRate)
          ? 'concordant_rule_evidence'
          : 'context_only',
      causal_claim: false,
    }))
    .sort((a, b) => b.score - a.score);

  return {
    status: candidates.length ? 'hypotheses_available' : 'insufficient_context',
    candidates,
    interpretation_limit: 'Associations and context rules do not establish individual causality.',
    elevated_heart_rate_without_motion: elevatedHeartRate && !highMotion,
  };
}

export function mapPatientContextToRagAxes(contextItems = []) {
  const behavior = new Set();
  const physiology = new Set();
  const caparDimension = new Set();
  const timeContext = new Set();

  for (const item of contextItems) {
    const type = item.type;
    if (type === 'physical_activity' || type === 'exercise') behavior.add('physical_activity');
    if (type === 'mental_stress' || type === 'stress') behavior.add('stress_job_strain');
    if (type === 'caffeine') behavior.add('caffeine');
    if (type === 'smoking') behavior.add('smoking');
    if (type === 'alcohol') behavior.add('alcohol');
    if (type === 'sleep_duration' || type === 'sleep') behavior.add('sleep_duration');
    if (type === 'meal' || type === 'meal_timing') behavior.add('meal_timing');
    if (type === 'heart_rate') physiology.add('heart_rate');
    if (type === 'rmssd' || type === 'sdnn') physiology.add('rmssd');
    if (type === 'dfa_alpha1') physiology.add('dfa_alpha1');
    if (type === 'recovery') physiology.add('recovery');
    if (type === 'acc') physiology.add('acc');
    if (item.time_context === 'nocturnal_sleep') timeContext.add('nocturnal_sleep');
  }

  if (physiology.has('rmssd') || physiology.has('dfa_alpha1')) caparDimension.add('AR');
  if (physiology.has('recovery')) caparDimension.add('RC');

  return {
    behavior: [...behavior],
    physiology: [...physiology],
    caparDimension: [...caparDimension],
    timeContext: [...timeContext],
  };
}
