/**
 * capar.markov.js
 *
 * Guarded Personal First-Order Markov Transition Model (100% JS Implementation)
 * Untuk CAPAR Console — Experience Memory & Personal Prediction.
 *
 * Sesuai Spesifikasi:
 * - State FSM & Governance menentukan authority state.
 * - Markov Model menghitung probabilitas transisi P(S_{t+1} = j | S_t = i)
 * - Transisi terlarang (disallowed by FSM) diberikan probabilitas 0.0 / null (render "—").
 * - Dirichlet smoothing alpha = 0.5 secara default.
 * - Prediksi multi-step (+h windows) dihitung via P^h.
 */

export const STATES = [
  'BASELINE_COMPATIBLE',
  'DEVIATION_CANDIDATE',
  'PERSISTENT_DEVIATION',
  'RECOVERY_START',
  'RECOVERED',
];

export const STATE_ALIASES = {
  NORMAL: 'BASELINE_COMPATIBLE',
  PROVISIONAL_NORMAL: 'BASELINE_COMPATIBLE',
  DEVIATION_CANDIDATE: 'DEVIATION_CANDIDATE',
  PROVISIONAL_DEVIATION: 'DEVIATION_CANDIDATE',
  PERSISTENT_DEVIATION: 'PERSISTENT_DEVIATION',
  RECOVERY: 'RECOVERY_START',
  RECOVERY_START: 'RECOVERY_START',
  RECOVERING: 'RECOVERY_START',
  RECOVERED: 'RECOVERED',
};

export const ALLOWED_TRANSITIONS = {
  BASELINE_COMPATIBLE: new Set(['BASELINE_COMPATIBLE', 'DEVIATION_CANDIDATE']),
  DEVIATION_CANDIDATE: new Set(['BASELINE_COMPATIBLE', 'DEVIATION_CANDIDATE', 'PERSISTENT_DEVIATION']),
  PERSISTENT_DEVIATION: new Set(['PERSISTENT_DEVIATION', 'RECOVERY_START']),
  RECOVERY_START: new Set(['PERSISTENT_DEVIATION', 'RECOVERY_START', 'RECOVERED']),
  RECOVERED: new Set(['RECOVERED', 'BASELINE_COMPATIBLE']),
};

export class PersonalMarkovModel {
  constructor(alpha = 0.5) {
    this.alpha = alpha;
  }

  /**
   * Parse status/state string to canonical state
   */
  normalizeState(stateStr) {
    if (!stateStr) return null;
    return STATE_ALIASES[stateStr] || (STATES.includes(stateStr) ? stateStr : null);
  }

  /**
   * Merekam count transisi dari episode yang resolved & verified
   * @param {Array<Object>} episodes - list episode [{ verified, windows: [{ state, quality_ok }] }]
   */
  buildTransitionCounts(episodes = []) {
    const counts = {};
    for (const s of STATES) {
      counts[s] = {};
      for (const t of STATES) {
        counts[s][t] = 0;
      }
    }

    for (const episode of episodes) {
      // Pembelajaran hanya dari episode yang verified & resolved
      if (!episode.verified && episode.status !== 'VERIFIED' && episode.status !== 'CONFIRMED' && !episode.isVerified) {
        continue;
      }

      const windows = episode.windows || [];
      const validStates = [];

      for (const w of windows) {
        // Abaikan window yang tidak lolos quality gating
        if (w.quality_ok === false || w.quality_gated === false) continue;
        const norm = this.normalizeState(w.state || w.rr_status);
        if (norm) validStates.push(norm);
      }

      for (let i = 0; i < validStates.length - 1; i++) {
        const curr = validStates[i];
        const next = validStates[i + 1];

        // Guard: pastikan transisi diizinkan oleh governance FSM
        if (ALLOWED_TRANSITIONS[curr] && ALLOWED_TRANSITIONS[curr].has(next)) {
          counts[curr][next] += 1;
        }
      }
    }

    return counts;
  }

