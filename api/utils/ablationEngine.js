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

import {
  getPatientDecisionPolicy,
  getPatientDecisionPolicyBundle,
} from '../config/patientDecisionPolicies.js';

const ABLATION_RULES = Object.freeze({
  sigma_floor: 'ablation_sigma_floor',
  tau: 'ablation_tau',
  tau_enter: 'ablation_tau_enter',
  tau_exit: 'ablation_tau_exit',
  tau_normal: 'ablation_tau_normal',
  q_min: 'ablation_quality_minimum',
  m_persistence: 'ablation_persistence_windows',
  min_dwell: 'ablation_minimum_dwell_windows',
  recovery_dwell: 'ablation_recovery_dwell_windows',
  relapse_window_min: 'ablation_relapse_window_minutes',
  delta_hr_std_multiplier: 'ablation_delta_hr_std_multiplier',
  delta_hr_adjustment: 'ablation_delta_hr_adjustment',
});

export function createAblationConfig(policyOverrides = {}) {
  const policies = Object.fromEntries(
    Object.entries(ABLATION_RULES).map(([key, ruleId]) => [
      key,
      getPatientDecisionPolicy(ruleId, policyOverrides),
    ])
  );
  return Object.freeze({
    ...Object.fromEntries(
      Object.entries(policies).map(([key, policy]) => [key, policy.value])
    ),
    policy: getPatientDecisionPolicyBundle([
      ...Object.values(ABLATION_RULES),
      'ablation_population_priors',
    ], policyOverrides),
  });
}

export const DEFAULT_ABLATION_CONFIG = createAblationConfig();

const populationPriorsPolicy = getPatientDecisionPolicy('ablation_population_priors');
export const POPULATION_PRIORS = populationPriorsPolicy.value;
Object.freeze(POPULATION_PRIORS.global_context);
Object.freeze(POPULATION_PRIORS.global);
Object.freeze(POPULATION_PRIORS);

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
  if (![val, mean, std, sigmaFloor].every(Number.isFinite) || std < 0 || sigmaFloor <= 0) {
    return null;
  }
  const effectiveStd = Math.max(std, sigmaFloor);
  return Number(((val - mean) / effectiveStd).toFixed(3));
}

function missingFeaturesResult(reason = 'MISSING_FEATURES') {
  return {
    score: null,
    pred: `ABSTAIN_${reason}`,
    status: `ABSTAIN_${reason}`,
    evaluated: false,
    zScores: { zHR: null, zRMSSD: null, zDFA: null },
  };
}

function hasCoreFeatures(features) {
  return [
    features?.hr_mean ?? features?.mean_hr,
    features?.rmssd,
    features?.dfa_alpha1,
  ].every(Number.isFinite);
}

function hasPersonalBaseline(baseline) {
  return ['mean_hr', 'rmssd', 'dfa_alpha1'].every((key) => (
    Number.isFinite(baseline?.stats?.[key]?.mean)
    && Number.isFinite(baseline?.stats?.[key]?.std)
    && baseline.stats[key].std >= 0
  ));
}

/**
 * Evaluasi E1 — Global, Non-Context
 */
