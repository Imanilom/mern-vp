const PATIENT_PEDAGOGY_SECTIONS = [
  'where_am_i',
  'what_changed',
  'why',
  'how_long',
  'recovery',
  'action',
];

export function buildPatientReasoningResolution({
  followUpStatus = 'not_required',
  feedbackCheckIn = null,
  explanationStatus = 'insufficient_data',
  qualityGatePassed = false,
  baselineMature = false,
  conflicts = [],
} = {}) {
  if (followUpStatus === 'requested') {
    return {
      status: 'awaiting_clarification',
      reason: 'patient_context_requested',
      feedback_recorded: false,
      reinterpreted: false,
      next_step: 'collect_patient_context',
      interpretation: 'Klarifikasi diperlukan sebelum konteks event ditinjau kembali.',
    };
  }

  const followUp = feedbackCheckIn?.deviation_follow_up || {};
  const measurementCondition = followUp.measurement_condition || null;
  const hasRelevantContext = Boolean(
    (followUp.activity_before_event && followUp.activity_before_event !== 'unknown')
    || (followUp.strenuous_activity && followUp.strenuous_activity !== 'uncertain')
    || (followUp.mental_activity && followUp.mental_activity !== 'unknown')
    || (followUp.measurement_condition && followUp.measurement_condition !== 'unknown')
    || feedbackCheckIn?.activity
    || feedbackCheckIn?.symptoms?.length
    || followUp.perceived_factors?.some((factor) => ![
      'no_known_factor',
      'prefer_not_to_say',
    ].includes(factor))
  );
  const reasons = [];
  if (!feedbackCheckIn) reasons.push('patient_context_not_recorded');
  if (!hasRelevantContext) reasons.push('no_relevant_new_context');
  if (!qualityGatePassed) reasons.push('sensor_quality_gate_not_passed');
  if (!baselineMature) reasons.push('matching_baseline_not_mature');
  if (explanationStatus !== 'available') reasons.push('physiological_evidence_insufficient');
  if (measurementCondition !== 'worn_as_usual') {
    reasons.push(measurementCondition
      ? 'measurement_condition_requires_review'
      : 'measurement_condition_not_recorded');
  }
  if (conflicts.length) reasons.push('evidence_conflict_remains');

  const canReinterpret = Boolean(
    feedbackCheckIn
    && hasRelevantContext
    && qualityGatePassed
    && baselineMature
    && explanationStatus === 'available'
    && measurementCondition === 'worn_as_usual'
    && conflicts.length === 0
  );
  if (canReinterpret) {
    return {
      status: 'reinterpreted_with_limits',
      reason: 'relevant_context_and_quality_gated_evidence_available',
      feedback_recorded: true,
      reinterpreted: true,
      next_step: 'observe_next_comparable_window',
      interpretation: 'Konteks baru yang relevan telah dipertimbangkan bersama sinyal dan baseline yang memadai. Ini memperbarui konteks interpretasi, bukan menetapkan penyebab.',
    };
  }

  if (
    !feedbackCheckIn
    && followUpStatus === 'not_required'
    && qualityGatePassed
    && baselineMature
    && explanationStatus === 'available'
    && conflicts.length === 0
  ) {
    return {
      status: 'not_required',
      reason: 'no_unresolved_context_mismatch',
      feedback_recorded: false,
      reinterpreted: false,
      next_step: 'continue_observation',
      interpretation: 'Belum ada klarifikasi yang diperlukan untuk observasi ini.',
    };
  }

  return {
    status: 'unresolved',
    reason: reasons[0] || 'evidence_remains_insufficient',
    reasons,
    evidence_status: conflicts.length
      ? 'conflicting_evidence'
      : !qualityGatePassed || !baselineMature || explanationStatus !== 'available'
        ? 'insufficient_evidence'
        : 'limited_evidence',
    feedback_recorded: Boolean(feedbackCheckIn),
    reinterpreted: false,
    next_step: 'observe_next_quality_gated_window',
    interpretation: 'Bukti belum cukup atau masih bertentangan untuk memperbarui interpretasi. Status tetap unresolved; sistem tidak memilih satu penjelasan dan menunggu observasi lanjutan yang sebanding.',
  };
}

