/**
 * brierEvaluator.js — Evaluator Brier Score Multiclass untuk Prediction CAPAR
 *
 * Implementasi Node.js/Backend untuk evaluasi probabilitas Next State Prediction.
 *
 * Multiclass Brier Score:
 *   BS = (1/N) * sum_i sum_k (p_ik - y_ik)^2
 *
 * Raw multiclass range: 0..2 (0 = sempurna)
 * Normalized Brier = raw / 2, range 0..1 (0 = sempurna)
 * Brier Skill Score (BSS) = 1 - (BS_model / BS_reference)
 */

export const CANONICAL_STATES = [
  'BASELINE_COMPATIBLE',
  'DEVIATION_CANDIDATE',
  'PERSISTENT_DEVIATION',
  'RECOVERY_START',
  'RECOVERED'
];

export const STATE_ALIASES = {
  NORMAL: 'BASELINE_COMPATIBLE',
  PROVISIONAL_NORMAL: 'BASELINE_COMPATIBLE',
  DEVIATION: 'DEVIATION_CANDIDATE',
  ALERT: 'PERSISTENT_DEVIATION',
  RECOVERY: 'RECOVERY_START',
};

/**
 * Normalisasi nama state ke 5 state kanonikal CAPAR.
 */
export function normalizeState(state) {
  if (!state) return 'BASELINE_COMPATIBLE';
  const s = String(state).toUpperCase();
  if (CANONICAL_STATES.includes(s)) return s;
  return STATE_ALIASES[s] || 'BASELINE_COMPATIBLE';
}

export class BrierEvaluator {
  constructor(states = CANONICAL_STATES) {
    this.states = states;
  }

  /**
   * Validasi objek probabilitas agar memiliki 5 state kanonikal dan bernilai valid [0..1] dengan sum = 1.
   */
  validateProbabilities(probabilities) {
    if (!probabilities || typeof probabilities !== 'object') {
      throw new Error('Probabilities object is required.');
    }

    const normalizedProbs = {};
    for (const state of this.states) {
      let val = probabilities[state];
      if (val === undefined) {
        for (const [alias, canonical] of Object.entries(STATE_ALIASES)) {
          if (canonical === state && probabilities[alias] !== undefined) {
            val = probabilities[alias];
            break;
          }
        }
      }
      if (val === undefined) {
        throw new Error(`Missing required state in probabilities: ${state}`);
      }
      normalizedProbs[state] = Number(val);
    }

    const values = Object.values(normalizedProbs);
    if (values.some(v => isNaN(v) || v < 0)) {
      throw new Error('Probability values cannot be negative or NaN.');
    }

    const total = values.reduce((sum, v) => sum + v, 0);
    if (Math.abs(total - 1.0) > 1e-3) {
      throw new Error(`Probabilities must sum to 1. Current sum = ${total.toFixed(4)}`);
    }

    // Auto-normalize minor floating point imprecision
    if (total > 0 && Math.abs(total - 1.0) <= 1e-3) {
      for (const key of Object.keys(normalizedProbs)) {
        normalizedProbs[key] = normalizedProbs[key] / total;
      }
    }

    return normalizedProbs;
  }

  /**
   * Evaluasi single prediction record.
   */
  scoreSingle(probabilities, actualStateRaw) {
    const probs = this.validateProbabilities(probabilities);
    const actualState = normalizeState(actualStateRaw);

    if (!this.states.includes(actualState)) {
      throw new Error(`Unknown actual state: ${actualStateRaw}`);
    }

    const squaredErrors = {};
    let totalScore = 0.0;

    for (const state of this.states) {
      const predicted = probs[state];
      const actual = state === actualState ? 1.0 : 0.0;
      const error = Math.pow(predicted - actual, 2);
      squaredErrors[state] = error;
      totalScore += error;
    }

    const normalizedScore = totalScore / 2.0;

    // Argmax predicted state
    let predictedState = this.states[0];
    let maxProb = -1;
    for (const state of this.states) {
      if (probs[state] > maxProb) {
        maxProb = probs[state];
        predictedState = state;
      }
    }

    return {
      actual_state: actualState,
      predicted_state: predictedState,
      confidence: Number(maxProb.toFixed(6)),
      correct: predictedState === actualState,
      brier_score_raw: Number(totalScore.toFixed(6)),
      brier_score_normalized: Number(normalizedScore.toFixed(6)),
      state_squared_errors: Object.fromEntries(
        Object.entries(squaredErrors).map(([k, v]) => [k, Number(v.toFixed(6))])
      )
    };
  }

