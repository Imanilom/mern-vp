/**
 * ablationEngine.js — Core Framework Ablation E1–E6 CAPAR-WEAR
 *
 * Implementasi 6 konfigurasi model ablation:
 *  - E1: Global, Non-Context (Baseline utama)
 *  - E2: Global + Context
 *  - E3: Personal, Non-Context
 *  - E4: Personal + Context (Core personalized deviation model)
 *  - E5: E4 + Quality Gating / Abstention (Abstain jika Q(t) < Qmin)
 *  - E6: E5 + Temporal Governance (FSM: Candidate → Persistent → Recovery → Recovered, Persistence, Hysteresis, Dwell)
 */

export const DEFAULT_ABLATION_CONFIG = {
  sigma_floor: 1.0,
  tau: 1.50,            // Decision threshold dasar E1-E4
  tau_enter: 1.86,      // Hysteresis entry threshold E6
  tau_exit: 1.18,       // Hysteresis exit threshold E6
  tau_normal: 0.75,     // Baseline normal threshold E6
  q_min: 0.75,          // Minimum quality score threshold E5
  m_persistence: 3,     // Persistence window requirement (m consecutive windows)
  min_dwell: 2,         // Minimum dwell time (windows) sebelum state switching
  recovery_dwell: 3,    // Minimum dwell windows di RECOVERY sebelum RECOVERED
  relapse_window_min: 30// Window maksimal relapse (menit) setelah RECOVERED
};

// Global Reference Baselines (Default Population Priors)
export const POPULATION_PRIORS = {
  global: {
    mean_hr: 72.0, std_hr: 8.5,
    rmssd: 35.0,   std_rmssd: 10.0,
    sdnn: 45.0,    std_sdnn: 12.0,
    dfa_alpha1: 1.0, std_dfa: 0.15
  },
  global_context: {
    sitting:   { mean_hr: 70.0, std_hr: 6.0, rmssd: 38.0, std_rmssd: 9.0,  dfa_alpha1: 1.05, std_dfa: 0.12 },
    walking:   { mean_hr: 95.0, std_hr: 10.0, rmssd: 22.0, std_rmssd: 6.0,  dfa_alpha1: 0.90, std_dfa: 0.15 },
    running:   { mean_hr: 135.0, std_hr: 15.0, rmssd: 12.0, std_rmssd: 4.0, dfa_alpha1: 0.75, std_dfa: 0.18 },
    sleeping:  { mean_hr: 58.0, std_hr: 5.0, rmssd: 48.0, std_rmssd: 12.0, dfa_alpha1: 1.15, std_dfa: 0.10 },
    resting:   { mean_hr: 68.0, std_hr: 6.0, rmssd: 40.0, std_rmssd: 8.0,  dfa_alpha1: 1.08, std_dfa: 0.11 }
  }
};

/**
 * Hitung Directional Deviation D(t) dari Z-scores
 * dHR = max(0, Z_HR)
 * dRMSSD = max(0, -Z_RMSSD)
 * dDFA = |Z_DFA|
 * D = (dHR + dRMSSD + dDFA) / 3
 */
export function computeDirectionalDeviation(zHR, zRMSSD, zDFA, deltaHR = 0) {
  const dHR = Math.max(0, zHR || 0);
  const dRMSSD = Math.max(0, -(zRMSSD || 0));
  const dDFA = Math.abs(zDFA || 0);

  const baseD = (dHR + dRMSSD + dDFA) / 3.0;
  return Number((baseD + (deltaHR || 0)).toFixed(3));
}

/**
 * Hitung Z-Score dengan sigma floor
 */
export function computeZScore(val, mean, std, sigmaFloor = 1.0) {
  if (typeof val !== 'number' || isNaN(val)) return 0;
  const effectiveStd = Math.max(std || 1.0, sigmaFloor);
  return Number(((val - (mean || 0)) / effectiveStd).toFixed(3));
}

/**
 * Evaluasi E1 — Global, Non-Context
 */
export function evaluateE1(features, config = DEFAULT_ABLATION_CONFIG) {
  const prior = POPULATION_PRIORS.global;
  const zHR = computeZScore(features.hr_mean ?? features.mean_hr, prior.mean_hr, prior.std_hr, config.sigma_floor);
  const zRMSSD = computeZScore(features.rmssd, prior.rmssd, prior.std_rmssd, config.sigma_floor);
  const zDFA = computeZScore(features.dfa_alpha1, prior.dfa_alpha1, prior.std_dfa, config.sigma_floor);

  const deviation = computeDirectionalDeviation(zHR, zRMSSD, zDFA, 0);
  const pred = deviation >= config.tau ? '1' : '0';

  return {
    score: deviation,
    pred,
    zScores: { zHR, zRMSSD, zDFA }
  };
}

