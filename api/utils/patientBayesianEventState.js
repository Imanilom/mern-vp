import { getPatientDecisionPolicy } from '../config/patientDecisionPolicies.js';

const FEATURE_KEYS = [
  'mean_hr',
  'mean_rr',
  'delta_hr',
  'slope_hr',
  'sdnn',
  'rmssd',
  'dfa_alpha1',
  'motion_intensity',
];

const PRIOR_ALPHA = 1;
const VALIDATION_FRACTION = 0.2;

function finiteFeatureCount(sample) {
  return FEATURE_KEYS.reduce(
    (count, key) => count + (Number.isFinite(sample?.features?.[key]) ? 1 : 0),
    0,
  );
}

function chronologicalSplit(stableSamples, deviationSamples) {
  const ordered = [
    ...stableSamples.map((sample) => ({ ...sample, label: 'stable' })),
    ...deviationSamples.map((sample) => ({ ...sample, label: 'deviation' })),
  ]
    .filter((sample) => (
      sample.recorded_at != null
      && Number.isFinite(Number(sample.recorded_at))
      && finiteFeatureCount(sample) > 0
    ))
    .sort((first, second) => Number(first.recorded_at) - Number(second.recorded_at));
  const timestamps = [...new Set(ordered.map((sample) => Number(sample.recorded_at)))];
  const cutoffIndex = Math.min(
    timestamps.length - 1,
    Math.floor(timestamps.length * (1 - VALIDATION_FRACTION)),
  );
  const cutoff = timestamps[cutoffIndex];
  const training = ordered.filter((sample) => Number(sample.recorded_at) < cutoff);
  const validation = ordered.filter((sample) => Number(sample.recorded_at) >= cutoff);
  return {
    training: {
      stable: training.filter((sample) => sample.label === 'stable'),
      deviation: training.filter((sample) => sample.label === 'deviation'),
    },
    validation: {
      stable: validation.filter((sample) => sample.label === 'stable'),
      deviation: validation.filter((sample) => sample.label === 'deviation'),
    },
  };
}

function summarizeFeatures(samples, featureKeys) {
  return Object.fromEntries(featureKeys.map((key) => {
    const values = samples
      .map((sample) => sample.features?.[key])
      .filter(Number.isFinite);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.length > 1
      ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
      : 0;
    return [key, {
      count: values.length,
      mean,
      variance: Math.max(variance, 1e-6),
    }];
  }));
}

function logLikelihood(sample, featureStats) {
  let score = 0;
  let usedFeatures = 0;
  for (const [key, stat] of Object.entries(featureStats)) {
    const value = sample.features?.[key];
    if (!Number.isFinite(value)) continue;
    const squaredZ = Math.min(((value - stat.mean) ** 2) / stat.variance, 1e12);
    score += -0.5 * (Math.log(2 * Math.PI * stat.variance) + squaredZ);
    usedFeatures += 1;
  }
  return usedFeatures ? score : null;
}

function posteriorFromModel(sample, model) {
  const stableLikelihood = logLikelihood(sample, model.stableFeatures);
  const deviationLikelihood = logLikelihood(sample, model.deviationFeatures);
  if (stableLikelihood == null || deviationLikelihood == null) return null;
  const scores = [
    Math.log(model.priors.stable) + stableLikelihood,
    Math.log(model.priors.deviation) + deviationLikelihood,
  ];
  if (scores.some((score) => !Number.isFinite(score))) return null;
  const maximum = Math.max(...scores);
  const stableWeight = Math.exp(scores[0] - maximum);
  const deviationWeight = Math.exp(scores[1] - maximum);
  const denominator = stableWeight + deviationWeight;
  return denominator > 0 ? deviationWeight / denominator : null;
}

function insufficient(reason, stableCount = 0, deviationCount = 0) {
  return {
    status: 'insufficient_data',
    method: 'personal_gaussian_naive_bayes',
    reason,
    feature_keys: [],
    training_samples: { stable: stableCount, deviation: deviationCount },
    validation_samples: { stable: 0, deviation: 0 },
    validation: null,
    distribution: null,
  };
}

export function fitPatientBayesianEventState({
  stableSamples = [],
  deviationSamples = [],
  currentFeatures = null,
} = {}) {
  const minimumSamples = getPatientDecisionPolicy(
    'patient_mahalanobis_min_baseline_samples',
  ).value;
  const split = chronologicalSplit(stableSamples, deviationSamples);

  if (
    split.training.stable.length < minimumSamples
    || split.training.deviation.length < minimumSamples
  ) {
    return insufficient(
      'Insufficient quality-gated historical CAPAR labels for both classes.',
      split.training.stable.length,
      split.training.deviation.length,
    );
  }

  const featureKeys = FEATURE_KEYS.filter((key) => (
    split.training.stable.filter((sample) => Number.isFinite(sample.features?.[key])).length >= minimumSamples
    && split.training.deviation.filter((sample) => Number.isFinite(sample.features?.[key])).length >= minimumSamples
  ));
  if (!featureKeys.length) {
    return insufficient(
      'No physiological feature has enough observations in both labeled classes.',
      split.training.stable.length,
      split.training.deviation.length,
    );
  }

  const stableFeatures = summarizeFeatures(split.training.stable, featureKeys);
  const deviationFeatures = summarizeFeatures(split.training.deviation, featureKeys);
  const totalTraining = split.training.stable.length + split.training.deviation.length;
  const model = {
    stableFeatures,
    deviationFeatures,
    priors: {
      stable: (split.training.stable.length + PRIOR_ALPHA) / (totalTraining + 2 * PRIOR_ALPHA),
      deviation: (split.training.deviation.length + PRIOR_ALPHA) / (totalTraining + 2 * PRIOR_ALPHA),
    },
  };
  const hasBothValidationClasses = split.validation.stable.length > 0
    && split.validation.deviation.length > 0;
  const validationRows = hasBothValidationClasses
    ? [
      ...split.validation.stable.map((sample) => ({ sample, expected: 0 })),
      ...split.validation.deviation.map((sample) => ({ sample, expected: 1 })),
    ]
    : [];
  const brierScores = validationRows
    .map(({ sample, expected }) => {
      const probability = posteriorFromModel(sample, model);
      return probability == null ? null : (probability - expected) ** 2;
    })
    .filter(Number.isFinite);
  const brierScore = brierScores.length
    ? brierScores.reduce((sum, value) => sum + value, 0) / brierScores.length
    : null;

  return {
    status: 'validation_required',
    method: 'personal_gaussian_naive_bayes',
    reason: hasBothValidationClasses
      ? 'Candidate model is scored on a chronological holdout; individual probabilities remain hidden until calibration and governance review.'
      : 'The chronological holdout does not contain both CAPAR label classes, so validation is incomplete and individual probabilities remain hidden.',
    prior: 'Laplace-smoothed class frequency from this activity/time baseline.',
    likelihood: 'Gaussian feature likelihoods with a conditional-independence assumption.',
    feature_keys: featureKeys,
    training_samples: {
      stable: split.training.stable.length,
      deviation: split.training.deviation.length,
    },
    validation_samples: {
      stable: split.validation.stable.length,
      deviation: split.validation.deviation.length,
    },
    validation: {
      status: hasBothValidationClasses ? 'both_classes_available' : 'missing_label_class',
      holdout_fraction: VALIDATION_FRACTION,
      scored_samples: brierScores.length,
      brier_score: brierScore == null ? null : Number(brierScore.toFixed(4)),
    },
    candidate_probability_internal: currentFeatures
      ? posteriorFromModel({ features: currentFeatures }, model)
      : null,
    distribution: null,
  };
}
