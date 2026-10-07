import {
  getPatientDecisionPolicy,
  getPatientDecisionPolicyBundle,
} from '../config/patientDecisionPolicies.js';

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

const MAX_ABS_Z = getPatientDecisionPolicy('rr_max_abs_z_score').value;
const EXPLANATION_POLICY_RULES = [
  'rr_max_abs_z_score',
  'patient_deviation_minimum_feature_weight',
  'patient_deviation_minimum_baseline_samples',
  'patient_deviation_minimum_baseline_std',
  'patient_deviation_zero_z_epsilon',
  'patient_deviation_mild_z_score',
  'patient_deviation_significant_z_score',
];

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
    mahalanobis = null,
    previousFeatures = null,
    elapsedMinutes = null,
    policyOverrides = {},
  } = {}
) {
  const minimumWeight = getPatientDecisionPolicy(
    'patient_deviation_minimum_feature_weight',
    policyOverrides
  ).value;
  const minimumBaselineSamples = getPatientDecisionPolicy(
    'patient_deviation_minimum_baseline_samples',
    policyOverrides
  ).value;
  const minimumBaselineStd = getPatientDecisionPolicy(
    'patient_deviation_minimum_baseline_std',
    policyOverrides
  ).value;
  const zeroZScoreEpsilon = getPatientDecisionPolicy(
    'patient_deviation_zero_z_epsilon',
    policyOverrides
  ).value;
  const mildZScore = getPatientDecisionPolicy(
    'patient_deviation_mild_z_score',
    policyOverrides
  ).value;
  const significantZScore = getPatientDecisionPolicy(
    'patient_deviation_significant_z_score',
    policyOverrides
  ).value;
  const policy = getPatientDecisionPolicyBundle(
    EXPLANATION_POLICY_RULES,
    policyOverrides
  );
  if (!features || !baseline?.stats) {
    return {
      status: 'insufficient_data',
      reason: 'matching_baseline_unavailable',
      factors: [],
      policy,
    };
  }

  const factors = [];
  let availableWeight = 0;
  for (const config of FEATURE_CONFIG) {
    const value = features[config.key];
    const stat = baseline.stats[config.baselineKey];
    if (
      !Number.isFinite(value)
      || !stat
      || stat.n < minimumBaselineSamples
      || !Number.isFinite(stat.mean)
      || !Number.isFinite(stat.std)
      || stat.std < minimumBaselineStd
    ) {
      continue;
    }

    availableWeight += config.weight;
    const zScore = Math.max(-MAX_ABS_Z, Math.min(MAX_ABS_Z, (value - stat.mean) / stat.std));
    if (Math.abs(zScore) < zeroZScoreEpsilon) continue;
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
      deviation_level: Math.abs(zScore) >= significantZScore
        ? 'significant'
        : Math.abs(zScore) >= mildZScore
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
      policy,
    };
  }

  if (factors.length === 0) {
    return {
      status: 'unexplained',
      reason: 'no_feature_change_from_personal_baseline',
      available_weight: round(availableWeight),
      factors: [],
      policy,
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
    policy,
  };
}

export function attributePatientContext({
  factors = [],
  contexts = [],
  motionZScore = null,
  policyOverrides = {},
} = {}) {
  const types = new Set(contexts.map((context) => context.type));
  const hrDeviation = factors.find((factor) => factor.feature === 'hr_mean');
  const elevatedHeartRate = Number(hrDeviation?.z_score) >= getPatientDecisionPolicy(
    'patient_context_elevated_hr_z_score',
    policyOverrides
  ).value;
  const highMotion = Number.isFinite(motionZScore)
    && motionZScore >= getPatientDecisionPolicy(
      'patient_context_high_motion_z_score',
      policyOverrides
    ).value;
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
    observed_contexts: contexts,
    interpretation_limit: 'Associations and context rules do not establish individual causality.',
    elevated_heart_rate_without_motion: elevatedHeartRate && !highMotion,
    policy: getPatientDecisionPolicyBundle([
      'patient_context_elevated_hr_z_score',
      'patient_context_high_motion_z_score',
    ], policyOverrides),
  };
}