/**
 * Evaluasi E2 — Global + Context
 */
export function evaluateE2(features, contextLabel = 'sitting', config = DEFAULT_ABLATION_CONFIG) {
  const ctx = (contextLabel || 'sitting').toLowerCase();
  const priorCtx = POPULATION_PRIORS.global_context[ctx] || POPULATION_PRIORS.global_context.sitting;

  const zHR = computeZScore(features.hr_mean ?? features.mean_hr, priorCtx.mean_hr, priorCtx.std_hr, config.sigma_floor);
  const zRMSSD = computeZScore(features.rmssd, priorCtx.rmssd, priorCtx.std_rmssd, config.sigma_floor);
  const zDFA = computeZScore(features.dfa_alpha1, priorCtx.dfa_alpha1, priorCtx.std_dfa, config.sigma_floor);

  const deviation = computeDirectionalDeviation(zHR, zRMSSD, zDFA, 0);
  const pred = deviation >= config.tau ? '1' : '0';

  return {
    score: deviation,
    pred,
    zScores: { zHR, zRMSSD, zDFA }
  };
}

/**
 * Evaluasi E3 — Personal, Non-Context
 */
export function evaluateE3(features, personalBaseline, config = DEFAULT_ABLATION_CONFIG) {
  const stats = personalBaseline?.stats || {};
  const meanHR = stats.mean_hr?.mean ?? POPULATION_PRIORS.global.mean_hr;
  const stdHR = stats.mean_hr?.std ?? POPULATION_PRIORS.global.std_hr;

  const meanRMSSD = stats.rmssd?.mean ?? POPULATION_PRIORS.global.rmssd;
  const stdRMSSD = stats.rmssd?.std ?? POPULATION_PRIORS.global.std_rmssd;

  const meanDFA = stats.dfa_alpha1?.mean ?? POPULATION_PRIORS.global.dfa_alpha1;
  const stdDFA = stats.dfa_alpha1?.std ?? POPULATION_PRIORS.global.std_dfa;

  const zHR = computeZScore(features.hr_mean ?? features.mean_hr, meanHR, stdHR, config.sigma_floor);
  const zRMSSD = computeZScore(features.rmssd, meanRMSSD, stdRMSSD, config.sigma_floor);
  const zDFA = computeZScore(features.dfa_alpha1, meanDFA, stdDFA, config.sigma_floor);

  const deviation = computeDirectionalDeviation(zHR, zRMSSD, zDFA, 0);
  const pred = deviation >= config.tau ? '1' : '0';

  return {
    score: deviation,
    pred,
    zScores: { zHR, zRMSSD, zDFA }
  };
}

/**
 * Evaluasi E4 — Personal + Context
 */
export function evaluateE4(features, personalContextBaseline, config = DEFAULT_ABLATION_CONFIG) {
  const stats = personalContextBaseline?.stats || {};
  const meanHR = stats.mean_hr?.mean ?? POPULATION_PRIORS.global.mean_hr;
  const stdHR = stats.mean_hr?.std ?? POPULATION_PRIORS.global.std_hr;

  const meanRMSSD = stats.rmssd?.mean ?? POPULATION_PRIORS.global.rmssd;
  const stdRMSSD = stats.rmssd?.std ?? POPULATION_PRIORS.global.std_rmssd;

  const meanDFA = stats.dfa_alpha1?.mean ?? POPULATION_PRIORS.global.dfa_alpha1;
  const stdDFA = stats.dfa_alpha1?.std ?? POPULATION_PRIORS.global.std_dfa;

  const zHR = computeZScore(features.hr_mean ?? features.mean_hr, meanHR, stdHR, config.sigma_floor);
  const zRMSSD = computeZScore(features.rmssd, meanRMSSD, stdRMSSD, config.sigma_floor);
  const zDFA = computeZScore(features.dfa_alpha1, meanDFA, stdDFA, config.sigma_floor);

  // Delta HR tambahan untuk context dynamics
  const curHR = features.hr_mean ?? features.mean_hr ?? meanHR;
  const deltaHR = curHR > meanHR + (2 * stdHR) ? 0.15 : 0;

  const deviation = computeDirectionalDeviation(zHR, zRMSSD, zDFA, deltaHR);
  const pred = deviation >= config.tau ? '1' : '0';

  return {
    score: deviation,
    pred,
    zScores: { zHR, zRMSSD, zDFA }
  };
}