export function buildPatientReasoningPipeline({
  recentSegments = [],
  acceptedSegments = [],
  latestSegment = null,
  latestMahalanobis = null,
  bayesianModel = null,
  matchingBaseline = null,
  polarData = [],
  checkIns = [],
  patientEvents = [],
  behaviorEvents = [],
  persistence = null,
  recovery = null,
  episodeHistory = [],
  decision = null,
  followUp = null,
  feedbackCheckIn = null,
  resolution = null,
  evidenceConflicts = [],
  profileContext = {},
} = {}) {
  const features = latestSegment?.features || {};
  const availableFeatures = Object.keys(features).filter(
    (key) => Number.isFinite(features[key])
  );
  const latestCheckIn = checkIns[0] || null;
  const symptomCount = Array.isArray(latestCheckIn?.symptoms)
    ? latestCheckIn.symptoms.length
    : 0;
  const checkInContextCount = [
    latestCheckIn?.activity,
    latestCheckIn?.stress_level,
    latestCheckIn?.sleep?.duration_minutes,
    latestCheckIn?.sleep?.quality,
    latestCheckIn?.lifestyle,
    latestCheckIn?.lifestyle?.meal_count,
    latestCheckIn?.deviation_follow_up?.perceived_factors,
    latestCheckIn?.deviation_follow_up?.meal_count,
    latestCheckIn?.deviation_follow_up?.location,
  ].filter((value) => value != null).length;
  const sources = {
    wearable: {
      available: Boolean(latestSegment),
      record_count: acceptedSegments.length,
      latest_quality_gated_window_at: latestSegment
        ? new Date(latestSegment.window_start)
        : null,
    },
    symptoms: {
      available: symptomCount > 0,
      record_count: symptomCount,
      recorded_at: latestCheckIn?.recorded_at ?? null,
    },
    patient_context: {
      available: checkIns.length > 0 || patientEvents.length > 0 || behaviorEvents.length > 0,
      check_in_count: checkIns.length,
      event_count: patientEvents.length,
      behavior_event_count: behaviorEvents.length,
      recorded_context_count: checkInContextCount,
    },
    clinical_records: {
      available: false,
      status: 'not_integrated',
    },
  };
  const availableSourceCount = Object.values(sources).filter(
    (source) => source.available
  ).length;
  const stateAvailable = Boolean(latestMahalanobis?.available);
  const pedagogyAvailable = Boolean(decision);
  const feedbackAvailable = Boolean(feedbackCheckIn);
  const actionTaken = feedbackCheckIn?.deviation_follow_up?.action_taken?.trim() || '';
  const responseAfterAction =
    feedbackCheckIn?.deviation_follow_up?.response_after_action?.trim() || '';

  return {
    architecture_version: '1.0.0',
    processing_model: 'rule_statistical_with_bayesian_candidate',
    probabilistic_posterior: {
      notation: 'P(CAPAR deviation | physiological features, personal activity/time baseline)',
      method: bayesianModel?.method || 'personal_gaussian_naive_bayes',
      status: bayesianModel?.status || 'insufficient_data',
      distribution: null,
      reason: bayesianModel?.reason
        || 'Insufficient quality-gated, activity/time-matched CAPAR labels to fit a Bayesian candidate model.',
      feature_keys: bayesianModel?.feature_keys || [],
      prior: bayesianModel?.prior || null,
      likelihood: bayesianModel?.likelihood || null,
      training_samples: bayesianModel?.training_samples || { stable: 0, deviation: 0 },
      validation_samples: bayesianModel?.validation_samples || { stable: 0, deviation: 0 },
      validation: bayesianModel?.validation || null,
      interpretation_context: {
        goal: profileContext.goal || null,
        monitoring_priority: profileContext.monitoring_priority || null,
        personal_factor_ranking: profileContext.personal_factor_ranking || [],
        used_in_posterior: false,
      },
      individual_probability_exposed: false,
      validation_gate: 'External calibration and governance approval are required before any probability is shown.',
    },
    stages: [
      {
        stage_id: 'sensing',
        status: latestSegment
          ? 'available'
          : polarData.length || checkIns.length || patientEvents.length || behaviorEvents.length
            ? 'historical_only'
            : 'insufficient_data',
        sensor_records: polarData.length,
        accepted_feature_windows: acceptedSegments.length,
        symptom_records: symptomCount,
        context_check_ins: checkIns.length,
        patient_events: patientEvents.length,
        behavior_events: behaviorEvents.length,
      },
      {
        stage_id: 'quality_gate',
        status: latestSegment ? 'passed' : 'insufficient_data',
        accepted_windows: acceptedSegments.length,
        rejected_windows: Math.max(0, recentSegments.length - acceptedSegments.length),
        quality: latestSegment?.signal_quality_detail?.q_signal ?? null,
      },
      {
        stage_id: 'feature_engine',
        status: availableFeatures.length ? 'available' : 'insufficient_data',
        feature_count: availableFeatures.length,
        available_features: availableFeatures,
      },
      {
        stage_id: 'personal_baseline',
        status: matchingBaseline
          ? 'mature'
          : 'insufficient_data',
        activity: matchingBaseline?.activity ?? latestSegment?.activity_label ?? null,
        time_period: matchingBaseline?.time_period ?? null,
        segment_count: matchingBaseline?.segment_count ?? 0,
        maturity_level: matchingBaseline?.maturity_detail?.level
          ?? (matchingBaseline ? 'mature_legacy' : 'unavailable'),
      },
      {
        stage_id: 'evidence_fusion',
        status: evidenceConflicts.length
          ? 'conflicting_evidence'
          : availableSourceCount > 1
            ? 'available_with_limits'
            : availableSourceCount === 1
              ? 'single_source'
              : 'insufficient_data',
        available_source_count: availableSourceCount,
        sources,
        conflicts: evidenceConflicts,
        causality_established: false,
      },
      {
        stage_id: 'latent_state_estimation',
        status: stateAvailable ? 'available' : 'insufficient_data',
        state: stateAvailable ? latestMahalanobis.state : null,
        method: stateAvailable
          ? 'quality_gated_wearable_personal_baseline_comparison'
          : null,
        input_sources: stateAvailable ? ['quality_gated_wearable'] : [],
        patient_context_used_in_state_estimate: false,
        distance: stateAvailable ? latestMahalanobis.distance : null,
        posterior_probability: null,
        probabilistic_model_status: bayesianModel?.status || 'insufficient_data',
        thresholds_are_clinical: false,
      },
      {
        stage_id: 'temporal_reasoning',
        status: acceptedSegments.length ? 'available' : 'insufficient_data',
        evaluated_windows: acceptedSegments.length,
        persistent: persistence?.persistent ?? null,
        episode_count: episodeHistory.length,
        latest_episode: recovery?.latest_episode ?? null,
      },
      {
        stage_id: 'resilience',
        status: recovery?.status ?? 'insufficient_data',
        recovery_progress_pct: recovery?.recovery_progress ?? null,
        time_to_recovery_minutes: recovery?.time_to_recovery_minutes ?? null,
        relapse_detected: recovery?.relapse_detected ?? false,
      },
      {
        stage_id: 'decision_policy',
        status: decision ? 'available' : 'insufficient_data',
        action_level: decision?.level ?? null,
        action: decision?.action ?? null,
        policy_status: decision?.policy?.status ?? null,
      },
      {
        stage_id: 'patient_pedagogy',
        status: pedagogyAvailable ? 'available' : 'insufficient_data',
        sections: PATIENT_PEDAGOGY_SECTIONS,
      },
      {
        stage_id: 'feedback',
        status: feedbackAvailable
          ? 'patient_feedback_recorded'
          : followUp?.status === 'requested'
            ? 'awaiting_patient_context'
            : 'no_feedback_recorded',
        follow_up_status: followUp?.status ?? 'not_available',
        patient_context_recorded: feedbackAvailable,
        patient_reported_action_recorded: Boolean(actionTaken),
        patient_reported_response_recorded: Boolean(responseAfterAction),
        intervention_response_status: actionTaken && responseAfterAction
          ? 'self_report_recorded'
          : actionTaken || responseAfterAction
            ? 'partially_recorded'
            : 'not_collected',
        interpretation_limit: 'Patient-reported action and response are descriptive context, not evidence of treatment effect or causality.',
      },
      {
        stage_id: 'resolution',
        status: resolution?.status ?? 'unresolved',
        reason: resolution?.reason ?? 'resolution_not_available',
        evidence_status: resolution?.evidence_status ?? null,
        feedback_recorded: resolution?.feedback_recorded ?? feedbackAvailable,
        reinterpreted: resolution?.reinterpreted ?? false,
        next_step: resolution?.next_step ?? 'observe_next_quality_gated_window',
        interpretation: resolution?.interpretation
          ?? 'Status resolusi belum tersedia; jangan menyimpulkan penyebab.',
      },
    ],
  };
}
