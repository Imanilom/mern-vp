export const PATIENT_ACTIONS = {
  EMERGENCY: 'emergency',
  CONTACT_CLINICIAN: 'contact_clinician',
  OBSERVE: 'observe_and_record',
  CONTINUE: 'continue_and_learn',
  QUALITY_WARNING: 'quality_warning',
};

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
}) {
  if (redFlag) {
    return {
      level: 'red',
      action: PATIENT_ACTIONS.EMERGENCY,
      title: 'Cari pertolongan medis segera',
      message: 'Gejala yang dilaporkan dapat memerlukan penilaian segera. Hubungi layanan darurat setempat atau pergi ke IGD. Jangan menunggu hasil wearable.',
      reasons: ['reported_red_flag_symptom'],
      bypassed_sensor_scoring: true,
      algorithm_is_not_diagnosis: true,
    };
  }

  if (symptomSeverity != null && symptomSeverity >= 9) {
    return {
      level: 'red',
      action: PATIENT_ACTIONS.EMERGENCY,
      title: 'Cari pertolongan medis segera',
      message: 'Anda melaporkan gejala sangat berat. Hubungi layanan darurat setempat atau pergi ke IGD; jangan menunggu analisis wearable.',
      reasons: ['patient_reported_very_severe_symptom'],
      bypassed_sensor_scoring: true,
      algorithm_is_not_diagnosis: true,
    };
  }

  if (!dataQualityAvailable) {
    return {
      level: 'yellow',
      action: PATIENT_ACTIONS.QUALITY_WARNING,
      title: 'Data belum cukup untuk dinilai',
      message: 'Periksa pemasangan perangkat dan catat kondisi atau gejala yang dirasakan. Jangan gunakan hasil sensor ini untuk menyimpulkan kondisi kesehatan.',
      reasons: ['insufficient_quality_gated_data'],
      bypassed_sensor_scoring: false,
      algorithm_is_not_diagnosis: true,
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
  };
}

export function summarizePatientPersistence(observations, { k = 4, m = 5 } = {}) {
  const ordered = [...(Array.isArray(observations) ? observations : [])]
    .filter((item) => Number.isFinite(item.squared_distance)
      && Number.isFinite(item.thresholds?.mild)
      && Number.isFinite(new Date(item.recorded_at).getTime()))
    .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
  const flags = ordered.map(
    (item) => item.squared_distance >= item.thresholds.mild
  );
  const recentFlags = flags.slice(-m);
  const positiveCount = recentFlags.filter(Boolean).length;
  const recent = ordered.slice(-m);
  const windowContiguous = recent.length === m && recent.slice(1).every(
    (item, index) => (
      new Date(item.recorded_at).getTime()
      - new Date(recent[index].recorded_at).getTime() <= 10 * 60000
    )
  );
  const persistent = windowContiguous && positiveCount >= k;
  let onsetIndex = ordered.length - 1;
  while (
    onsetIndex > 0 &&
    flags[onsetIndex - 1] &&
    flags[onsetIndex] &&
    new Date(ordered[onsetIndex].recorded_at).getTime()
      - new Date(ordered[onsetIndex - 1].recorded_at).getTime() <= 10 * 60000
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
    if (elapsedMinutes <= 0 || elapsedMinutes > 10) continue;
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
    status: recent.length < m ? 'insufficient_data' : 'available',
    method: 'k_of_m_mahalanobis_threshold',
    k,
    m,
    maximum_window_gap_minutes: 10,
    window_contiguous: windowContiguous,
    available_windows: recent.length,
    deviating_windows: positiveCount,
    persistent,
    onset_at: onset,
    dwell_minutes: dwellMinutes,
    deviation_auc: Number(deviationAuc.toFixed(3)),
  };
}

export function summarizePatientRecovery(segments, events, now = Date.now()) {
  const ordered = [...segments]
    .filter((segment) => Number.isFinite(segment.distance)
      || Number.isFinite(segment.anomaly_score))
    .sort((a, b) => a.window_start - b.window_start);
  const recent = ordered.slice(-10);
  const first = recent[0];
  const latest = ordered[ordered.length - 1];
  const scoreKey = Number.isFinite(latest?.distance) ? 'distance' : 'anomaly_score';
  const firstScore = first?.[scoreKey];
  const latestScore = latest?.[scoreKey];
  const scoreChange = first && latest ? latestScore - firstScore : null;
  const currentScore = latestScore ?? null;
  const currentState = latest?.rr_status || latest?.classification || null;
  const wasDeviating = ordered.some((segment) => (
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
  const atPersonalBaseline = Number.isFinite(latest?.squared_distance)
    && Number.isFinite(latest?.thresholds?.mild)
    && latest.squared_distance < latest.thresholds.mild;
  const recovered = currentState === 'RECOVERED' || (wasDeviating && atPersonalBaseline);
  const recovering = !recovered && (
    currentState === 'RECOVERING'
    || (wasDeviating && scoreChange != null && scoreChange < -0.1)
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
      observation.window_start - ordered[index - 1].window_start > 10 * 60000
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
      && eventTime >= now - 24 * 60 * 60 * 1000
      && eventTime <= now
    );
  });
  const relapse = eventRelapse || trajectoryRelapse;
  const peakDistance = ordered.reduce(
    (peak, item) => Math.max(peak, Number.isFinite(item.distance) ? item.distance : 0),
    0
  );
  const recoveryProgress = peakDistance > 0 && Number.isFinite(latest?.distance)
    ? Math.max(0, Math.min(1, 1 - latest.distance / peakDistance))
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
      : scoreChange < -0.1
        ? 'decreasing'
        : scoreChange > 0.1
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
  };
}

export function identifyPatientRedFlags(checkIn) {
  const symptoms = Array.isArray(checkIn?.symptoms) ? checkIn.symptoms : [];
  const severity = Number.isFinite(checkIn?.symptom_severity)
    ? checkIn.symptom_severity
    : null;
  const redFlags = [];
  if (symptoms.includes('chest_pain')) redFlags.push('chest_pain_reported');
  if (symptoms.includes('breathlessness') && severity != null && severity >= 7) {
    redFlags.push('severe_breathlessness_reported');
  }
  if (severity != null && severity >= 9) redFlags.push('very_severe_symptom_reported');
  return { red_flag: redFlags.length > 0, reasons: [...new Set(redFlags)] };
}
