const DEFAULT_MIN_BASELINE_SAMPLES = 30;
const Z_95 = 1.6448536269514722;
const Z_99 = 2.3263478740408408;

const isFiniteNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value);

const inverseMatrix = (matrix) => {
  const size = matrix.length;
  const augmented = matrix.map((row, index) => [
    ...row,
    ...Array.from({ length: size }, (_, column) =>
      column === index ? 1 : 0
    ),
  ]);

  for (let column = 0; column < size; column += 1) {
    let pivotRow = column;
    for (let row = column + 1; row < size; row += 1) {
      if (
        Math.abs(augmented[row][column]) >
        Math.abs(augmented[pivotRow][column])
      ) {
        pivotRow = row;
      }
    }

    if (Math.abs(augmented[pivotRow][column]) < 1e-12) return null;

    [augmented[column], augmented[pivotRow]] = [
      augmented[pivotRow],
      augmented[column],
    ];
    const pivot = augmented[column][column];
    augmented[column] = augmented[column].map((value) => value / pivot);

    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      augmented[row] = augmented[row].map(
        (value, index) => value - factor * augmented[column][index]
      );
    }
  }

  return augmented.map((row) => row.slice(size));
};

const chiSquareThreshold = (degreesOfFreedom, zScore) => {
  const correction =
    1 - 2 / (9 * degreesOfFreedom) +
    zScore * Math.sqrt(2 / (9 * degreesOfFreedom));
  return degreesOfFreedom * correction ** 3;
};

const fitPatientMahalanobisModel = (
  baselineSamples,
  featureKeys,
  minSamples = DEFAULT_MIN_BASELINE_SAMPLES
) => {
  const keys = Array.isArray(featureKeys) ? featureKeys : [];
  const vectors = (Array.isArray(baselineSamples) ? baselineSamples : [])
    .map((sample) => keys.map((key) => sample && sample[key]))
    .filter((vector) => vector.every(isFiniteNumber));
  const dimensions = keys.length;

  if (
    dimensions < 2 ||
    vectors.length < Math.max(minSamples, dimensions + 2)
  ) {
    return {
      available: false,
      reason: 'insufficient_baseline',
      feature_keys: keys,
      sample_count: vectors.length,
      required_samples: Math.max(minSamples, dimensions + 2),
    };
  }

  const mean = keys.map(
    (_, column) =>
      vectors.reduce((total, vector) => total + vector[column], 0) /
      vectors.length
  );
  const covariance = keys.map((_, row) =>
    keys.map((__, column) => {
      const sum = vectors.reduce(
        (total, vector) =>
          total + (vector[row] - mean[row]) * (vector[column] - mean[column]),
        0
      );
      return sum / (vectors.length - 1);
    })
  );
  const scale =
    covariance.reduce(
      (total, row, index) => total + Math.abs(row[index]),
      0
    ) / dimensions;

  if (!Number.isFinite(scale) || scale <= 0) {
    return {
      available: false,
      reason: 'invalid_baseline_covariance',
      feature_keys: keys,
      sample_count: vectors.length,
    };
  }

  const regularization = Math.max(scale * 1e-6, 1e-9);
  const regularizedCovariance = covariance.map((row, index) =>
    row.map((value, column) =>
      index === column ? value + regularization : value
    )
  );
  const inverse = inverseMatrix(regularizedCovariance);

  if (!inverse) {
    return {
      available: false,
      reason: 'singular_baseline_covariance',
      feature_keys: keys,
      sample_count: vectors.length,
    };
  }

  return {
    available: true,
    feature_keys: keys,
    mean,
    covariance: regularizedCovariance,
    inverse,
    sample_count: vectors.length,
    regularization,
    thresholds: {
      mild: chiSquareThreshold(dimensions, Z_95),
      significant: chiSquareThreshold(dimensions, Z_99),
    },
  };
};

const scorePatientMahalanobis = (current, model) => {
  if (!model || !model.available) {
    return {
      available: false,
      reason: model && model.reason ? model.reason : 'model_unavailable',
      sample_count: model ? model.sample_count : 0,
    };
  }

  const values = model.feature_keys.map((key) => current && current[key]);
  if (!values.every(isFiniteNumber)) {
    return {
      available: false,
      reason: 'incomplete_current_features',
      feature_keys: model.feature_keys,
      sample_count: model.sample_count,
    };
  }

  const delta = values.map((value, index) => value - model.mean[index]);
  const inverseDelta = model.inverse.map((row) =>
    row.reduce((total, value, index) => total + value * delta[index], 0)
  );
  const contributions = delta.map((value, index) => value * inverseDelta[index]);
  const squaredDistance = contributions.reduce(
    (total, value) => total + value,
    0
  );
  if (!Number.isFinite(squaredDistance) || squaredDistance < -1e-8) {
    return {
      available: false,
      reason: 'invalid_distance',
      sample_count: model.sample_count,
    };
  }

  const positiveDistance = Math.max(0, squaredDistance);
  const absoluteContributionTotal = contributions.reduce(
    (total, value) => total + Math.abs(value),
    0
  );
  const distance = Math.sqrt(positiveDistance);

  return {
    available: true,
    feature_keys: model.feature_keys,
    distance,
    squared_distance: positiveDistance,
    sample_count: model.sample_count,
    thresholds: model.thresholds,
    state:
      positiveDistance >= model.thresholds.significant
        ? 'strongly_displaced'
        : positiveDistance >= model.thresholds.mild
          ? 'moderately_displaced'
          : 'within_personal_region',
    features: model.feature_keys.map((key, index) => ({
      feature: key,
      value: values[index],
      baseline_mean: model.mean[index],
      delta: delta[index],
      contribution: contributions[index],
      contribution_share:
        absoluteContributionTotal > 0
          ? Math.abs(contributions[index]) / absoluteContributionTotal
          : 0,
    })),
  };
};

const computePatientMahalanobis = (current, baselineSamples) => {
  const legacyFeatures = ['delta_hr', 'dfa_alpha1'];
  const model = fitPatientMahalanobisModel(
    (Array.isArray(baselineSamples) ? baselineSamples : []).map((sample) =>
      Array.isArray(sample)
        ? { delta_hr: sample[0], dfa_alpha1: sample[1] }
        : sample
    ),
    legacyFeatures,
    DEFAULT_MIN_BASELINE_SAMPLES
  );
  const result = scorePatientMahalanobis(
    {
      delta_hr: Array.isArray(current) ? current[0] : current?.delta_hr,
      dfa_alpha1: Array.isArray(current)
        ? current[1]
        : current?.dfa_alpha1,
    },
    model
  );
  if (!result.available) {
    return {
      ...result,
      status: 'insufficient_data',
      baseline_samples: result.sample_count || 0,
      ...(result.reason === 'invalid_baseline_covariance'
        ? { reason: 'baseline_variance_too_low' }
        : {}),
    };
  }
  return {
    ...result,
    status: 'computed',
    distance_squared: result.squared_distance,
    degrees_of_freedom: result.feature_keys.length,
    reference_thresholds: {
      percentile_95: result.thresholds.mild,
      percentile_99: result.thresholds.significant,
    },
  };
};

export {
  DEFAULT_MIN_BASELINE_SAMPLES,
  fitPatientMahalanobisModel,
  scorePatientMahalanobis,
  computePatientMahalanobis,
};
