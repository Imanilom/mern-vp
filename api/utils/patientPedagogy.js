import {
  getPatientDecisionPolicy,
  getPatientDecisionPolicyBundle,
} from '../config/patientDecisionPolicies.js';

export const PATIENT_ACTIONS = {
  EMERGENCY: 'emergency',
  CONTACT_CLINICIAN: 'contact_clinician',
  OBSERVE: 'observe_and_record',
  CONTINUE: 'continue_and_learn',
  QUALITY_WARNING: 'quality_warning',
};

export function buildPatientDeviationFollowUpPrompt({
  deviation,
  segmentId = null,
  alreadyAnswered = false,
  episode = null,
} = {}) {
  if (!deviation?.available || deviation.state === 'within_personal_region') {
    return { status: 'not_required' };
  }

  const highDeviation = deviation.state === 'strongly_displaced';
  if (alreadyAnswered) {
    return {
      status: 'already_answered',
      triggered_by_segment_id: segmentId,
      deviation_level: highDeviation ? 'high' : 'moderate',
      onset_time: episode?.onset_time ?? null,
      peak_time: episode?.peak_time ?? deviation.recorded_at ?? null,
      deviation_distance: deviation.distance ?? null,
      reference_thresholds: deviation.thresholds ?? null,
      main_factors: deviation.features ?? [],
    };
  }

  const questions = [
    {
      id: 'current_symptoms',
      question: 'Apa yang Anda rasakan sekarang?',
      response_field: 'symptoms',
      input_type: 'multi_select',
      allow_empty: true,
      options: [
        'fatigue',
        'dizziness',
        'palpitations',
        'breathlessness',
        'chest_pain',
        'headache',
        'pain',
        'nausea',
        'weakness',
        'fever',
      ],
    },
    {
      id: 'recent_context',
      question: 'Apa yang sedang atau baru saja Anda lakukan?',
      response_field: 'activity',
      input_type: 'single_select',
      options: ['rest', 'sitting', 'standing', 'walking', 'running', 'exercise', 'work', 'meal', 'other'],
    },
    {
      id: 'possible_factors',
      question: highDeviation
        ? 'Dari waktu onset sampai puncak deviasi, konteks apa yang berubah dan mungkin berkaitan?'
        : 'Konteks apa yang berubah di sekitar deviasi dan ingin Anda catat?',
      response_field: 'deviation_follow_up.perceived_factors',
      input_type: 'multi_select',
      options: [
        'physical_activity',
        'stress',
        'poor_sleep',
        'medication',
        'food_or_caffeine',
        'illness',
        'pain',
        'other',
        'no_known_factor',
        'prefer_not_to_say',
      ],
      optional: false,
    },
    {
      id: 'meal_count',
      question: 'Berapa kali Anda makan hari ini?',
      response_field: 'deviation_follow_up.meal_count',
      input_type: 'number',
      minimum: 0,
      maximum: 20,
      optional: false,
    },
  ];

  if (highDeviation) {
    questions.push(
      {
        id: 'symptom_timing',
        question: 'Kapan gejala mulai dirasakan dibandingkan perubahan yang terdeteksi?',
        response_field: 'deviation_follow_up.symptom_onset',
        input_type: 'single_select',
        options: ['before_deviation', 'around_deviation', 'after_deviation', 'unknown'],
        optional: true,
      },
      {
        id: 'additional_context',
        question: 'Adakah hal lain yang ingin Anda ceritakan?',
        response_field: 'deviation_follow_up.note',
        input_type: 'text',
        optional: true,
      }
    );
  }

  return {
    status: 'requested',
    trigger: highDeviation ? 'high_personal_deviation' : 'personal_deviation',
    triggered_by_segment_id: segmentId,
    deviation_level: highDeviation ? 'high' : 'moderate',
    deviation_state: deviation.state,
    onset_time: episode?.onset_time ?? null,
    peak_time: episode?.peak_time ?? deviation.recorded_at ?? null,
    deviation_distance: deviation.distance ?? null,
    reference_thresholds: deviation.thresholds ?? null,
    main_factors: deviation.features ?? [],
    questions,
    response_endpoint: 'POST /api/patient-app/check-ins',
    response_field: 'deviation_follow_up',
    safety_notice: 'Jawaban membantu mencatat konteks dan tidak membuktikan penyebab deviasi. Gejala berat atau tanda bahaya harus ditangani tanpa menunggu analisis.',
  };
}

