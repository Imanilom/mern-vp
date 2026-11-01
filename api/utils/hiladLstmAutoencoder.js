import tf from '@tensorflow/tfjs';

export const HILAD_WINDOW_SIZE = 60;
export const HILAD_FEATURE_COUNT = 5;
const HILAD_TEST_MODE = process.env.HILAD_TEST_MODE === 'true';
if (HILAD_TEST_MODE && process.env.NODE_ENV === 'production') {
  throw new Error('HILAD_TEST_MODE must not be enabled in production.');
}
export const HILAD_MIN_TRAINING_WINDOWS = HILAD_TEST_MODE ? 1 : 5;
export const HILAD_RETRAIN_WINDOW_INTERVAL = 20;

const MAX_TRAINING_WINDOWS = 500;
const MAX_EPOCHS = 20;

function normalizeReading(reading) {
  return [
    reading.hr / 250,
    reading.rr / 2000,
    (reading.acc_x + 16) / 32,
    (reading.acc_y + 16) / 32,
    (reading.acc_z + 16) / 32,
  ];
}

function interpolate(left, right, fraction) {
  return left.map((value, index) => value + (right[index] - value) * fraction);
}

export function buildQualityGatedMinuteSequence(readings) {
  const sorted = readings
    .filter((reading) =>
      Number.isFinite(reading.timestamp)
      && Number.isFinite(reading.hr)
      && Number.isFinite(reading.rr)
      && Number.isFinite(reading.acc_x)
      && Number.isFinite(reading.acc_y)
      && Number.isFinite(reading.acc_z)
      && Number.isFinite(reading.signal_quality)
      && reading.signal_quality >= 0.5
    )
    .sort((left, right) => left.timestamp - right.timestamp);

  if (sorted.length < 30) return null;
  const duration = sorted.at(-1).timestamp - sorted[0].timestamp;
  if (duration < 50 || duration > 70) return null;
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].timestamp - sorted[index - 1].timestamp > 5) return null;
  }

  const normalized = sorted.map(normalizeReading);
  const sequence = [];
  let rightIndex = 1;
  for (let index = 0; index < HILAD_WINDOW_SIZE; index += 1) {
    const targetTime = sorted[0].timestamp + duration * index / (HILAD_WINDOW_SIZE - 1);
    while (
      rightIndex < sorted.length - 1
      && sorted[rightIndex].timestamp < targetTime
    ) {
      rightIndex += 1;
    }
    const leftIndex = Math.max(0, rightIndex - 1);
    const left = sorted[leftIndex];
    const right = sorted[rightIndex];
    const span = right.timestamp - left.timestamp;
    const fraction = span > 0 ? (targetTime - left.timestamp) / span : 0;
    sequence.push(interpolate(normalized[leftIndex], normalized[rightIndex], fraction));
  }

  return {
    sequence,
    window_start: Math.floor(sorted[0].timestamp / 60) * 60,
    window_end: sorted.at(-1).timestamp,
    sample_count: sorted.length,
    mean_signal_quality: sorted.reduce(
      (sum, reading) => sum + reading.signal_quality,
      0
    ) / sorted.length,
  };
}

function createAutoencoder() {
  const model = tf.sequential();
  model.add(tf.layers.lstm({
    units: 16,
    inputShape: [HILAD_WINDOW_SIZE, HILAD_FEATURE_COUNT],
  }));
  model.add(tf.layers.repeatVector({ n: HILAD_WINDOW_SIZE }));
  model.add(tf.layers.lstm({ units: 16, returnSequences: true }));
  model.add(tf.layers.timeDistributed({
    layer: tf.layers.dense({ units: HILAD_FEATURE_COUNT, activation: 'sigmoid' }),
  }));
  model.compile({ optimizer: tf.train.adam(0.001), loss: 'meanSquaredError' });
  return model;
}

function flattenRows(rows) {
  return rows.flatMap((row) => row);
}

async function serializeWeights(model) {
  const weights = [];
  for (const tensor of model.getWeights()) {
    weights.push({
      shape: tensor.shape,
      values: Array.from(await tensor.data()),
    });
  }
  return weights;
}