/**
 * Evaluasi E5 — E4 + Quality Gating / Abstention
 */
export function evaluateE5(e4Result, qualityScore = 1.0, config = DEFAULT_ABLATION_CONFIG) {
  const qVal = typeof qualityScore === 'number' ? qualityScore : 1.0;
  const isPass = qVal >= config.q_min;

  if (!isPass) {
    return {
      score: e4Result.score,
      pred: 'ABSTAIN_QUALITY',
      status: 'ABSTAIN_QUALITY',
      qualityPass: false,
      evaluated: false
    };
  }

  return {
    score: e4Result.score,
    pred: e4Result.pred,
    status: 'VALID',
    qualityPass: true,
    evaluated: true
  };
}

/**
 * Evaluasi E6 — E5 + Temporal Governance (Finite State Machine)
 *
 * States:
 *   - BASELINE_COMPATIBLE
 *   - CANDIDATE
 *   - PERSISTENT_DEVIATION
 *   - RECOVERY_START
 *   - RECOVERED
 */
export class TemporalFSM {
  constructor(config = DEFAULT_ABLATION_CONFIG) {
    this.config = { ...DEFAULT_ABLATION_CONFIG, ...config };
    this.currentState = 'BASELINE_COMPATIBLE';
    this.dwellCount = 0;
    this.consecutiveCandidate = 0;
    this.recoveryDwellCount = 0;
    this.history = [];
    this.stateSwitchingCount = 0;
    this.relapseCount = 0;
  }

  step(e5Result, timestamp = Date.now()) {
    const { score, status, evaluated } = e5Result;
    const prev = this.currentState;

    // Jika E5 Abstain akibat Quality Gate, pertahankan state saat ini tanpa switching
    if (!evaluated || status === 'ABSTAIN_QUALITY') {
      this.dwellCount++;
      return {
        state: this.currentState,
        pred: this.currentState === 'PERSISTENT_DEVIATION' ? '1' : '0',
        switched: false,
        reason: 'QUALITY_ABSTAIN'
      };
    }

    let nextState = prev;
    let reason = 'HOLD';

    // FSM State Transition Rules
    switch (prev) {
      case 'BASELINE_COMPATIBLE':
      case 'RECOVERED':
        if (score >= this.config.tau_enter) {
          this.consecutiveCandidate++;
          if (this.consecutiveCandidate >= this.config.m_persistence) {
            nextState = 'PERSISTENT_DEVIATION';
            reason = 'PERSISTENCE_MET';
            if (prev === 'RECOVERED') {
              this.relapseCount++;
            }
          } else {
            nextState = 'CANDIDATE';
            reason = 'CANDIDATE_ONSET';
          }
        } else {
          this.consecutiveCandidate = 0;
          nextState = prev;
        }
        break;

      case 'CANDIDATE':
        if (score >= this.config.tau_enter) {
          this.consecutiveCandidate++;
          if (this.consecutiveCandidate >= this.config.m_persistence) {
            nextState = 'PERSISTENT_DEVIATION';
            reason = 'PERSISTENCE_MET';
          }
        } else if (score <= this.config.tau_exit) {
          this.consecutiveCandidate = 0;
          nextState = 'BASELINE_COMPATIBLE';
          reason = 'TRANSIENT_EXIT';
        }
        break;

      case 'PERSISTENT_DEVIATION':
        if (score <= this.config.tau_exit) {
          if (this.dwellCount >= this.config.min_dwell) {
            nextState = 'RECOVERY_START';
            this.recoveryDwellCount = 1;
            reason = 'EXIT_THRESHOLD_MET';
          }
        } else {
          nextState = 'PERSISTENT_DEVIATION';
        }
        break;

      case 'RECOVERY_START':
        if (score >= this.config.tau_enter) {
          nextState = 'PERSISTENT_DEVIATION';
          this.relapseCount++;
          reason = 'RELAPSE_DURING_RECOVERY';
        } else if (score <= this.config.tau_normal) {
          this.recoveryDwellCount++;
          if (this.recoveryDwellCount >= this.config.recovery_dwell) {
            nextState = 'RECOVERED';
            reason = 'RECOVERY_COMPLETE';
          }
        }
        break;

      default:
        nextState = 'BASELINE_COMPATIBLE';
    }

    const switched = nextState !== prev;
    if (switched) {
      this.stateSwitchingCount++;
      this.dwellCount = 1;
    } else {
      this.dwellCount++;
    }

    this.currentState = nextState;
    const pred = (nextState === 'PERSISTENT_DEVIATION' || nextState === 'CANDIDATE') ? '1' : '0';

    this.history.push({
      timestamp,
      score,
      state: nextState,
      switched,
      reason
    });

    return {
      state: nextState,
      pred,
      switched,
      reason,
      dwellCount: this.dwellCount
    };
  }
}