const PATIENT_ACTION_RULES = [
  'red_flag_chest_pain_enabled',
  'red_flag_breathlessness_severity_min',
  'red_flag_symptom_severity_min',
  'patient_prolonged_dwell_minutes',
  'patient_active_episode_minutes',
];

export function recommendPatientAction({
  dataQualityAvailable,
  redFlag = false,
  symptomsPresent = false,
  symptomSeverity = null,
  deviationPresent = false,
  persistentDeviation = false,
  prolongedDeviation = false,
  recovering = false,
  relapse = false,
  policyOverrides = {},
}) {
  const policy = getPatientDecisionPolicyBundle(PATIENT_ACTION_RULES, policyOverrides);
  if (redFlag) {
    return {
      level: 'red',
      action: PATIENT_ACTIONS.EMERGENCY,
      title: 'Cari pertolongan medis segera',
      message: 'Gejala yang dilaporkan dapat memerlukan penilaian segera. Hubungi layanan darurat setempat atau pergi ke IGD. Jangan menunggu hasil wearable.',
      reasons: ['reported_red_flag_symptom'],
      bypassed_sensor_scoring: true,
      algorithm_is_not_diagnosis: true,
      policy,
    };
  }

  if (
    symptomSeverity != null
    && symptomSeverity >= getPatientDecisionPolicy(
      'red_flag_symptom_severity_min',
      policyOverrides
    ).value
  ) {
    return {
      level: 'red',
      action: PATIENT_ACTIONS.EMERGENCY,
      title: 'Cari pertolongan medis segera',
      message: 'Anda melaporkan gejala sangat berat. Hubungi layanan darurat setempat atau pergi ke IGD; jangan menunggu analisis wearable.',
      reasons: ['patient_reported_very_severe_symptom'],
      bypassed_sensor_scoring: true,
      algorithm_is_not_diagnosis: true,
      policy,
    };
  }

  if (!dataQualityAvailable) {
    return {
      level: 'unknown',
      action: PATIENT_ACTIONS.QUALITY_WARNING,
      title: 'Data belum cukup untuk dinilai',
      message: 'Periksa pemasangan perangkat dan catat kondisi atau gejala yang dirasakan. Jangan gunakan hasil sensor ini untuk menyimpulkan kondisi kesehatan.',
      reasons: ['insufficient_quality_gated_data'],
      bypassed_sensor_scoring: false,
      algorithm_is_not_diagnosis: true,
      policy,
    };
  }

  if (persistentDeviation && symptomsPresent) {
    return {
      level: 'orange',
      action: PATIENT_ACTIONS.CONTACT_CLINICIAN,
      title: 'Hubungi tenaga kesehatan',
      message: 'Perubahan yang menetap bersama gejala sebaiknya dibahas dengan tenaga kesehatan. Jika gejala memburuk atau muncul tanda bahaya, cari pertolongan darurat.',
      reasons: [
        'persistent_deviation',
        'reported_symptoms',
      ],
      bypassed_sensor_scoring: false,
      algorithm_is_not_diagnosis: true,
      policy,
    };
  }

  if (
    relapse ||
    deviationPresent ||
    (persistentDeviation && (!recovering || prolongedDeviation)) ||
    symptomsPresent ||
    recovering
  ) {
    return {
      level: 'yellow',
      action: PATIENT_ACTIONS.OBSERVE,
      title: 'Amati perubahan dan catat kondisi',
      message: 'Pantau tren dan gejala, lalu lakukan pengukuran ulang sesuai kebutuhan. Hubungi tenaga kesehatan bila perubahan menetap atau memburuk.',
      reasons: [
        ...(persistentDeviation ? ['persistent_deviation'] : []),
        ...(deviationPresent ? ['current_personal_deviation'] : []),
        ...(symptomsPresent ? ['reported_symptoms'] : []),
        ...(recovering ? ['recovery_in_progress'] : []),
        ...(relapse ? ['deviation_relapse'] : []),
        ...(prolongedDeviation ? ['prolonged_deviation'] : []),
      ],
      bypassed_sensor_scoring: false,
      algorithm_is_not_diagnosis: true,
      policy,
    };
  }

  return {
    level: 'green',
    action: PATIENT_ACTIONS.CONTINUE,
    title: 'Lanjutkan pemantauan',
    message: 'Data yang tersedia tidak menunjukkan deviasi menetap. Lanjutkan aktivitas sesuai kenyamanan dan catat perubahan atau gejala baru.',
    reasons: ['no_current_persistent_deviation_or_reported_symptoms'],
    bypassed_sensor_scoring: false,
    algorithm_is_not_diagnosis: true,
    policy,
  };
}

