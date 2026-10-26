import { ALLOWED_TRANSITIONS } from '../models/state_transition.model.js';

const STATES = Object.keys(ALLOWED_TRANSITIONS);
const ALPHA = 0.1;
const MINIMUM_TRANSITIONS = 10;

const STATE_ALIASES = {
  NORMAL: 'BASELINE_COMPATIBLE',
  CAUTION: 'DEVIATION_CANDIDATE',
  ALERT: 'PERSISTENT_DEVIATION',
  INSUFFICIENT_BASELINE: 'UNKNOWN',
  PROVISIONAL_NORMAL: 'BASELINE_COMPATIBLE',
  RECOVERING: 'RECOVERY',
  PROVISIONAL_DEVIATION: 'DEVIATION_CANDIDATE',
  DEVIATION_CANDIDATE: 'DEVIATION_CANDIDATE',
  PERSISTENT_DEVIATION: 'PERSISTENT_DEVIATION',
  RECOVERED: 'RECOVERED',
};

function canonicalState(state) {
  const normalized = typeof state === 'string' ? state.toUpperCase() : '';
  return STATE_ALIASES[normalized] || (STATES.includes(normalized) ? normalized : null);
}

function transitionCounts(documents) {
  const counts = Object.fromEntries(
    STATES.map((state) => [
      state,
      Object.fromEntries(STATES.map((next) => [next, 0])),
    ]),
  );
  for (const document of documents) {
    for (const fromState of STATES) {
      const transitions = document[`from_${fromState}`];
      if (!transitions) continue;
      for (const toState of STATES) {
        const count = transitions[`to_${toState}`];
        if (Number.isFinite(count) && count > 0) counts[fromState][toState] += count;
      }
    }
  }
  return counts;
}

function buildMatrix(counts) {
  return STATES.map((fromState) => {
    const allowed = ALLOWED_TRANSITIONS[fromState];
    const observed = allowed.reduce(
      (sum, toState) => sum + counts[fromState][toState],
      0,
    );
    const denominator = observed + ALPHA * allowed.length;
    return STATES.map((toState) => (
      allowed.includes(toState)
        ? (counts[fromState][toState] + ALPHA) / denominator
        : 0
    ));
  });
}

function multiply(first, second) {
  return first.map((row) => second[0].map((_, column) => (
    row.reduce((sum, value, index) => sum + value * second[index][column], 0)
  )));
}

function forecast(matrix, state, horizon) {
  const identity = matrix.map((_, row) => matrix.map((__, column) => Number(row === column)));
  let result = identity;
  let power = matrix;
  let steps = horizon;
  while (steps > 0) {
    if (steps % 2 === 1) result = multiply(result, power);
    power = multiply(power, power);
    steps = Math.floor(steps / 2);
  }
  const startIndex = STATES.indexOf(state);
  return result[startIndex];
}

export function buildPatientRecoveryMarkovForecast({
  transitions = [],
  currentState,
  horizon = 3,
  activityContext = null,
} = {}) {
  const counts = transitionCounts(transitions);
  const observedTransitions = Object.values(counts).reduce(
    (total, row) => total + Object.values(row).reduce((sum, count) => sum + count, 0),
    0,
  );
  const state = canonicalState(currentState);
  const currentStateTransitions = state
    ? Object.values(counts[state]).reduce((sum, count) => sum + count, 0)
    : 0;
  if (!state || !Number.isInteger(horizon) || horizon < 1) {
    return {
      status: 'insufficient_data',
      reason: 'State CAPAR terbaru atau horizon evaluasi tidak tersedia.',
      observed_transitions: observedTransitions,
      horizon_windows: horizon,
      activity_context: activityContext,
      probabilities: null,
    };
  }
  if (observedTransitions < MINIMUM_TRANSITIONS) {
    return {
      status: 'insufficient_data',
      reason: `Transisi CAPAR personal belum mencapai ambang pembelajaran ${MINIMUM_TRANSITIONS}; tercatat ${observedTransitions}.`,
      current_state: state,
      observed_transitions: observedTransitions,
      horizon_windows: horizon,
      activity_context: activityContext,
      probabilities: null,
    };
  }
  if (!currentStateTransitions) {
    return {
      status: 'insufficient_data',
      reason: `Belum ada transisi CAPAR personal dari state ${state}.`,
      current_state: state,
      observed_transitions: observedTransitions,
      horizon_windows: horizon,
      activity_context: activityContext,
      probabilities: null,
    };
  }

  const distribution = forecast(buildMatrix(counts), state, horizon);
  const probabilityByState = Object.fromEntries(
    STATES.map((name, index) => [name, distribution[index]]),
  );
  const recoveryProbability = probabilityByState.RECOVERED
    + probabilityByState.BASELINE_COMPATIBLE;
  const roundedRecovery = Number((recoveryProbability * 100).toFixed(1));

  return {
    status: 'available',
    method: 'CAPAR personal state-transition matrix with Dirichlet alpha=0.1',
    current_state: state,
    horizon_windows: horizon,
    observed_transitions: observedTransitions,
    activity_context: activityContext,
    probabilities: {
      recovered_or_baseline_compatible: roundedRecovery,
      further_observation: Number((100 - roundedRecovery).toFixed(1)),
    },
    state_distribution: Object.fromEntries(
      Object.entries(probabilityByState).map(([key, value]) => [
        key,
        Number((value * 100).toFixed(1)),
      ]),
    ),
    insufficient_data_pct: null,
    disclaimer: 'Proyeksi state Markov dari riwayat transisi CAPAR personal, bukan probabilitas klinis atau jaminan hasil pemulihan.',
  };
}