  /**
   * Menghitung matriks probabilitas 5x5 dengan Dirichlet smoothing
   */
  transitionMatrix(counts) {
    const n = STATES.length;
    const matrix = Array.from({ length: n }, () => new Array(n).fill(0.0));

    for (let i = 0; i < n; i++) {
      const currentState = STATES[i];
      const allowed = ALLOWED_TRANSITIONS[currentState] || new Set();

      let rowTotal = 0;
      for (const nextState of allowed) {
        rowTotal += counts[currentState][nextState] || 0;
      }

      const denominator = rowTotal + this.alpha * allowed.size;

      for (let j = 0; j < n; j++) {
        const nextState = STATES[j];

        if (!allowed.has(nextState)) {
          matrix[i][j] = 0.0;
          continue;
        }

        const numerator = (counts[currentState][nextState] || 0) + this.alpha;
        matrix[i][j] = denominator > 0 ? numerator / denominator : 0.0;
      }
    }

    return matrix;
  }

  /**
   * Perkalian matriks n x n
   */
  multiplyMatrices(A, B) {
    const n = A.length;
    const C = Array.from({ length: n }, () => new Array(n).fill(0.0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
          sum += A[i][k] * B[k][j];
        }
        C[i][j] = sum;
      }
    }
    return C;
  }

  /**
   * Menghitung matriks pangkat (P^power) untuk multi-step horizon
   */
  matrixPower(matrix, power = 1) {
    const n = matrix.length;
    let result = Array.from({ length: n }, (_, i) => {
      const row = new Array(n).fill(0.0);
      row[i] = 1.0;
      return row;
    });

    let base = matrix;
    let p = power;

    while (p > 0) {
      if (p % 2 === 1) {
        result = this.multiplyMatrices(result, base);
      }
      base = this.multiplyMatrices(base, base);
      p = Math.floor(p / 2);
    }

    return result;
  }

  /**
   * Prediksi horizon +h windows (e.g. +3 windows = ~15 min)
   */
  predict(matrix, currentState, horizon = 1) {
    const normCurrent = this.normalizeState(currentState);
    if (!normCurrent || !STATES.includes(normCurrent)) {
      throw new Error(`Unknown current state: ${currentState}`);
    }

    const idx = STATES.indexOf(normCurrent);
    const n = STATES.length;

    // Vector state saat ini: [0, 0, 1, 0, 0]
    const currentVector = new Array(n).fill(0.0);
    currentVector[idx] = 1.0;

    const futureMatrix = this.matrixPower(matrix, horizon);

    // Vector probabilitas horizon: currentVector @ futureMatrix
    const probabilitiesVector = new Array(n).fill(0.0);
    for (let j = 0; j < n; j++) {
      let sum = 0.0;
      for (let i = 0; i < n; i++) {
        sum += currentVector[i] * futureMatrix[i][j];
      }
      probabilitiesVector[j] = sum;
    }

    // Cari state dengan probabilitas tertinggi
    let bestIdx = 0;
    let maxProb = -1;
    for (let i = 0; i < n; i++) {
      if (probabilitiesVector[i] > maxProb) {
        maxProb = probabilitiesVector[i];
        bestIdx = i;
      }
    }

    const probabilitiesObj = {};
    for (let i = 0; i < n; i++) {
      probabilitiesObj[STATES[i]] = parseFloat(probabilitiesVector[i].toFixed(4));
    }

    return {
      current_state: normCurrent,
      horizon_windows: horizon,
      predicted_state: STATES[bestIdx],
      confidence: parseFloat(probabilitiesVector[bestIdx].toFixed(4)),
      probabilities: probabilitiesObj,
    };
  }

  /**
   * Format matriks untuk respons API & rendering heatmap di frontend
   */
  serializeMatrix(matrix, counts) {
    const result = [];
    const n = STATES.length;

    for (let i = 0; i < n; i++) {
      const currentState = STATES[i];
      const allowedSet = ALLOWED_TRANSITIONS[currentState] || new Set();

      const row = {
        current_state: currentState,
        transitions: [],
      };

      for (let j = 0; j < n; j++) {
        const nextState = STATES[j];
        const allowed = allowedSet.has(nextState);

        row.transitions.push({
          next_state: nextState,
          allowed: allowed,
          count: counts[currentState][nextState] || 0,
          probability: allowed ? parseFloat(matrix[i][j].toFixed(4)) : null,
        });
      }

      result.push(row);
    }

    return result;
  }
}