/**
 * Evaluasi Lengkap E1–E6 untuk satu data window sample
 */
export function evaluateAllAblations(sample, baselines = {}, config = DEFAULT_ABLATION_CONFIG) {
  const { features = {}, context = 'sitting', qualityScore = 1.0, timestamp = Date.now() } = sample;

  const e1 = evaluateE1(features, config);
  const e2 = evaluateE2(features, context, config);
  const e3 = evaluateE3(features, baselines.personal, config);
  const e4 = evaluateE4(features, baselines.personalContext, config);
  const e5 = evaluateE5(e4, qualityScore, config);

  return {
    timestamp,
    E1: e1,
    E2: e2,
    E3: e3,
    E4: e4,
    E5: e5
  };
}

/**
 * Hitung Metrik Evaluasi Klasifikasi & Ablation Contribution
 */
export function computeAblationMetrics(records = []) {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      E1: getEmptyMetric(), E2: getEmptyMetric(), E3: getEmptyMetric(),
      E4: getEmptyMetric(), E5: getEmptyMetric(), E6: getEmptyMetric(),
      deltas: { delta_context: 0, delta_personal: 0, delta_joint: 0, delta_quality: 0, delta_temporal: 0 }
    };
  }

  const N = records.length;

  const calcConfMatrix = (getPred) => {
    let TP = 0, FP = 0, FN = 0, TN = 0;
    let evaluatedCount = 0;

    records.forEach(r => {
      const yTrue = String(r.y_true ?? r.ground_truth ?? '1') === '1' ? 1 : 0;
      const pred = getPred(r);

      if (pred === 'ABSTAIN_QUALITY') return;

      evaluatedCount++;
      const pVal = pred === '1' || pred === 1 ? 1 : 0;

      if (pVal === 1 && yTrue === 1) TP++;
      else if (pVal === 1 && yTrue === 0) FP++;
      else if (pVal === 0 && yTrue === 1) FN++;
      else TN++;
    });

    const total = TP + FP + FN + TN;
    const precision = (TP + FP) > 0 ? TP / (TP + FP) : 1.0;
    const recall = (TP + FN) > 0 ? TP / (TP + FN) : 1.0;
    const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 1.0;
    const accuracy = total > 0 ? (TP + TN) / total : 1.0;
    const coverage = N > 0 ? evaluatedCount / N : 1.0;
    const abstentionRate = 1.0 - coverage;

    return {
      TP, FP, FN, TN,
      total: evaluatedCount,
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1: Number(f1.toFixed(4)),
      accuracy: Number(accuracy.toFixed(4)),
      coverage: Number(coverage.toFixed(4)),
      abstention_rate: Number(abstentionRate.toFixed(4))
    };
  };

  const m1 = calcConfMatrix(r => r.pred_E1);
  const m2 = calcConfMatrix(r => r.pred_E2);
  const m3 = calcConfMatrix(r => r.pred_E3);
  const m4 = calcConfMatrix(r => r.pred_E4);
  const m5 = calcConfMatrix(r => r.pred_E5);
  const m6 = calcConfMatrix(r => r.pred_E6);

  // Delta Contributions
  const deltaContext = Number((m2.f1 - m1.f1).toFixed(4));
  const deltaPersonal = Number((m3.f1 - m1.f1).toFixed(4));
  const deltaJoint = Number((m4.f1 - m1.f1).toFixed(4));
  const deltaQuality = Number((m5.f1 - m4.f1).toFixed(4));
  const deltaTemporal = Number((m6.f1 - m5.f1).toFixed(4));

  return {
    sample_count: N,
    E1: m1,
    E2: m2,
    E3: m3,
    E4: m4,
    E5: m5,
    E6: m6,
    deltas: {
      delta_context: deltaContext,
      delta_personal: deltaPersonal,
      delta_joint: deltaJoint,
      delta_quality: deltaQuality,
      delta_temporal: deltaTemporal
    }
  };
}

function getEmptyMetric() {
  return {
    TP: 0, FP: 0, FN: 0, TN: 0, total: 0,
    precision: 1.0, recall: 1.0, f1: 1.0, accuracy: 1.0,
    coverage: 1.0, abstention_rate: 0.0
  };
}
