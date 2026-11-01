import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQualityGatedMinuteSequence,
  evaluateLstmAutoencoder,
  trainLstmAutoencoder,
} from '../utils/hiladLstmAutoencoder.js';

function minuteReadings({ quality = 0.9, offset = 0 } = {}) {
  return Array.from({ length: 60 }, (_, index) => ({
    timestamp: 1_800_000_000 + index + offset,
    hr: 70 + Math.sin(index / 8),
    rr: 850 + Math.sin(index / 4) * 10,
    acc_x: 0.02,
    acc_y: -0.01,
    acc_z: 0.98,
    signal_quality: quality,
  }));
}

test('quality gate resamples a complete 60-second Polar window to 60 normalized rows', () => {
  const result = buildQualityGatedMinuteSequence(minuteReadings());
  assert.ok(result);
  assert.equal(result.sequence.length, 60);
  assert.ok(result.sequence.every((row) => row.length === 5));
  assert.ok(result.sequence.flat().every((value) => value >= 0 && value <= 1));
});

test('quality gate rejects poor confidence, short duration, and recording gaps', () => {
  assert.equal(
    buildQualityGatedMinuteSequence(minuteReadings({ quality: 0.2 })),
    null
  );
  assert.equal(
    buildQualityGatedMinuteSequence(minuteReadings().slice(0, 30)),
    null
  );
  const withGap = minuteReadings().filter((_, index) =>
    index < 30 || index > 39
  );
  assert.equal(buildQualityGatedMinuteSequence(withGap), null);
});

test('LSTM autoencoder trains, persists reconstructable weights, and emits residual attributions', async () => {
  const seed = buildQualityGatedMinuteSequence(minuteReadings());
  const training = Array.from({ length: 20 }, (_, index) => ({
    sequence: seed.sequence.map((row) => [
      Math.max(0, Math.min(1, row[0] + index * 0.0001)),
      ...row.slice(1),
    ]),
  }));
  const trained = await trainLstmAutoencoder(training);
  assert.equal(trained.training_window_count, 20);
  assert.ok(trained.threshold > 0);
  assert.ok(trained.weights.length > 0);

  const evaluation = await evaluateLstmAutoencoder({
    ...trained,
    version: 1,
  }, seed.sequence);
  assert.equal(evaluation.temporal_attributions.length, 60);
  assert.equal(evaluation.reconstruction_errors.length, 60);
  assert.ok(Number.isFinite(evaluation.reconstruction_score));
});