export function assessPatientReasoningUncertainty({
  explanation = null,
  contextAttribution = null,
  signalQuality = null,
  personalBaselineAvailable = null,
  conflicts = [],
  policyOverrides = {},
} = {}) {
  const policy = getPatientDecisionPolicy(
    'patient_reasoning_uncertainty_framework',
    policyOverrides
  );
  const factors = Array.isArray(explanation?.factors) ? explanation.factors : [];
  const contextCandidates = Array.isArray(contextAttribution?.candidates)
    ? contextAttribution.candidates
    : [];
  const recordedContexts = Array.isArray(contextAttribution?.observed_contexts)
    ? contextAttribution.observed_contexts
    : [];
  const physiologicalAvailable = explanation?.status === 'available' && factors.length > 0;
  const multivariateAvailable = factors.some(
    (factor) => Number.isFinite(factor.contribution_share)
  );
  const contextAvailable = recordedContexts.length > 0;
  const signalQualityAvailable = Number.isFinite(signalQuality);
  const observedConflicts = Array.isArray(conflicts) ? conflicts : [];
  const reasons = [];

  if (!physiologicalAvailable) {
    reasons.push(explanation?.reason || 'physiological_evidence_unavailable');
  }
  if (!contextAvailable) {
    reasons.push('no_context_hypothesis_supported_by_recorded_context');
  }
  if (!multivariateAvailable) {
    reasons.push('multivariate_contribution_unavailable');
  }
  if (!signalQualityAvailable) {
    reasons.push('signal_quality_unavailable');
  }
  if (observedConflicts.length) {
    reasons.push('conflicting_observed_evidence');
  }

  const evidenceStatus = observedConflicts.length
    ? 'conflicting_evidence'
    : !physiologicalAvailable
      ? 'insufficient_evidence'
      : reasons.length
        ? 'limited_evidence'
        : 'evidence_available_with_limits';
  const interpretation = evidenceStatus === 'conflicting_evidence'
    ? 'Sebagian sumber data yang tercatat tidak selaras. Sistem tidak memilih satu penjelasan; tinjau bukti yang berbeda.'
    : evidenceStatus === 'insufficient_evidence'
      ? 'Data yang diperlukan belum cukup untuk menjelaskan perubahan ini. Ini bukan bukti bahwa tidak ada penyebab.'
      : evidenceStatus === 'limited_evidence'
        ? 'Ada bukti yang dapat ditinjau, tetapi konteks, kualitas, atau kontribusi fitur belum lengkap. Faktor yang ditampilkan bukan penyebab yang dipastikan.'
        : 'Beberapa jenis bukti tersedia dan saling mendukung menurut aturan sistem, tetapi penjelasan individual belum tervalidasi sebagai probabilitas atau sebab.';

  return {
    evidence_status: evidenceStatus,
    epistemic_status: 'not_quantified',
    confidence: null,
    confidence_status: 'not_calibrated',
    numeric_probability_provided: false,
    evidence_dimensions: {
      physiological_evidence: {
        available: physiologicalAvailable,
        factor_count: factors.length,
        explanation_status: explanation?.status || 'unavailable',
      },
      personal_baseline: {
        available: typeof personalBaselineAvailable === 'boolean'
          ? personalBaselineAvailable
          : explanation?.reason !== 'matching_baseline_unavailable'
            && explanation?.reason !== 'mature_context_baseline_unavailable',
      },
      multivariate_contribution: {
        available: multivariateAvailable,
      },
      context_evidence: {
        available: contextAvailable,
        candidate_count: contextCandidates.length,
        recorded_context_count: recordedContexts.length,
      },
      signal_quality: {
        available: signalQualityAvailable,
        value: signalQualityAvailable ? signalQuality : null,
      },
    },
    conflicts: observedConflicts,
    reasons,
    interpretation,
    policy,
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