export function summarizePatientPersistence(observations, { policyOverrides = {} } = {}) {
  const positiveWindows = getPatientDecisionPolicy(
    'patient_persistence_positive_windows',
    policyOverrides
  ).value;
  const windowCount = getPatientDecisionPolicy(
    'patient_persistence_window_count',
    policyOverrides
  ).value;
  const maximumGapMinutes = getPatientDecisionPolicy(
    'patient_maximum_window_gap_minutes',
    policyOverrides
  ).value;
  const ordered = [...(Array.isArray(observations) ? observations : [])]
    .filter((item) => Number.isFinite(item.squared_distance)
      && Number.isFinite(item.thresholds?.mild)
      && Number.isFinite(new Date(item.recorded_at).getTime()))
    .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
  const flags = ordered.map(
    (item) => item.squared_distance >= item.thresholds.mild
  );
  const recentFlags = flags.slice(-windowCount);
  const positiveCount = recentFlags.filter(Boolean).length;
  const recent = ordered.slice(-windowCount);
  const windowContiguous = recent.length === windowCount && recent.slice(1).every(
    (item, index) => (
      new Date(item.recorded_at).getTime()
      - new Date(recent[index].recorded_at).getTime() <= maximumGapMinutes * 60000
    )
  );
  const persistent = windowContiguous && positiveCount >= positiveWindows;
  let onsetIndex = ordered.length - 1;
  while (
    onsetIndex > 0 &&
    flags[onsetIndex - 1] &&
    flags[onsetIndex] &&
    new Date(ordered[onsetIndex].recorded_at).getTime()
      - new Date(ordered[onsetIndex - 1].recorded_at).getTime() <= maximumGapMinutes * 60000
  ) {
    onsetIndex -= 1;
  }
  const onset = ordered.length && flags[flags.length - 1]
    ? new Date(ordered[onsetIndex].recorded_at)
    : null;
  const latest = ordered[ordered.length - 1] || null;
  const dwellMinutes = onset && latest
    ? Math.max(
      0,
      Number(
        ((new Date(latest.recorded_at).getTime() - onset.getTime()) / 60000).toFixed(1)
      )
    )
    : 0;
  let deviationAuc = 0;
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    const previousTime = new Date(previous.recorded_at).getTime();
    const currentTime = new Date(current.recorded_at).getTime();
    const elapsedMinutes = (currentTime - previousTime) / 60000;
    if (elapsedMinutes <= 0 || elapsedMinutes > maximumGapMinutes) continue;
    const previousDistance = Math.max(
      0,
      previous.distance - Math.sqrt(previous.thresholds.mild)
    );
    const currentDistance = Math.max(
      0,
      current.distance - Math.sqrt(current.thresholds.mild)
    );
    deviationAuc += ((previousDistance + currentDistance) / 2) * elapsedMinutes;
  }

  return {
    status: recent.length < windowCount ? 'insufficient_data' : 'available',
    method: 'k_of_m_mahalanobis_threshold',
    k: positiveWindows,
    m: windowCount,
    maximum_window_gap_minutes: maximumGapMinutes,
    window_contiguous: windowContiguous,
    available_windows: recent.length,
    deviating_windows: positiveCount,
    persistent,
    onset_at: onset,
    dwell_minutes: dwellMinutes,
    deviation_auc: Number(deviationAuc.toFixed(3)),
    policy: getPatientDecisionPolicyBundle([
      'patient_persistence_positive_windows',
      'patient_persistence_window_count',
      'patient_maximum_window_gap_minutes',
    ], policyOverrides),
  };
}