function restoreWeights(model, serialized) {
  const tensors = serialized.map(({ shape, values }) => tf.tensor(values, shape));
  try {
    model.setWeights(tensors);
  } finally {
    tensors.forEach((tensor) => tensor.dispose());
  }
}

async function scoreSequence(model, sequence) {
  const input = tf.tensor3d(flattenRows(sequence), [1, HILAD_WINDOW_SIZE, HILAD_FEATURE_COUNT]);
  let output;
  try {
    output = model.predict(input);
    const reconstructed = await output.array();
    const residuals = sequence.map((row, timeIndex) =>
      row.map((value, featureIndex) =>
        Math.abs(value - reconstructed[0][timeIndex][featureIndex])
      )
    );
    const score = residuals.flat().reduce((sum, error) => sum + error, 0)
      / (HILAD_WINDOW_SIZE * HILAD_FEATURE_COUNT);
    const temporalAttributions = residuals.map((row) =>
      row.reduce((sum, error) => sum + error, 0) / HILAD_FEATURE_COUNT
    );
    const attributionTotal = temporalAttributions.reduce((sum, value) => sum + value, 0);
    return {
      score,
      residuals,
      temporal_attributions: temporalAttributions.map((value) =>
        attributionTotal > 0 ? value / attributionTotal : 0
      ),
    };
  } finally {
    input.dispose();
    if (output) output.dispose();
  }
}

function percentile(values, percentileValue) {
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * percentileValue;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  if (lowerIndex === upperIndex) return sorted[lowerIndex];
  const fraction = position - lowerIndex;
  return sorted[lowerIndex] + (sorted[upperIndex] - sorted[lowerIndex]) * fraction;
}

export async function trainLstmAutoencoder(
  sequences,
  minimumTrainingWindows = HILAD_MIN_TRAINING_WINDOWS
) {
  if (sequences.length < minimumTrainingWindows) {
    throw new Error(
      `At least ${minimumTrainingWindows} quality-gated minute windows are required.`
    );
  }
  const trainingSequences = sequences.slice(-MAX_TRAINING_WINDOWS);
  const validationCount = trainingSequences.length > 1
    ? Math.max(1, Math.floor(trainingSequences.length * 0.2))
    : 0;
  const fitSequences = validationCount
    ? trainingSequences.slice(0, -validationCount)
    : trainingSequences;
  const validationSequences = validationCount
    ? trainingSequences.slice(-validationCount)
    : trainingSequences;
  const values = fitSequences.flatMap((item) => flattenRows(item.sequence));
  const input = tf.tensor3d(
    values,
    [fitSequences.length, HILAD_WINDOW_SIZE, HILAD_FEATURE_COUNT]
  );
  const model = createAutoencoder();

  try {
    await model.fit(input, input, {
      epochs: MAX_EPOCHS,
      batchSize: Math.min(16, fitSequences.length),
      shuffle: true,
      verbose: 0,
    });
    const scores = [];
    for (const item of validationSequences) {
      scores.push((await scoreSequence(model, item.sequence)).score);
    }
    const threshold = Math.max(percentile(scores, 0.95) * 1.25, 0.0001);
    return {
      weights: await serializeWeights(model),
      threshold,
      training_window_count: trainingSequences.length,
      validation_window_count: validationSequences.length,
    };
  } finally {
    input.dispose();
    model.dispose();
  }
}

export async function evaluateLstmAutoencoder(serializedModel, sequence) {
  const model = createAutoencoder();
  try {
    restoreWeights(model, serializedModel.weights);
    const result = await scoreSequence(model, sequence);
    const isCandidate = result.score > serializedModel.anomaly_threshold;
    return {
      model_version: serializedModel.version,
      reconstruction_score: result.score,
      anomaly_threshold: serializedModel.anomaly_threshold,
      is_anomaly_candidate: isCandidate,
      temporal_attributions: result.temporal_attributions,
      reconstruction_errors: result.residuals,
      method: 'lstm_autoencoder_reconstruction_error',
      explanation_note: 'Reconstruction residual menunjukkan bagian yang tidak cocok dengan pola latih; bukan CAM atau diagnosis.',
    };
  } finally {
    model.dispose();
  }
}