export function evaluateE1(features, config = DEFAULT_ABLATION_CONFIG) {
  if (!hasCoreFeatures(features)) return missingFeaturesResult();
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
export function evaluateE2(features, contextLabel = null, config = DEFAULT_ABLATION_CONFIG) {
  if (!hasCoreFeatures(features)) return missingFeaturesResult();
  const ctx = typeof contextLabel === 'string' ? contextLabel.toLowerCase() : '';
  const priorCtx = POPULATION_PRIORS.global_context[ctx];
  if (!priorCtx) return missingFeaturesResult('MISSING_CONTEXT');

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
  if (!hasCoreFeatures(features)) return missingFeaturesResult();
  if (!hasPersonalBaseline(personalBaseline)) return missingFeaturesResult('MISSING_BASELINE');
  const stats = personalBaseline?.stats || {};
  const meanHR = stats.mean_hr.mean;
  const stdHR = stats.mean_hr.std;

  const meanRMSSD = stats.rmssd.mean;
  const stdRMSSD = stats.rmssd.std;

  const meanDFA = stats.dfa_alpha1.mean;
  const stdDFA = stats.dfa_alpha1.std;

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
  if (!hasCoreFeatures(features)) return missingFeaturesResult();
  if (!hasPersonalBaseline(personalContextBaseline)) return missingFeaturesResult('MISSING_BASELINE');
  const stats = personalContextBaseline?.stats || {};
  const meanHR = stats.mean_hr.mean;
  const stdHR = stats.mean_hr.std;

  const meanRMSSD = stats.rmssd.mean;
  const stdRMSSD = stats.rmssd.std;

  const meanDFA = stats.dfa_alpha1.mean;
  const stdDFA = stats.dfa_alpha1.std;

  const zHR = computeZScore(features.hr_mean ?? features.mean_hr, meanHR, stdHR, config.sigma_floor);
  const zRMSSD = computeZScore(features.rmssd, meanRMSSD, stdRMSSD, config.sigma_floor);
  const zDFA = computeZScore(features.dfa_alpha1, meanDFA, stdDFA, config.sigma_floor);

  // Delta HR tambahan untuk context dynamics
  const curHR = features.hr_mean ?? features.mean_hr ?? meanHR;
  const deltaHR = curHR > meanHR + (config.delta_hr_std_multiplier * stdHR)
    ? config.delta_hr_adjustment
    : 0;

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
export function evaluateE5(e4Result, qualityScore = null, config = DEFAULT_ABLATION_CONFIG) {
  if (!e4Result?.evaluated && e4Result?.status?.startsWith('ABSTAIN_')) {
    return { ...e4Result, qualityPass: false };
  }
  const qVal = Number.isFinite(qualityScore) ? qualityScore : null;
  if (qVal === null) {
    return {
      score: e4Result.score,
      pred: 'ABSTAIN_QUALITY_UNAVAILABLE',
      status: 'ABSTAIN_QUALITY_UNAVAILABLE',
      qualityPass: false,
      evaluated: false,
    };
  }
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

  step(e5Result, timestamp = null) {
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
  if (!config?.policy) {
    throw new TypeError('Ablation config must be created with createAblationConfig() to include policy provenance');
  }
  const { features = {}, context = null, qualityScore = null, timestamp = null } = sample;

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
    E5: e5,
    policy: config.policy,
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
      deltas: {
        delta_context: null,
        delta_personal: null,
        delta_joint: null,
        delta_quality: null,
        delta_temporal: null,
      }
    };
  }

  const N = records.length;

  const calcConfMatrix = (getPred) => {
    let TP = 0, FP = 0, FN = 0, TN = 0;
    let evaluatedCount = 0;
    let labeledCount = 0;

    records.forEach(r => {
      const rawYTrue = r.y_true ?? r.ground_truth;
      if (rawYTrue !== '1' && rawYTrue !== '0' && rawYTrue !== 1 && rawYTrue !== 0) return;
      labeledCount++;
      const yTrue = String(rawYTrue) === '1' ? 1 : 0;

      const pred = getPred(r);

      if (typeof pred !== 'string' || pred.startsWith('ABSTAIN')) return;

      evaluatedCount++;
      const pVal = pred === '1' || pred === 1 ? 1 : 0;

      if (pVal === 1 && yTrue === 1) TP++;
      else if (pVal === 1 && yTrue === 0) FP++;
      else if (pVal === 0 && yTrue === 1) FN++;
      else TN++;
    });

    const total = TP + FP + FN + TN;
    const precision = (TP + FP) > 0 ? TP / (TP + FP) : null;
    const recall = (TP + FN) > 0 ? TP / (TP + FN) : null;
    const f1 = precision !== null && recall !== null && (precision + recall) > 0
      ? (2 * precision * recall) / (precision + recall)
      : null;
    const accuracy = total > 0 ? (TP + TN) / total : null;
    const coverage = labeledCount > 0 ? evaluatedCount / labeledCount : null;
    const abstentionRate = coverage === null ? null : 1.0 - coverage;

    return {
      TP, FP, FN, TN,
      total: evaluatedCount,
      labeled_count: labeledCount,
      precision: precision === null ? null : Number(precision.toFixed(4)),
      recall: recall === null ? null : Number(recall.toFixed(4)),
      f1: f1 === null ? null : Number(f1.toFixed(4)),
      accuracy: accuracy === null ? null : Number(accuracy.toFixed(4)),
      coverage: coverage === null ? null : Number(coverage.toFixed(4)),
      abstention_rate: abstentionRate === null ? null : Number(abstentionRate.toFixed(4))
    };
  };

  const m1 = calcConfMatrix(r => r.pred_E1);
  const m2 = calcConfMatrix(r => r.pred_E2);
  const m3 = calcConfMatrix(r => r.pred_E3);
  const m4 = calcConfMatrix(r => r.pred_E4);
  const m5 = calcConfMatrix(r => r.pred_E5);
  const m6 = calcConfMatrix(r => r.pred_E6);

  // Delta Contributions
  const delta = (next, previous) => (
    next === null || previous === null ? null : Number((next - previous).toFixed(4))
  );

  return {
    sample_count: N,
    E1: m1,
    E2: m2,
    E3: m3,
    E4: m4,
    E5: m5,
    E6: m6,
    deltas: {
      delta_context: delta(m2.f1, m1.f1),
      delta_personal: delta(m3.f1, m1.f1),
      delta_joint: delta(m4.f1, m1.f1),
      delta_quality: delta(m5.f1, m4.f1),
      delta_temporal: delta(m6.f1, m5.f1)
    }
  };
}

function getEmptyMetric() {
  return {
    TP: 0, FP: 0, FN: 0, TN: 0, total: 0, labeled_count: 0,
    precision: null, recall: null, f1: null, accuracy: null,
    coverage: null, abstention_rate: null
  };
}
