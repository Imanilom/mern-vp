const PATIENT_PEDAGOGY_SECTIONS = [
  'where_am_i',
  'what_changed',
  'why',
  'how_long',
  'recovery',
  'action',
];

export function buildPatientReasoningPipeline({
  recentSegments = [],
  acceptedSegments = [],
  latestSegment = null,
  latestMahalanobis = null,
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
  evidenceConflicts = [],
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
    processing_model: 'rule_and_statistical_mvp',
    probabilistic_posterior: {
      notation: 'P(X_t | T(t))',
      status: 'not_calibrated',
      distribution: null,
      reason: 'No validated and calibrated individual-level probabilistic model is configured; no probability is inferred from feature contribution shares.',
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
    ],
  };
}