export function summarizePatientEpisodeOutcomes(episodes) {
  const outcomes = episodes.filter(
    (episode) => episode.outcome === 'recovered' || episode.outcome === 'unresolved'
  );
  const recovered = outcomes.filter((episode) => episode.outcome === 'recovered').length;
  const unresolved = outcomes.length - recovered;
  return {
    recovered,
    unresolved,
    denominator: outcomes.length,
    recovery_rate_pct: outcomes.length
      ? Number((recovered / outcomes.length * 100).toFixed(1))
      : null,
  };
}

export function summarizePatientRecovery(
  segments,
  events,
  now = Date.now(),
  { policyOverrides = {} } = {}
) {
  const recentWindowCount = getPatientDecisionPolicy(
    'patient_recovery_recent_window_count',
    policyOverrides
  ).value;
  const maximumGapMinutes = getPatientDecisionPolicy(
    'patient_maximum_window_gap_minutes',
    policyOverrides
  ).value;
  const recoveryScoreSlope = getPatientDecisionPolicy(
    'patient_recovery_score_slope',
    policyOverrides
  ).value;
  const scoreChangeStabilityEpsilon = getPatientDecisionPolicy(
    'patient_score_change_stability_epsilon',
    policyOverrides
  ).value;
  const relapseLookbackHours = getPatientDecisionPolicy(
    'patient_relapse_lookback_hours',
    policyOverrides
  ).value;
  const ordered = [...segments]
    .filter((segment) => Number.isFinite(segment.distance)
      || Number.isFinite(segment.anomaly_score))
    .sort((a, b) => a.window_start - b.window_start);
  const recent = ordered.slice(-recentWindowCount);
  const first = recent[0];
  const latest = ordered[ordered.length - 1];
  const scoreKey = Number.isFinite(latest?.distance) ? 'distance' : 'anomaly_score';
  const firstScore = first?.[scoreKey];
  const latestScore = latest?.[scoreKey];
  const scoreChange = first && latest ? latestScore - firstScore : null;
  const currentScore = latestScore ?? null;
  const currentState = latest?.rr_status || latest?.classification || null;
  const deviationFlags = ordered.map((segment) => (
    (Number.isFinite(segment.squared_distance)
      && Number.isFinite(segment.thresholds?.mild)
      && segment.squared_distance >= segment.thresholds.mild)
    || [
      'DEVIATION_CANDIDATE',
      'PERSISTENT_DEVIATION',
      'Caution',
      'Alert',
    ].includes(segment.rr_status || segment.classification)
  ));
  const lastDeviationIndex = deviationFlags.lastIndexOf(true);
  const wasDeviating = lastDeviationIndex >= 0;
  const contiguousSinceDeviation = wasDeviating
    && ordered.slice(lastDeviationIndex + 1).every((segment, index, tail) => {
      const previous = ordered[lastDeviationIndex + index];
      return segment.window_start - previous.window_start <= maximumGapMinutes * 60000;
    });
  const atPersonalBaseline = Number.isFinite(latest?.squared_distance)
    && Number.isFinite(latest?.thresholds?.mild)
    && latest.squared_distance < latest.thresholds.mild;
  const recovered = currentState === 'RECOVERED'
    || (wasDeviating && contiguousSinceDeviation && atPersonalBaseline);
  const recovering = !recovered && (
    currentState === 'RECOVERING'
    || (wasDeviating && contiguousSinceDeviation && scoreChange != null && scoreChange < recoveryScoreSlope)
  );
  const activeEvent = events.find((event) => ['open', 'paused'].includes(event.status));
  const latestEvent = events[0] || null;
  const onset = activeEvent?.onset_time || activeEvent?.started_at;
  const elapsedMinutes = activeEvent && Number.isFinite(onset)
    ? Math.max(0, Math.round((now - onset) / 60000))
    : null;
  const dwellMinutes = activeEvent?.persistent_at && Number.isFinite(onset)
    ? Math.max(0, Math.round((activeEvent.persistent_at - onset) / 60000))
    : null;
  let deviationRunActive = false;
  let recoveredFromDeviation = false;
  let trajectoryRelapse = false;
  for (let index = 0; index < ordered.length; index += 1) {
    const observation = ordered[index];
    if (
      index > 0 &&
      observation.window_start - ordered[index - 1].window_start > maximumGapMinutes * 60000
    ) {
      deviationRunActive = false;
      recoveredFromDeviation = false;
    }
    const isDeviation = Number.isFinite(observation.squared_distance)
      && Number.isFinite(observation.thresholds?.mild)
      && observation.squared_distance >= observation.thresholds.mild;
    if (isDeviation) {
      if (recoveredFromDeviation) trajectoryRelapse = true;
      deviationRunActive = true;
      recoveredFromDeviation = false;
    } else if (deviationRunActive) {
      deviationRunActive = false;
      recoveredFromDeviation = true;
    }
  }
  const eventRelapse = events.some((event) => {
    const eventTime = event.onset_time || event.started_at;
    return (
      (event.relapse === true || event.relapse_count > 0)
      && Number.isFinite(eventTime)
      && eventTime >= now - relapseLookbackHours * 60 * 60 * 1000
      && eventTime <= now
    );
  });
  const relapse = eventRelapse || trajectoryRelapse;
  let episodeStartIndex = lastDeviationIndex;
  while (episodeStartIndex > 0) {
    const previous = ordered[episodeStartIndex - 1];
    const current = ordered[episodeStartIndex];
    const previousState = previous.rr_status || previous.classification;
    if (
      current.window_start - previous.window_start > maximumGapMinutes * 60000
      || (!deviationFlags[episodeStartIndex - 1]
        && !['RECOVERING', 'RECOVERY', 'PERSISTENT_DEVIATION', 'DEVIATION_CANDIDATE'].includes(previousState))
    ) break;
    episodeStartIndex -= 1;
  }
  const episodePeakDistance = wasDeviating
    ? ordered.slice(episodeStartIndex).reduce(
      (peak, item) => Math.max(peak, Number.isFinite(item.distance) ? item.distance : 0),
      0
    )
    : 0;
  const recoveryProgress = episodePeakDistance > 0
    && (recovering || recovered)
    && Number.isFinite(latest?.distance)
    ? Math.max(0, Math.min(1, 1 - latest.distance / episodePeakDistance))
    : null;
  const elapsedFromPeak = latestEvent?.peak_time && Number.isFinite(latestEvent.peak_time)
    ? Math.max(0, Number(((now - latestEvent.peak_time) / 60000).toFixed(1)))
    : null;

  return {
    status: !latest
      ? 'insufficient_data'
      : recovered
        ? 'recovered'
        : recovering
        ? 'recovering'
        : currentState === 'PERSISTENT_DEVIATION'
          ? 'persistent_deviation'
          : currentState === 'DEVIATION_CANDIDATE'
            ? 'deviation_candidate'
            : 'baseline_compatible',
    current_state: currentState,
    current_score: currentScore,
    score_change_recent: scoreChange,
    distance_derivative_per_minute: first && latest && latest.window_start > first.window_start
      ? Number((scoreChange / ((latest.window_start - first.window_start) / 60000)).toFixed(4))
      : null,
    recovery_progress: recoveryProgress == null
      ? null
      : Number((recoveryProgress * 100).toFixed(1)),
    time_to_recovery_minutes: latestEvent?.trajectory?.recovery_time_ms
      ? Number((latestEvent.trajectory.recovery_time_ms / 60000).toFixed(1))
      : null,
    time_since_peak_minutes: elapsedFromPeak,
    score_trend: scoreChange == null
      ? 'insufficient_data'
      : scoreChange < -scoreChangeStabilityEpsilon
        ? 'decreasing'
        : scoreChange > scoreChangeStabilityEpsilon
          ? 'increasing'
          : 'stable',
    recovering,
    relapse_detected: relapse,
    relapse_source: eventRelapse && trajectoryRelapse
      ? 'capar_event_and_distance_trajectory'
      : eventRelapse
        ? 'capar_event'
        : trajectoryRelapse
          ? 'distance_trajectory'
          : null,
    latest_episode: latestEvent
      ? {
        status: latestEvent.status,
        onset_at: Number.isFinite(latestEvent.onset_time)
          ? new Date(latestEvent.onset_time)
          : null,
        persistent_at: Number.isFinite(latestEvent.persistent_at)
          ? new Date(latestEvent.persistent_at)
          : null,
        peak_at: Number.isFinite(latestEvent.peak_time)
          ? new Date(latestEvent.peak_time)
          : null,
        elapsed_minutes: elapsedMinutes,
        persistent_dwell_minutes: dwellMinutes,
        duration_minutes: Number.isFinite(latestEvent.duration_ms)
          ? Number((latestEvent.duration_ms / 60000).toFixed(1))
          : elapsedMinutes,
        window_count: latestEvent.window_count || 0,
        relapse_count: latestEvent.relapse_count || 0,
        time_to_recovery_minutes: Number.isFinite(latestEvent.trajectory?.recovery_time_ms)
          ? Number((latestEvent.trajectory.recovery_time_ms / 60000).toFixed(1))
          : null,
      }
      : null,
    policy: getPatientDecisionPolicyBundle([
      'patient_recovery_recent_window_count',
      'patient_maximum_window_gap_minutes',
      'patient_recovery_score_slope',
      'patient_score_change_stability_epsilon',
      'patient_relapse_lookback_hours',
    ], policyOverrides),
  };
}

