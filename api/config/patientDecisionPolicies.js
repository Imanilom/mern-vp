const POLICY_STATUS = 'NON-CLINICAL / PLACEHOLDER';
const POLICY_ID = 'nadiku_patient_decision_demo';
const POLICY_VERSION = '0.1.0';
const POLICY_SOURCE = 'Internal software demonstration configuration; no clinical source supplied';
const POLICY_RATIONALE = 'Demonstration and testing only. Requires clinical governance review before any clinical use.';
const EFFECTIVE_DATE = '2026-10-07';
const CONFIDENCE = 0;

const defaults = {
  red_flag_chest_pain_enabled: {
    value: true,
    rationale: 'Preserves the existing patient-reported symptom escalation behavior; this criterion has not been clinically validated.',
  },
  rr_maturing_min_windows: {
    value: 30,
    rationale: 'Existing state-transition threshold for baseline maturity.',
  },
  rr_provisional_state_min_windows: {
    value: 15,
    rationale: 'Existing state-transition threshold for baseline maturity.',
  },
  rr_auto_freeze_min_days: {
    value: 3,
    unit: 'days',
    rationale: 'Existing automatic baseline-freeze setting.',
  },
  rr_gap_pause_minutes: {
    value: 60,
    unit: 'minutes',
    rationale: 'Existing temporal state-machine pause interval for sparse data.',
  },
  rr_disconnect_timeout_minutes: {
    value: 15,
    unit: 'minutes',
    rationale: 'Existing temporal state-machine disconnect interval.',
  },
  rr_state_history_window_count: {
    value: 3,
    rationale: 'Existing temporal state-machine recent-window count.',
  },
  rr_state_positive_history_windows: {
    value: 2,
    rationale: 'Existing temporal state-machine persistence criterion.',
  },
  red_flag_breathlessness_severity_min: {
    value: 7,
    unit: 'patient_reported_scale',
    rationale: 'Existing software cutoff retained for demonstration; scale and cutoff require clinical definition.',
  },
  red_flag_symptom_severity_min: {
    value: 9,
    unit: 'patient_reported_scale',
    rationale: 'Existing software cutoff retained for demonstration; scale and cutoff require clinical definition.',
  },
  patient_persistence_positive_windows: {
    value: 4,
    rationale: 'Existing k-of-m persistence setting retained for demonstration; not a clinical persistence definition.',
  },
  patient_persistence_window_count: {
    value: 5,
    rationale: 'Existing k-of-m persistence setting retained for demonstration; not a clinical persistence definition.',
  },
  patient_maximum_window_gap_minutes: {
    value: 10,
    unit: 'minutes',
    rationale: 'Existing temporal continuity setting retained for demonstration.',
  },
  patient_prolonged_dwell_minutes: {
    value: 15,
    unit: 'minutes',
    rationale: 'Existing dwell setting retained for demonstration; not a clinical duration criterion.',
  },
  patient_active_episode_minutes: {
    value: 30,
    unit: 'minutes',
    rationale: 'Existing episode duration setting retained for demonstration; not a clinical duration criterion.',
  },
  patient_recovery_score_slope: {
    value: -0.1,
    unit: 'score_per_window',
    rationale: 'Existing trend setting retained for software trajectory description.',
  },
  patient_score_change_stability_epsilon: {
    value: 0.1,
    unit: 'score_change',
    rationale: 'Existing trend display deadband for calling score direction stable.',
  },
  patient_recovery_recent_window_count: {
    value: 10,
    rationale: 'Existing trajectory display window count.',
  },
  patient_relapse_lookback_hours: {
    value: 24,
    unit: 'hours',
    rationale: 'Existing event lookback period retained for demonstration.',
  },
  patient_analytics_quality_min: {
    value: 0.7,
    unit: 'fraction',
    rationale: 'Existing patient analytics quality gate; not a clinical reference range.',
  },
  patient_legacy_baseline_min_segments: {
    value: 20,
    rationale: 'Existing compatibility requirement for legacy mature baselines.',
  },
  patient_mahalanobis_min_baseline_samples: {
    value: 30,
    rationale: 'Existing statistical model sample minimum; requires validation for intended data and population.',
  },
  patient_mahalanobis_mild_z_score: {
    value: 1.6448536269514722,
    rationale: 'Normal-score approximation used by the existing statistical reference threshold; not a clinical cutoff.',
  },
  patient_mahalanobis_significant_z_score: {
    value: 2.3263478740408408,
    rationale: 'Normal-score approximation used by the existing statistical reference threshold; not a clinical cutoff.',
  },
  patient_deviation_minimum_feature_weight: {
    value: 0.5,
    unit: 'weight',
    rationale: 'Existing minimum comparable-feature weight for explanation availability.',
  },
  patient_deviation_minimum_baseline_samples: {
    value: 2,
    rationale: 'Existing minimum sample count for feature-level baseline comparison.',
  },
  patient_deviation_minimum_baseline_std: {
    value: 0.001,
    rationale: 'Existing numerical guard for near-zero baseline standard deviation.',
  },
  patient_deviation_zero_z_epsilon: {
    value: 0.01,
    rationale: 'Existing display filter for negligible feature z-score.',
  },
  patient_deviation_mild_z_score: {
    value: 1,
    rationale: 'Existing statistical explanation bucket, not a clinical cutoff.',
  },
  patient_deviation_significant_z_score: {
    value: 2,
    rationale: 'Existing statistical explanation bucket, not a clinical cutoff.',
  },
  patient_reasoning_uncertainty_framework: {
    value: {
      numeric_confidence_calibrated: false,
      dimensions: [
        'physiological_evidence',
        'personal_baseline',
        'multivariate_contribution',
        'context_evidence',
        'signal_quality',
        'evidence_conflicts',
      ],
    },
    rationale: 'Qualitative evidence-sufficiency reporting only. No probability or confidence score is calculated until an individual-level method is validated and calibrated.',
  },
  patient_context_elevated_hr_z_score: {
    value: 1,
    rationale: 'Existing context-association heuristic, not a clinical cutoff or causal finding.',
  },
  patient_context_high_motion_z_score: {
    value: 1,
    rationale: 'Existing context-association heuristic, not a clinical cutoff or causal finding.',
  },
  rr_max_artifact_fraction: {
    value: 0.05,
    unit: 'fraction',
    rationale: 'Existing RR signal-processing quality setting; not a clinical reference range.',
  },
  rr_max_missing_fraction: {
    value: 0.1,
    unit: 'fraction',
    rationale: 'Existing RR signal-processing quality setting; not a clinical reference range.',
  },
  rr_min_activity_confidence: {
    value: 0.8,
    unit: 'fraction',
    rationale: 'Existing activity-classification quality setting.',
  },
  rr_min_valid_intervals: {
    value: 45,
    rationale: 'Existing one-minute window quality requirement; device/population validation is required.',
  },
  rr_min_beats_for_dfa: {
    value: 64,
    rationale: 'Existing minimum RR beat count for DFA feature extraction.',
  },
  wearable_min_signal_confidence: {
    value: 0.7,
    unit: 'fraction',
    rationale: 'Existing wearable ingestion confidence cutoff; device-specific validation is required.',
  },
  wearable_max_hr_rr_disagreement_bpm: {
    value: 25,
    unit: 'bpm',
    rationale: 'Existing wearable data consistency gate; sensor-specific validation is required.',
  },
  rr_population_priors: {
    value: {
      Rest: {
        hr_mean: { mean: 65, sd: 10 },
        sdnn: { mean: 50, sd: 15 },
        rmssd: { mean: 42, sd: 18 },
        dfa_alpha1: { mean: 1.1, sd: 0.2 },
      },
      Light: {
        hr_mean: { mean: 80, sd: 12 },
        sdnn: { mean: 40, sd: 12 },
        rmssd: { mean: 30, sd: 14 },
        dfa_alpha1: { mean: 1, sd: 0.2 },
      },
      Moderate: {
        hr_mean: { mean: 95, sd: 15 },
        sdnn: { mean: 30, sd: 10 },
        rmssd: { mean: 20, sd: 10 },
        dfa_alpha1: { mean: 0.9, sd: 0.2 },
      },
      Intense: {
        hr_mean: { mean: 130, sd: 20 },
        sdnn: { mean: 20, sd: 8 },
        rmssd: { mean: 12, sd: 6 },
        dfa_alpha1: { mean: 0.8, sd: 0.15 },
      },
      Unknown: {
        hr_mean: { mean: 75, sd: 15 },
        sdnn: { mean: 45, sd: 15 },
        rmssd: { mean: 35, sd: 15 },
        dfa_alpha1: { mean: 1, sd: 0.2 },
      },
    },
    rationale: 'Existing rough literature-inspired priors have no supplied citation and remain demonstration-only.',
  },
  rr_interval_min_ms: {
    value: 300,
    unit: 'milliseconds',
    rationale: 'Existing RR processing input bound; device and intended-use validation is required.',
  },
  rr_interval_max_ms: {
    value: 2000,
    unit: 'milliseconds',
    rationale: 'Existing RR processing input bound; device and intended-use validation is required.',
  },
  rr_local_median_beats: {
    value: 11,
    rationale: 'Existing artifact filter window size.',
  },
  rr_local_relative_deviation: {
    value: 0.2,
    unit: 'fraction',
    rationale: 'Existing artifact filter parameter.',
  },
  rr_local_absolute_deviation_ms: {
    value: 200,
    unit: 'milliseconds',
    rationale: 'Existing artifact filter parameter.',
  },
  rr_max_relative_jump: {
    value: 0.2,
    unit: 'fraction',
    rationale: 'Existing consecutive RR artifact filter parameter.',
  },
  rr_provisional_min_windows: {
    value: 10,
    rationale: 'Existing baseline-maturity setting.',
  },
  rr_provisional_scoring_min_windows: {
    value: 5,
    rationale: 'Existing minimum historical window count before provisional score fallback.',
  },
  rr_mature_min_windows: {
    value: 20,
    rationale: 'Existing baseline-maturity setting.',
  },
  rr_min_effective_windows: {
    value: 20,
    rationale: 'Existing baseline-maturity setting.',
  },
  rr_min_distinct_days: {
    value: 2,
    unit: 'days',
    rationale: 'Existing baseline-maturity setting.',
  },
  rr_min_windows_per_day: {
    value: 10,
    rationale: 'Existing baseline-maturity setting.',
  },
  rr_max_single_day_fraction: {
    value: 0.6,
    unit: 'fraction',
    rationale: 'Existing baseline-maturity setting.',
  },
  rr_baseline_quality_min: {
    value: 0.7,
    unit: 'fraction',
    rationale: 'Existing baseline quality gate; not a clinical reference range.',
  },
  rr_min_stability_score: {
    value: 0.65,
    unit: 'fraction',
    rationale: 'Existing baseline-maturity setting.',
  },
  rr_min_component_quality: {
    value: 0.6,
    unit: 'fraction',
    rationale: 'Existing baseline-maturity setting.',
  },
  rr_autocorrelation_max_lag: {
    value: 20,
    rationale: 'Existing baseline statistical configuration.',
  },
  rr_provisional_outlier_mad: {
    value: 4,
    rationale: 'Existing robust-statistics provisional outlier setting.',
  },
  rr_provisional_outlier_min_samples: {
    value: 8,
    rationale: 'Existing provisional outlier sample minimum.',
  },
  rr_maturity_mature_caution: {
    value: 1.5,
    rationale: 'Existing anomaly score cutoff for software state classification; not a clinical threshold.',
  },
  rr_maturity_mature_alert: {
    value: 3,
    rationale: 'Existing anomaly score cutoff for software state classification; not a clinical threshold.',
  },
  rr_maturity_maturing_caution: {
    value: 2,
    rationale: 'Existing anomaly score cutoff for software state classification; not a clinical threshold.',
  },
  rr_maturity_maturing_alert: {
    value: 3.5,
    rationale: 'Existing anomaly score cutoff for software state classification; not a clinical threshold.',
  },
  rr_maturity_provisional_caution: {
    value: 2.5,
    rationale: 'Existing anomaly score cutoff for software state classification; not a clinical threshold.',
  },
  rr_maturity_provisional_alert: {
    value: 4,
    rationale: 'Existing anomaly score cutoff for software state classification; not a clinical threshold.',
  },
  rr_maturity_cold_start_caution: {
    value: 3,
    rationale: 'Existing anomaly score cutoff for software state classification; not a clinical threshold.',
  },
  rr_maturity_cold_start_alert: {
    value: 5,
    rationale: 'Existing anomaly score cutoff for software state classification; not a clinical threshold.',
  },
  rr_max_abs_z_score: {
    value: 8,
    rationale: 'Existing statistical score clipping setting.',
  },
  rr_persistence_windows: {
    value: 2,
    rationale: 'Existing temporal state-machine persistence setting.',
  },
  rr_recovery_windows: {
    value: 2,
    rationale: 'Existing temporal state-machine recovery setting.',
  },
  rr_cooldown_windows: {
    value: 2,
    rationale: 'Existing temporal state-machine cooldown setting.',
  },
  rr_recovery_threshold_fraction: {
    value: 0.5,
    unit: 'fraction',
    rationale: 'Existing temporal state-machine recovery setting.',
  },
  rr_tau_normal_recovery_fraction: {
    value: 0.7,
    unit: 'fraction',
    rationale: 'Existing temporal state-machine fallback setting.',
  },
  rr_min_scored_feature_weight: {
    value: 0.5,
    unit: 'weight',
    rationale: 'Existing minimum available feature weight for RR anomaly score availability.',
  },
  rr_maturity_penalty_mature: {
    value: 1,
    rationale: 'Existing score adjustment for mature baselines.',
  },
  rr_maturity_penalty_maturing: {
    value: 0.85,
    rationale: 'Existing score adjustment for maturing baselines.',
  },
  rr_maturity_penalty_provisional: {
    value: 0.7,
    rationale: 'Existing score adjustment for provisional baselines.',
  },
  rr_maturity_penalty_cold_start: {
    value: 0.5,
    rationale: 'Existing score adjustment for cold-start baselines.',
  },
  episode_tau_in_fallback: {
    value: 2.5,
    rationale: 'Existing episode-analysis fallback threshold; not a clinical cutoff.',
  },
  episode_tau_out_fallback_fraction: {
    value: 0.6,
    unit: 'fraction',
    rationale: 'Existing episode-analysis fallback threshold relationship; not a clinical cutoff.',
  },
  episode_tau_normal_fallback_fraction: {
    value: 0.75,
    unit: 'fraction',
    rationale: 'Existing episode-analysis fallback threshold relationship; not a clinical cutoff.',
  },
  episode_generate_tau_in: {
    value: 1.5,
    rationale: 'Existing episode-generator threshold retained for software demonstration; not a clinical cutoff.',
  },
  episode_generate_tau_out: {
    value: 1,
    rationale: 'Existing episode-generator threshold retained for software demonstration; not a clinical cutoff.',
  },
  episode_generate_tau_normal: {
    value: 0.75,
    rationale: 'Existing episode-generator threshold retained for software demonstration; not a clinical cutoff.',
  },
  episode_sync_tau_in: {
    value: 1.86,
    rationale: 'Existing episode-sync threshold retained for software demonstration; not a clinical cutoff.',
  },
  episode_sync_tau_out: {
    value: 1.2,
    rationale: 'Existing episode-sync threshold retained for software demonstration; not a clinical cutoff.',
  },
  episode_sync_tau_normal: {
    value: 0.75,
    rationale: 'Existing episode-sync threshold retained for software demonstration; not a clinical cutoff.',
  },
  ablation_sigma_floor: {
    value: 1,
    rationale: 'Existing numerical floor for experimental z-score calculations; not a clinical reference range.',
  },
  ablation_tau: {
    value: 1.5,
    rationale: 'Existing E1-E4 software decision threshold; not a clinical cutoff.',
  },
  ablation_tau_enter: {
    value: 1.86,
    rationale: 'Existing E6 software state-entry threshold; not a clinical cutoff.',
  },
  ablation_tau_exit: {
    value: 1.18,
    rationale: 'Existing E6 software state-exit threshold; not a clinical cutoff.',
  },
  ablation_tau_normal: {
    value: 0.75,
    rationale: 'Existing E6 software normal-state threshold; not a clinical cutoff.',
  },
  ablation_quality_minimum: {
    value: 0.75,
    unit: 'fraction',
    rationale: 'Existing E5 software quality gate; not a clinical quality reference range.',
  },
  ablation_persistence_windows: {
    value: 3,
    rationale: 'Existing experimental temporal persistence window count; not a clinical definition.',
  },
  ablation_minimum_dwell_windows: {
    value: 2,
    rationale: 'Existing experimental temporal dwell window count; not a clinical definition.',
  },
  ablation_recovery_dwell_windows: {
    value: 3,
    rationale: 'Existing experimental temporal recovery window count; not a clinical definition.',
  },
  ablation_relapse_window_minutes: {
    value: 30,
    unit: 'minutes',
    rationale: 'Existing experimental relapse lookback period; not a clinical definition.',
  },
  ablation_delta_hr_std_multiplier: {
    value: 2,
    rationale: 'Existing experimental HR context-adjustment multiplier; not a clinical cutoff.',
  },
  ablation_delta_hr_adjustment: {
    value: 0.15,
    rationale: 'Existing experimental HR context-adjustment contribution; not a clinical score.',
  },
  ablation_population_priors: {
    value: {
      global: {
        mean_hr: 72,
        std_hr: 8.5,
        rmssd: 35,
        std_rmssd: 10,
        sdnn: 45,
        std_sdnn: 12,
        dfa_alpha1: 1,
        std_dfa: 0.15,
      },
      global_context: {
        sitting: { mean_hr: 70, std_hr: 6, rmssd: 38, std_rmssd: 9, dfa_alpha1: 1.05, std_dfa: 0.12 },
        walking: { mean_hr: 95, std_hr: 10, rmssd: 22, std_rmssd: 6, dfa_alpha1: 0.9, std_dfa: 0.15 },
        running: { mean_hr: 135, std_hr: 15, rmssd: 12, std_rmssd: 4, dfa_alpha1: 0.75, std_dfa: 0.18 },
        sleeping: { mean_hr: 58, std_hr: 5, rmssd: 48, std_rmssd: 12, dfa_alpha1: 1.15, std_dfa: 0.1 },
        resting: { mean_hr: 68, std_hr: 6, rmssd: 40, std_rmssd: 8, dfa_alpha1: 1.08, std_dfa: 0.11 },
      },
    },
    rationale: 'Existing experimental population reference values retained for software comparison only; not clinical reference ranges.',
  },
  streaming_quality_excellent_min_pct: {
    value: 85,
    unit: 'percent',
    rationale: 'Existing streaming quality display category boundary; not a clinical threshold.',
  },
  streaming_quality_acceptable_min_pct: {
    value: 70,
    unit: 'percent',
    rationale: 'Existing streaming quality display category boundary; not a clinical threshold.',
  },
  calibration_quality_minimum_score: {
    value: 0.7,
    unit: 'fraction',
    rationale: 'Existing calibration quality score gate; not a clinical reference range.',
  },
  capar_min_stable_scores: {
    value: 30,
    rationale: 'Existing minimum stable-memory count before learned CAPAR thresholds are treated as mature.',
  },
  capar_min_scores_for_learning: {
    value: 10,
    rationale: 'Existing early-data floor for demonstrating learned CAPAR thresholds.',
  },
  capar_tau_in_lower: {
    value: 1,
    rationale: 'Existing CAPAR score clipping setting; algorithmic, not a clinical reference range.',
  },
  capar_tau_in_upper: {
    value: 3,
    rationale: 'Existing CAPAR score clipping setting; algorithmic, not a clinical reference range.',
  },
  capar_tau_out_lower: {
    value: 0.5,
    rationale: 'Existing CAPAR score clipping setting; algorithmic, not a clinical reference range.',
  },
  capar_tau_out_upper: {
    value: 2.5,
    rationale: 'Existing CAPAR score clipping setting; algorithmic, not a clinical reference range.',
  },
  capar_minimum_hysteresis_gap: {
    value: 0.15,
    rationale: 'Existing CAPAR hysteresis setting; algorithmic, not a clinical reference range.',
  },
  capar_tau_normal_lower: {
    value: 0.3,
    rationale: 'Existing CAPAR score clipping setting; algorithmic, not a clinical reference range.',
  },
  capar_default_tau_in: {
    value: 1.5,
    rationale: 'Existing fallback used before sufficient stable scores; demonstration only.',
  },
  capar_default_tau_out: {
    value: 1,
    rationale: 'Existing fallback used before sufficient stable scores; demonstration only.',
  },
  capar_default_tau_normal: {
    value: 0.7,
    rationale: 'Existing fallback used before sufficient stable scores; demonstration only.',
  },
  capar_provisional_hr_std_fallback: {
    value: 2.5,
    rationale: 'Existing HR standard-deviation fallback used by provisional CAPAR thresholds.',
  },
  capar_provisional_tau_in_base: {
    value: 1.5,
    rationale: 'Existing provisional threshold formula intercept; algorithmic, not a clinical cutoff.',
  },
  capar_provisional_tau_in_hr_std_weight: {
    value: 0.08,
    rationale: 'Existing provisional threshold formula coefficient; algorithmic, not a clinical cutoff.',
  },
  capar_provisional_tau_out_base: {
    value: 1,
    rationale: 'Existing provisional threshold formula intercept; algorithmic, not a clinical cutoff.',
  },
  capar_provisional_tau_out_hr_std_weight: {
    value: 0.04,
    rationale: 'Existing provisional threshold formula coefficient; algorithmic, not a clinical cutoff.',
  },
  capar_provisional_tau_normal: {
    value: 0.75,
    rationale: 'Existing provisional threshold fallback; algorithmic, not a clinical cutoff.',
  },
  capar_tau_in_quantile: {
    value: 0.99,
    unit: 'quantile',
    rationale: 'Existing quantile-derived statistical threshold; not a clinical cutoff.',
  },
  capar_tau_out_quantile: {
    value: 0.95,
    unit: 'quantile',
    rationale: 'Existing quantile-derived statistical threshold; not a clinical cutoff.',
  },
  capar_tau_normal_quantile: {
    value: 0.9,
    unit: 'quantile',
    rationale: 'Existing quantile-derived statistical threshold; not a clinical cutoff.',
  },
};

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