  /**
   * Evaluasi batch prediction records.
   */
  evaluate(records, referenceBrier = null) {
    if (!Array.isArray(records) || records.length === 0) {
      return {
        status: 'NO_DATA',
        n_predictions: 0,
        brier_score_raw: 0,
        brier_score_normalized: 0,
        top1_accuracy: 0,
        brier_skill_score: 0
      };
    }

    const rawScores = [];
    const normalizedScores = [];
    let correctCount = 0;

    const perStateErrors = Object.fromEntries(this.states.map(s => [s, []]));
    const details = [];

    const binBuckets = [
      { bin: '10%', min: 0.0, max: 0.15, predictedSum: 0, actualSum: 0, count: 0 },
      { bin: '20%', min: 0.15, max: 0.25, predictedSum: 0, actualSum: 0, count: 0 },
      { bin: '30%', min: 0.25, max: 0.40, predictedSum: 0, actualSum: 0, count: 0 },
      { bin: '50%', min: 0.40, max: 0.60, predictedSum: 0, actualSum: 0, count: 0 },
      { bin: '70%', min: 0.60, max: 0.75, predictedSum: 0, actualSum: 0, count: 0 },
      { bin: '80%', min: 0.75, max: 0.85, predictedSum: 0, actualSum: 0, count: 0 },
      { bin: '90%', min: 0.85, max: 1.01, predictedSum: 0, actualSum: 0, count: 0 }
    ];

    for (const record of records) {
      const result = this.scoreSingle(record.probabilities, record.actual_state);
      rawScores.push(result.brier_score_raw);
      normalizedScores.push(result.brier_score_normalized);

      if (result.correct) {
        correctCount++;
      }

      for (const state of this.states) {
        perStateErrors[state].push(result.state_squared_errors[state]);

        const p = record.probabilities[state] ?? record.probabilities[STATE_ALIASES[state]] ?? 0;
        const actual = state === result.actual_state ? 1 : 0;
        const bucket = binBuckets.find(b => p >= b.min && p < b.max);
        if (bucket) {
          bucket.predictedSum += p;
          bucket.actualSum += actual;
          bucket.count++;
        }
      }

      details.push(result);
    }

    const meanRaw = rawScores.reduce((a, b) => a + b, 0) / records.length;
    const meanNormalized = normalizedScores.reduce((a, b) => a + b, 0) / records.length;
    const accuracy = correctCount / records.length;

    const stateBrier = Object.fromEntries(
      this.states.map(s => {
        const errs = perStateErrors[s];
        const avg = errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : 0;
        return [s, Number(avg.toFixed(6))];
      })
    );

    // Default reference brier score: uniform prediction p=0.2 for 5 states -> raw BS = (0.2-1)^2 + 4*(0.2-0)^2 = 0.80
    const refBrier = referenceBrier !== null && referenceBrier > 0 ? referenceBrier : 0.80;
    const brierSkillScore = 1.0 - (meanRaw / refBrier);

    const calibrationBins = binBuckets.map(b => ({
      bin: b.bin,
      predicted_prob: b.count > 0 ? Number((b.predictedSum / b.count).toFixed(3)) : 0,
      observed_frequency: b.count > 0 ? Number((b.actualSum / b.count).toFixed(3)) : 0,
      count: b.count
    }));

    return {
      status: 'READY',
      n_predictions: records.length,
      brier_score_raw: Number(meanRaw.toFixed(6)),
      brier_score_normalized: Number(meanNormalized.toFixed(6)),
      top1_accuracy: Number(accuracy.toFixed(6)),
      brier_skill_score: Number(brierSkillScore.toFixed(4)),
      reference_brier: refBrier,
      per_state_brier: stateBrier,
      calibration_bins: calibrationBins,
      details
    };
  }
}

/**
 * Hitung Brier Skill Score (BSS) terhadap model referensi.
 * BSS = 1 - (BS_model / BS_reference)
 */
export function brierSkillScore(modelBrier, referenceBrier) {
  if (referenceBrier <= 0) {
    throw new Error('Reference Brier Score must be > 0');
  }
  return 1.0 - (modelBrier / referenceBrier);
}