export function identifyPatientRedFlags(checkIn, { policyOverrides = {} } = {}) {
  const chestPainEnabled = getPatientDecisionPolicy(
    'red_flag_chest_pain_enabled',
    policyOverrides
  ).value;
  const breathlessnessSeverityMin = getPatientDecisionPolicy(
    'red_flag_breathlessness_severity_min',
    policyOverrides
  ).value;
  const symptomSeverityMin = getPatientDecisionPolicy(
    'red_flag_symptom_severity_min',
    policyOverrides
  ).value;
  const symptoms = Array.isArray(checkIn?.symptoms) ? checkIn.symptoms : [];
  const severity = Number.isFinite(checkIn?.symptom_severity)
    ? checkIn.symptom_severity
    : null;
  const redFlags = [];
  if (chestPainEnabled && symptoms.includes('chest_pain')) redFlags.push('chest_pain_reported');
  if (
    symptoms.includes('breathlessness')
    && severity != null
    && severity >= breathlessnessSeverityMin
  ) {
    redFlags.push('severe_breathlessness_reported');
  }
  if (severity != null && severity >= symptomSeverityMin) {
    redFlags.push('very_severe_symptom_reported');
  }
  return {
    red_flag: redFlags.length > 0,
    reasons: [...new Set(redFlags)],
    policy: getPatientDecisionPolicyBundle([
      'red_flag_chest_pain_enabled',
      'red_flag_breathlessness_severity_min',
      'red_flag_symptom_severity_min',
    ], policyOverrides),
  };
}