const policyFor = (ruleId, definition) => ({
  policy_id: POLICY_ID,
  rule_id: ruleId,
  version: POLICY_VERSION,
  source: POLICY_SOURCE,
  rationale: definition.rationale || POLICY_RATIONALE,
  effective_date: EFFECTIVE_DATE,
  confidence: CONFIDENCE,
  status: POLICY_STATUS,
  value: deepFreeze(definition.value),
  ...(definition.unit ? { unit: definition.unit } : {}),
});

export const PATIENT_DECISION_POLICIES = Object.freeze(
  Object.fromEntries(
    Object.entries(defaults).map(([ruleId, definition]) => [
      ruleId,
      Object.freeze(policyFor(ruleId, definition)),
    ])
  )
);

function validateOverride(ruleId, override) {
  const required = [
    'policy_id',
    'rule_id',
    'version',
    'source',
    'rationale',
    'effective_date',
    'confidence',
    'status',
    'value',
  ];
  const missing = required.filter((field) => override?.[field] == null);
  if (missing.length) {
    throw new TypeError(`Policy override for ${ruleId} is missing: ${missing.join(', ')}`);
  }
  for (const field of ['policy_id', 'version', 'source', 'rationale', 'status']) {
    if (typeof override[field] !== 'string' || !override[field].trim()) {
      throw new TypeError(`Policy override ${field} for ${ruleId} must be a non-empty string`);
    }
  }
  if (override.rule_id !== ruleId) {
    throw new TypeError(`Policy override rule_id must be ${ruleId}`);
  }
  if (!Number.isFinite(override.confidence)
    || override.confidence < 0
    || override.confidence > 1) {
    throw new TypeError(`Policy override confidence for ${ruleId} must be between 0 and 1`);
  }
  const effectiveDate = new Date(`${override.effective_date}T00:00:00Z`);
  if (typeof override.effective_date !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(override.effective_date)
    || Number.isNaN(effectiveDate.getTime())
    || effectiveDate.toISOString().slice(0, 10) !== override.effective_date) {
    throw new TypeError(`Policy override effective_date for ${ruleId} must be YYYY-MM-DD`);
  }
  const defaultValue = defaults[ruleId].value;
  if (typeof override.value !== typeof defaultValue
    || (typeof defaultValue === 'number' && !Number.isFinite(override.value))) {
    throw new TypeError(`Policy override value for ${ruleId} must be a finite ${typeof defaultValue}`);
  }
  return Object.freeze({ ...override });
}

export function getPatientDecisionPolicy(ruleId, overrides = {}) {
  const defaultPolicy = PATIENT_DECISION_POLICIES[ruleId];
  if (!defaultPolicy) throw new RangeError(`Unknown patient decision policy rule: ${ruleId}`);
  const override = overrides[ruleId];
  return override ? validateOverride(ruleId, override) : defaultPolicy;
}

export function getPatientDecisionPolicyBundle(ruleIds, overrides = {}) {
  const rules = [...new Set(ruleIds)].map((ruleId) => (
    getPatientDecisionPolicy(ruleId, overrides)
  ));
  const first = rules[0] || PATIENT_DECISION_POLICIES.red_flag_chest_pain_enabled;
  return {
    policy_id: first.policy_id,
    version: first.version,
    source: first.source,
    effective_date: first.effective_date,
    confidence: Math.min(...rules.map((rule) => rule.confidence)),
    status: rules.some((rule) => rule.status === POLICY_STATUS)
      ? POLICY_STATUS
      : first.status,
    rules,
  };
}
