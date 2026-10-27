import { errorHandler } from './error.js';

const profileFields = new Set([
  'date_of_birth',
  'timezone',
  'sex',
  'height_cm',
  'weight_kg',
  'blood_type',
  'emergency_contact_name',
  'emergency_contact_phone',
  'conditions',
  'allergies',
  'allergies_reviewed',
  'special_conditions',
  'clinical_note',
  'medications',
  'medication_reviewed',
  'data_sharing',
  'goal',
  'monitoring_priority',
  'ai_processing_consent',
  'notification_preferences',
  'wearable_provider',
  'personal_factor_ranking',
]);
const personalFactorTypes = new Set([
  'mood',
  'meal',
  'stress',
  'physical_activity',
  'sleep',
  'other',
]);

const checkInFields = new Set([
  'recorded_at',
  'feeling',
  'activity',
  'posture',
  'sleep',
  'symptoms',
  'symptom_severity',
  'deviation_follow_up',
  'stress_level',
  'hydration_ml',
  'lifestyle',
  'medication_taken',
  'medication_note',
  'medication_name',
  'medication_dosage',
  'medication_taken_at',
  'measurements',
  'note',
]);

const rejectUnknownFields = (value, allowed, label) => {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) {
    throw errorHandler(400, `${label} tidak dikenal: ${unknown.join(', ')}`);
  }
};

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const requireObject = (value, label) => {
  if (!isPlainObject(value)) throw errorHandler(400, `${label} harus berupa object.`);
};

const optionalNumber = (value, field, min, max) => {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw errorHandler(400, `${field} harus berupa angka antara ${min} dan ${max}.`);
  }
  return value;
};

const optionalString = (value, field, maxLength) => {
  if (typeof value !== 'string' || value.trim().length > maxLength) {
    throw errorHandler(400, `${field} harus berupa teks maksimal ${maxLength} karakter.`);
  }
  return value.trim();
};

const parseDate = (value, field) => {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw errorHandler(400, `${field} harus berupa tanggal ISO yang valid.`);
  }
  return new Date(value);
};

const validateStringList = (value, field, maxItems, maxLength) => {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw errorHandler(400, `${field} harus berupa daftar maksimal ${maxItems} item.`);
  }
  return value.map((item) => {
    if (typeof item !== 'string' || item.trim().length === 0 || item.trim().length > maxLength) {
      throw errorHandler(400, `Setiap item ${field} harus berupa teks 1-${maxLength} karakter.`);
    }
    return item.trim();
  });
};

const clockPattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const checkInSymptoms = [
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
  'other',
];

export function registrationEmailPattern(email) {
  const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escapedEmail}$`, 'i');
}

export function validateRegistration(body) {
  requireObject(body, 'Data pendaftaran');
  rejectUnknownFields(body, new Set(['name', 'email', 'password', 'phone_number']), 'Field');

  const name = optionalString(body.name, 'name', 80);
  const email = optionalString(body.email, 'email', 254).toLowerCase();
  const password = body.password;
  const phoneNumber = optionalString(body.phone_number, 'phone_number', 30);

  if (name.length < 2) throw errorHandler(400, 'Nama minimal 2 karakter.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw errorHandler(400, 'Format email tidak valid.');
  }
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
    throw errorHandler(400, 'Kata sandi harus berisi 10-128 karakter.');
  }
  if (phoneNumber.length < 6) throw errorHandler(400, 'Nomor telepon minimal 6 karakter.');

  return { name, email, password, phone_number: phoneNumber };
}

export function validateProfileUpdate(body) {
  requireObject(body, 'Profil');
  rejectUnknownFields(body, profileFields, 'Field profil');
  if (!Object.keys(body).length) throw errorHandler(400, 'Minimal satu field profil harus diisi.');

  const result = {};
  if ('date_of_birth' in body) {
    if (body.date_of_birth === null) {
      result.date_of_birth = null;
    } else {
      const date = parseDate(body.date_of_birth, 'date_of_birth');
      if (date > new Date() || date < new Date('1900-01-01')) {
        throw errorHandler(400, 'Tanggal lahir berada di luar rentang yang valid.');
      }
      result.date_of_birth = date;
    }
  }
  if ('timezone' in body) {
    const timezone = optionalString(body.timezone, 'timezone', 64);
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch {
      throw errorHandler(400, 'timezone harus berupa nama zona waktu IANA yang valid.');
    }
    result.timezone = timezone;
  }
  if ('sex' in body) {
    if (![null, 'female', 'male', 'other'].includes(body.sex)) {
      throw errorHandler(400, 'sex harus female, male, other, atau null.');
    }
    result.sex = body.sex;
  }
  if ('height_cm' in body) result.height_cm = optionalNumber(body.height_cm, 'height_cm', 50, 250);
  if ('weight_kg' in body) result.weight_kg = optionalNumber(body.weight_kg, 'weight_kg', 2, 350);
  if ('blood_type' in body) {
    const bloodType = optionalString(body.blood_type, 'blood_type', 3);
    if (bloodType && !/^(?:A|B|AB|O)[+-]$/.test(bloodType)) {
      throw errorHandler(400, 'blood_type harus berupa golongan darah yang valid.');
    }
    result.blood_type = bloodType;
  }
  if ('emergency_contact_name' in body) {
    result.emergency_contact_name = optionalString(body.emergency_contact_name, 'emergency_contact_name', 120);
  }
  if ('emergency_contact_phone' in body) {
    result.emergency_contact_phone = optionalString(body.emergency_contact_phone, 'emergency_contact_phone', 30);
  }
  if ('conditions' in body) result.conditions = validateStringList(body.conditions, 'conditions', 30, 120);
  if ('allergies' in body) result.allergies = validateStringList(body.allergies, 'allergies', 30, 120);
  for (const key of ['allergies_reviewed', 'medication_reviewed']) {
    if (key in body) {
      if (typeof body[key] !== 'boolean') throw errorHandler(400, `${key} harus berupa boolean.`);
      result[key] = body[key];
    }
  }
  if ('special_conditions' in body) {
    result.special_conditions = validateStringList(body.special_conditions, 'special_conditions', 30, 120);
  }
  if ('clinical_note' in body) result.clinical_note = optionalString(body.clinical_note, 'clinical_note', 500);
  if ('medications' in body) {
    if (!Array.isArray(body.medications) || body.medications.length > 50) {
      throw errorHandler(400, 'medications harus berupa daftar maksimal 50 item.');
    }
    result.medications = body.medications.map((medication) => {
      requireObject(medication, 'Item medication');
      rejectUnknownFields(medication, new Set(['name', 'dosage', 'schedule']), 'Field medication');
      const name = optionalString(medication.name, 'medication.name', 120);
      if (!name) throw errorHandler(400, 'Nama obat wajib diisi.');
      return {
        name,
        dosage: medication.dosage === undefined ? '' : optionalString(medication.dosage, 'medication.dosage', 80),
        schedule: medication.schedule === undefined ? '' : optionalString(medication.schedule, 'medication.schedule', 120),
      };
    });
  }
  if ('goal' in body) {
    const goals = ['daily_monitoring', 'patterns_recovery', 'early_awareness', 'fitness', 'other'];
    if (!goals.includes(body.goal)) throw errorHandler(400, `goal harus salah satu dari: ${goals.join(', ')}.`);
    result.goal = body.goal;
  }
  if ('monitoring_priority' in body) {
    const priorities = ['activity_rest', 'sleep_recovery', 'symptoms', 'daily_patterns', 'other'];
    if (!priorities.includes(body.monitoring_priority)) {
      throw errorHandler(400, `monitoring_priority harus salah satu dari: ${priorities.join(', ')}.`);
    }
    result.monitoring_priority = body.monitoring_priority;
  }
  if ('ai_processing_consent' in body) {
    requireObject(body.ai_processing_consent, 'ai_processing_consent');
    rejectUnknownFields(
      body.ai_processing_consent,
      new Set(['granted']),
      'Field ai_processing_consent',
    );
    if (typeof body.ai_processing_consent.granted !== 'boolean') {
      throw errorHandler(400, 'ai_processing_consent.granted harus berupa boolean.');
    }
    result.ai_processing_consent = {
      granted: body.ai_processing_consent.granted,
    };
  }
  if ('data_sharing' in body) {
    requireObject(body.data_sharing, 'data_sharing');
    const allowed = new Set(['share_with_clinician', 'share_with_family']);
    rejectUnknownFields(body.data_sharing, allowed, 'Field data_sharing');
    if (!Object.keys(body.data_sharing).length) {
      throw errorHandler(400, 'Minimal satu preferensi data_sharing harus diisi.');
    }
    result.data_sharing = {};
    for (const key of allowed) {
      if (key in body.data_sharing) {
        if (typeof body.data_sharing[key] !== 'boolean') {
          throw errorHandler(400, `data_sharing.${key} harus berupa boolean.`);
        }
        result.data_sharing[key] = body.data_sharing[key];
      }
    }
  }
  if ('wearable_provider' in body) {
    const providers = ['none', 'polar_h10', 'apple_watch', 'garmin', 'fitbit', 'other'];
    if (!providers.includes(body.wearable_provider)) {
      throw errorHandler(400, `wearable_provider harus salah satu dari: ${providers.join(', ')}.`);
    }
    result.wearable_provider = body.wearable_provider;
  }
  if ('personal_factor_ranking' in body) {
    const ranking = validateStringList(
      body.personal_factor_ranking,
      'personal_factor_ranking',
      personalFactorTypes.size,
      40,
    );
    if (
      ranking.some((factor) => !personalFactorTypes.has(factor))
      || new Set(ranking).size !== ranking.length
    ) {
      throw errorHandler(
        400,
        'personal_factor_ranking harus berisi faktor personal valid yang unik.',
      );
    }
    result.personal_factor_ranking = ranking;
  }
  if ('notification_preferences' in body) {
    const preferences = body.notification_preferences;
    requireObject(preferences, 'notification_preferences');
    const allowed = new Set([
      'morning_summary',
      'morning_summary_time',
      'important_alerts',
      'health_education',
      'quiet_start',
      'quiet_end',
    ]);
    rejectUnknownFields(preferences, allowed, 'Field notification_preferences');
    if (!Object.keys(preferences).length) {
      throw errorHandler(400, 'Minimal satu preferensi notifikasi harus diisi.');
    }
    const validated = {};
    for (const key of ['morning_summary', 'important_alerts', 'health_education']) {
      if (key in preferences) {
        if (typeof preferences[key] !== 'boolean') {
          throw errorHandler(400, `${key} harus berupa boolean.`);
        }
        validated[key] = preferences[key];
      }
    }
    for (const key of ['quiet_start', 'quiet_end']) {
      if (key in preferences) {
        if (typeof preferences[key] !== 'string' || !clockPattern.test(preferences[key])) {
          throw errorHandler(400, `${key} harus menggunakan format waktu HH:mm.`);
        }
        validated[key] = preferences[key];
      }
    }
    if ('morning_summary_time' in preferences) {
      if (
        typeof preferences.morning_summary_time !== 'string'
        || !clockPattern.test(preferences.morning_summary_time)
      ) {
        throw errorHandler(
          400,
          'morning_summary_time harus menggunakan format waktu HH:mm.'
        );
      }
      validated.morning_summary_time = preferences.morning_summary_time;
    }
    result.notification_preferences = validated;
  }
  return result;
}

const patientEventTypes = new Set([
  'exercise_started',
  'exercise_ended',
  'sleep_started',
  'woke_up',
  'meal',
  'medication',
  'stress',
  'symptom',
  'caffeine',
  'alcohol',
  'smoking',
  'hydration',
  'illness',
  'posture_change',
  'activity_correction',
  'hil_scenario',
  'menstruation',
  'other',
  'ema',
]);
const wearableProviders = new Set(['polar_h10', 'apple_watch', 'garmin', 'fitbit', 'other']);
const wearableActivities = new Set(['rest', 'sitting', 'standing', 'walking', 'running', 'exercise', 'sleep', 'other']);

function validateGuidedSessionEma(value) {
  requireObject(value, 'value EMA');
  const allowed = new Set(['instrument', 'version', 'feeling', 'note', 'samples']);
  rejectUnknownFields(value, allowed, 'Field value EMA');
  if (value.instrument !== 'guided_baseline_session' || value.version !== 1) {
    throw errorHandler(400, 'Identitas kuesioner EMA sesi baseline tidak valid.');
  }
  const feelings = new Set(['calmer', 'same', 'more_tired', 'uncomfortable']);
  if (!feelings.has(value.feeling)) {
    throw errorHandler(400, 'Jawaban perasaan EMA tidak valid.');
  }
  const note = value.note === undefined ? '' : optionalString(value.note, 'value.note', 120);
  if (!Array.isArray(value.samples) || value.samples.length !== 4) {
    throw errorHandler(400, 'EMA sesi baseline harus mencatat empat konteks aktivitas.');
  }
  const activities = new Set(['sitting', 'standing', 'walking']);
  const samples = value.samples.map((sample, index) => {
    requireObject(sample, `value.samples[${index}]`);
    const fields = new Set([
      'activity',
      'skipped',
      'incomplete',
      'reading_count',
      'window_count',
      'rr_interval_count',
      'minimum_hr',
      'maximum_hr',
    ]);
    rejectUnknownFields(sample, fields, `Field value.samples[${index}]`);
    if (!activities.has(sample.activity)) {
      throw errorHandler(400, `Aktivitas EMA pada konteks ${index + 1} tidak valid.`);
    }
    for (const flag of ['skipped', 'incomplete']) {
      if (typeof sample[flag] !== 'boolean') {
        throw errorHandler(400, `value.samples[${index}].${flag} harus berupa boolean.`);
      }
    }
    const counts = {};
    for (const field of ['reading_count', 'window_count', 'rr_interval_count']) {
      const count = sample[field];
      if (!Number.isInteger(count) || count < 0 || count > 100000) {
        throw errorHandler(400, `value.samples[${index}].${field} harus bilangan bulat 0-100000.`);
      }
      counts[field] = count;
    }
    const minimumHr = sample.minimum_hr === null
      ? null
      : optionalNumber(sample.minimum_hr, `value.samples[${index}].minimum_hr`, 20, 250);
    const maximumHr = sample.maximum_hr === null
      ? null
      : optionalNumber(sample.maximum_hr, `value.samples[${index}].maximum_hr`, 20, 250);
    if (minimumHr !== null && maximumHr !== null && minimumHr > maximumHr) {
      throw errorHandler(400, `Rentang HR pada konteks ${index + 1} tidak valid.`);
    }
    return {
      activity: sample.activity,
      skipped: sample.skipped,
      incomplete: sample.incomplete,
      ...counts,
      minimum_hr: minimumHr,
      maximum_hr: maximumHr,
    };
  });
  return {
    instrument: 'guided_baseline_session',
    version: 1,
    feeling: value.feeling,
    note,
    samples,
  };
}

export function validatePatientEvent(body) {
  requireObject(body, 'Event');
  rejectUnknownFields(
    body,
    new Set([
      'event_type',
      'occurred_at',
      'event_time',
      'affected_interval',
      'confidence',
      'details',
      'value',
      'intensity',
      'unit',
    ]),
    'Field event'
  );
  if (!patientEventTypes.has(body.event_type)) {
    throw errorHandler(400, `event_type harus salah satu dari: ${[...patientEventTypes].join(', ')}.`);
  }
  const result = {
    event_type: body.event_type,
    occurred_at: parseDate(body.occurred_at, 'occurred_at'),
    details: body.details === undefined ? '' : optionalString(body.details, 'details', 300),
  };
  if (body.event_type === 'activity_correction' && isPlainObject(body.value)) {
    rejectUnknownFields(
      body.value,
      new Set(['activity', 'contextual_factors', 'note']),
      'Field koreksi aktivitas'
    );
    if (!['unsure', 'sitting', 'standing', 'walking', 'rest', 'other']
      .includes(body.value.activity)) {
      throw errorHandler(400, 'Aktivitas koreksi tidak valid.');
    }
    if (!['certain', 'unsure'].includes(body.confidence)) {
      throw errorHandler(400, 'confidence harus certain atau unsure.');
    }
    if (body.value.activity === 'unsure' && body.confidence !== 'unsure') {
      throw errorHandler(400, 'Aktivitas unsure harus memiliki confidence unsure.');
    }
    requireObject(body.value.contextual_factors, 'contextual_factors');
    rejectUnknownFields(
      body.value.contextual_factors,
      new Set(['mood', 'caffeine', 'meal', 'other_factors']),
      'Field faktor konteks'
    );
    const factors = body.value.contextual_factors;
    const allowedFactors = {
      mood: ['unsure', 'good', 'neutral', 'stressed', 'low_mood', 'tired'],
      caffeine: ['unsure', 'none', 'consumed'],
      meal: ['unsure', 'none', 'recent'],
    };
    for (const [field, values] of Object.entries(allowedFactors)) {
      if (!values.includes(factors[field])) {
        throw errorHandler(400, `${field} bukan pilihan faktor konteks yang valid.`);
      }
    }
    const otherFactors = validateStringList(
      factors.other_factors,
      'other_factors',
      8,
      32
    );
    const note = body.value.note === undefined
      ? ''
      : optionalString(body.value.note, 'value.note', 500);
    if (!body.affected_interval || !isPlainObject(body.affected_interval)) {
      throw errorHandler(400, 'affected_interval wajib diisi untuk koreksi aktivitas.');
    }
    rejectUnknownFields(
      body.affected_interval,
      new Set(['start', 'end']),
      'Field affected_interval'
    );
    const eventTime = parseDate(body.event_time, 'event_time');
    const start = parseDate(body.affected_interval.start, 'affected_interval.start');
    const end = parseDate(body.affected_interval.end, 'affected_interval.end');
    if (start > end) {
      throw errorHandler(400, 'affected_interval.start harus sebelum atau sama dengan end.');
    }
    if (end.getTime() - start.getTime() > 12 * 60 * 60 * 1000) {
      throw errorHandler(400, 'Interval terdampak maksimal 12 jam.');
    }
    if (end.getTime() > Date.now() + 5 * 60 * 1000) {
      throw errorHandler(400, 'Interval aktivitas tidak boleh berada di masa depan.');
    }
    if (eventTime < start || eventTime > end) {
      throw errorHandler(400, 'event_time harus berada di dalam affected_interval.');
    }
    result.event_time = eventTime;
    result.affected_interval = { start, end };
    result.confidence = body.confidence;
    result.value = {
      activity: body.value.activity,
      contextual_factors: {
        mood: factors.mood,
        caffeine: factors.caffeine,
        meal: factors.meal,
        other_factors: otherFactors,
      },
      note,
    };
  } else if ('event_time' in body || 'affected_interval' in body || 'confidence' in body) {
    throw errorHandler(400, 'Rentang dan keyakinan hanya boleh dikirim untuk koreksi aktivitas terstruktur.');
  }
  if ('value' in body) {
    if (body.event_type === 'activity_correction' && isPlainObject(body.value)) {
      result.value = {
        activity: body.value.activity,
        contextual_factors: result.value.contextual_factors,
        note: result.value.note,
      };
    } else if (body.event_type === 'ema') {
      result.value = validateGuidedSessionEma(body.value);
    } else if (typeof body.value === 'string') {
      result.value = optionalString(body.value, 'value', 120);
    } else if (typeof body.value === 'number' && Number.isFinite(body.value)) {
      result.value = body.value;
    } else if (typeof body.value === 'boolean') {
      result.value = body.value;
    } else {
      throw errorHandler(400, 'value harus berupa teks, angka, atau boolean.');
    }
  } else if (body.event_type === 'ema') {
    throw errorHandler(400, 'Jawaban EMA wajib dikirim.');
  }
  if ('intensity' in body) {
    if (!['low', 'moderate', 'vigorous', 'none', 'high', 'severe', 'mild', null].includes(body.intensity)) {
      throw errorHandler(400, 'intensity tidak valid.');
    }
    result.intensity = body.intensity;
  }
  if ('unit' in body) result.unit = optionalString(body.unit, 'unit', 32);
  return result;
}

export function validateGamificationSettings(body) {
  requireObject(body, 'Pengaturan gamifikasi');
  const allowed = new Set([
    'nickname',
    'leaderboard_opt_in',
    'location_opt_in',
    'latitude',
    'longitude',
  ]);
  rejectUnknownFields(body, allowed, 'Field gamifikasi');
  const result = {};
  if ('nickname' in body) {
    result.nickname = optionalString(body.nickname, 'nickname', 24);
    if (result.nickname.length < 2) {
      throw errorHandler(400, 'Nama samaran harus berisi 2-24 karakter.');
    }
  }
  for (const field of ['leaderboard_opt_in', 'location_opt_in']) {
    if (field in body) {
      if (typeof body[field] !== 'boolean') {
        throw errorHandler(400, `${field} harus berupa boolean.`);
      }
      result[field] = body[field];
    }
  }
  if (!Object.keys(result).length) {
    throw errorHandler(400, 'Minimal satu pengaturan gamifikasi harus diisi.');
  }
  if (body.location_opt_in === true) {
    result.latitude = optionalNumber(body.latitude, 'latitude', -90, 90);
    result.longitude = optionalNumber(body.longitude, 'longitude', -180, 180);
    if (!Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) {
      throw errorHandler(400, 'Izin lokasi memerlukan koordinat GPS yang valid.');
    }
  } else if ('latitude' in body || 'longitude' in body) {
    throw errorHandler(400, 'Koordinat hanya boleh dikirim saat lokasi diaktifkan.');
  }
  return result;
}

const patientActionTypes = new Set([
  'patient_guidance',
  'measurement',
  'clinical_review',
  'monitoring',
  'other',
]);
const patientActionStatuses = new Set([
  'DELIVERED',
  'ACKNOWLEDGED',
  'COMPLETED',
  'FAILED',
]);

export function validatePatientAction(body) {
  requireObject(body, 'Tindakan');
  rejectUnknownFields(
    body,
    new Set(['action_type', 'title', 'details', 'decision']),
    'Field tindakan'
  );
  if (!patientActionTypes.has(body.action_type)) {
    throw errorHandler(400, 'action_type tidak valid.');
  }
  const result = {
    action_type: body.action_type,
    title: optionalString(body.title, 'title', 160),
    details: body.details === undefined
      ? ''
      : optionalString(body.details, 'details', 500),
    decision: { level: '', title: '', policy_version: '' },
  };
  if (!result.title) throw errorHandler(400, 'title wajib diisi.');

  if (body.decision !== undefined) {
    requireObject(body.decision, 'decision');
    rejectUnknownFields(
      body.decision,
      new Set(['level', 'title', 'policy_version']),
      'Field decision'
    );
    result.decision = {
      level: body.decision.level === undefined
        ? ''
        : optionalString(body.decision.level, 'decision.level', 32),
      title: body.decision.title === undefined
        ? ''
        : optionalString(body.decision.title, 'decision.title', 160),
      policy_version: body.decision.policy_version === undefined
        ? ''
        : optionalString(
          body.decision.policy_version,
          'decision.policy_version',
          80
        ),
    };
  }
  return result;
}

export function validatePatientActionStatus(body) {
  requireObject(body, 'Status tindakan');
  rejectUnknownFields(body, new Set(['status']), 'Field status tindakan');
  if (!patientActionStatuses.has(body.status)) {
    throw errorHandler(400, 'status tindakan tidak valid.');
  }
  return body.status;
}

export function validatePatientImpactSummaryQuery(query) {
  rejectUnknownFields(query, new Set(['from', 'to']), 'Query impact summary');
  const to = query.to === undefined ? new Date() : parseDate(query.to, 'to');
  const from = query.from === undefined
    ? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
    : parseDate(query.from, 'from');
  if (from > to) {
    throw errorHandler(400, 'from harus lebih awal dari atau sama dengan to.');
  }
  if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) {
    throw errorHandler(400, 'Rentang impact summary maksimal 366 hari.');
  }
  return { from, to };
}

const scenarioActivityValues = new Set([
  'rest',
  'sitting',
  'standing',
  'sleep',
  'walking',
  'running',
  'exercise',
  'work',
  'other',
  'unsure',
]);

export function validateScenarioId(scenarioId) {
  if (!['a', 'b', 'c'].includes(scenarioId)) {
    throw errorHandler(404, 'Skenario tidak ditemukan.');
  }
  return scenarioId;
}

export function validateScenarioSession(body) {
  requireObject(body, 'Sesi skenario');
  rejectUnknownFields(body, new Set(['consent_given']), 'Field sesi skenario');
  if (body.consent_given !== true) {
    throw errorHandler(400, 'Persetujuan peserta wajib diberikan sebelum sesi dimulai.');
  }
  return { consent_given: true };
}

export function validateScenarioEvent(body) {
  requireObject(body, 'Event skenario');
  rejectUnknownFields(
    body,
    new Set([
      'idempotency_key',
      'event_time',
      'activity',
      'confidence',
      'affected_interval',
    ]),
    'Field event skenario'
  );
  const idempotencyKey = optionalString(
    body.idempotency_key,
    'idempotency_key',
    128
  );
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
    throw errorHandler(400, 'idempotency_key harus 8-128 karakter yang valid.');
  }
  if (!scenarioActivityValues.has(body.activity)) {
    throw errorHandler(400, 'activity skenario tidak valid.');
  }
  if (!['certain', 'unsure'].includes(body.confidence)) {
    throw errorHandler(400, 'confidence harus certain atau unsure.');
  }
  if (body.activity === 'unsure' && body.confidence !== 'unsure') {
    throw errorHandler(400, 'Aktivitas unsure harus memiliki confidence unsure.');
  }
  requireObject(body.affected_interval, 'affected_interval');
  rejectUnknownFields(
    body.affected_interval,
    new Set(['start', 'end']),
    'Field affected_interval'
  );
  const eventTime = parseDate(body.event_time, 'event_time');
  const start = parseDate(body.affected_interval.start, 'affected_interval.start');
  const end = parseDate(body.affected_interval.end, 'affected_interval.end');
  const now = Date.now();
  if (start > end) {
    throw errorHandler(400, 'affected_interval.start harus sebelum atau sama dengan end.');
  }
  if (end.getTime() - start.getTime() > 12 * 60 * 60 * 1000) {
    throw errorHandler(400, 'Interval terdampak maksimal 12 jam.');
  }
  if (eventTime.getTime() > now + 5 * 60 * 1000) {
    throw errorHandler(400, 'event_time tidak boleh berada di masa depan.');
  }
  if (eventTime < start || eventTime > end) {
    throw errorHandler(400, 'event_time harus berada di dalam affected_interval.');
  }
  return {
    idempotency_key: idempotencyKey,
    event_time: eventTime,
    activity: body.activity,
    confidence: body.confidence,
    affected_interval: { start, end },
  };
}

export function validateScenarioQuestionnaire(body) {
  requireObject(body, 'Kuesioner skenario');
  rejectUnknownFields(body, new Set(['instrument', 'responses']), 'Field kuesioner');

  if (!['SUS', 'NASA_TLX'].includes(body.instrument)) {
    throw errorHandler(400, 'instrument harus SUS atau NASA_TLX.');
  }

  const responses = body.responses;
  if (body.instrument === 'SUS') {
    if (!Array.isArray(responses) || responses.length !== 10) {
      throw errorHandler(400, 'Kuesioner SUS harus memiliki tepat 10 jawaban.');
    }
    if (responses.some((answer) => !Number.isInteger(answer) || answer < 1 || answer > 5)) {
      throw errorHandler(400, 'Setiap jawaban SUS harus berupa bilangan bulat 1-5.');
    }
    return { instrument: body.instrument, responses: [...responses] };
  }

  const dimensions = [
    'mental_demand',
    'physical_demand',
    'temporal_demand',
    'performance',
    'effort',
    'frustration',
  ];
  requireObject(responses, 'Jawaban NASA-TLX');
  rejectUnknownFields(responses, new Set(dimensions), 'Dimensi NASA-TLX');
  if (Object.keys(responses).length !== dimensions.length) {
    throw errorHandler(400, 'Kuesioner NASA-TLX harus menjawab semua 6 dimensi.');
  }
  const normalizedResponses = {};
  for (const dimension of dimensions) {
    const value = responses[dimension];
    if (!Number.isInteger(value) || value < 0 || value > 100 || value % 5 !== 0) {
      throw errorHandler(400, `${dimension} harus berupa bilangan 0-100 dengan kelipatan 5.`);
    }
    normalizedResponses[dimension] = value;
  }
  return { instrument: body.instrument, responses: normalizedResponses };
}

export function validateWearableSample(body) {
  requireObject(body, 'Data wearable');
  const allowed = new Set([
    'provider',
    'is_simulated',
    'recorded_at',
    'device_id',
    'heart_rate_bpm',
    'rr_intervals_ms',
    'acceleration_g',
    'sensor_contact',
    'signal_confidence',
    'expected_rr_count',
    'spo2_pct',
    'steps',
    'activity',
    'activity_intensity',
    'posture',
    'sleep_duration_minutes',
    'sleep_quality',
    'skin_temperature_c',
  ]);
  rejectUnknownFields(body, allowed, 'Field wearable');
  if (!wearableProviders.has(body.provider)) {
    throw errorHandler(400, `provider harus salah satu dari: ${[...wearableProviders].join(', ')}.`);
  }
  if ('is_simulated' in body && typeof body.is_simulated !== 'boolean') {
    throw errorHandler(400, 'is_simulated harus berupa boolean.');
  }

  const result = {
    provider: body.provider,
    is_simulated: body.is_simulated === true,
    recorded_at: parseDate(body.recorded_at, 'recorded_at'),
    device_id: optionalString(body.device_id, 'device_id', 120),
  };
  if (!result.device_id) throw errorHandler(400, 'device_id wajib diisi.');
  const limits = {
    heart_rate_bpm: [20, 250],
    spo2_pct: [50, 100],
    steps: [0, 100000],
    skin_temperature_c: [20, 45],
    signal_confidence: [0, 1],
    expected_rr_count: [1, 1000],
    sleep_duration_minutes: [0, 1440],
  };
  for (const [field, [min, max]] of Object.entries(limits)) {
    if (field in body) {
      result[field] = optionalNumber(body[field], field, min, max);
      if (field === 'heart_rate_bpm' || field === 'steps' || field === 'expected_rr_count' || field === 'sleep_duration_minutes') {
        if (!Number.isInteger(result[field])) throw errorHandler(400, `${field} harus berupa bilangan bulat.`);
      }
    }
  }
  if ('rr_intervals_ms' in body) {
    if (!Array.isArray(body.rr_intervals_ms) || body.rr_intervals_ms.length < 10 || body.rr_intervals_ms.length > 256) {
      throw errorHandler(400, 'rr_intervals_ms wajib berisi 10-256 interval RR dalam milidetik.');
    }
    result.rr_intervals_ms = body.rr_intervals_ms.map((value) =>
      optionalNumber(value, 'rr_intervals_ms', 250, 3000)
    );
  }
  if (!('heart_rate_bpm' in body) || !('rr_intervals_ms' in body) || !('activity' in body)) {
    throw errorHandler(400, 'Wearable minimum wajib menyertakan HR, RR/IBI, activity, ACC, timestamp, dan device_id.');
  }
  if (!wearableActivities.has(body.activity)) {
    throw errorHandler(400, `activity wajib salah satu dari: ${[...wearableActivities].join(', ')}.`);
  }
  result.activity = body.activity;
  if (!Array.isArray(body.acceleration_g) || body.acceleration_g.length < 10 || body.acceleration_g.length > 512) {
    throw errorHandler(400, 'acceleration_g wajib berisi 10-512 sampel triaksial [x,y,z] dalam satuan g.');
  }
  result.acceleration_g = body.acceleration_g.map((sample, index) => {
    if (!Array.isArray(sample) || sample.length !== 3) {
      throw errorHandler(400, `acceleration_g[${index}] harus berupa [x, y, z].`);
    }
    return sample.map((value, axis) =>
      optionalNumber(value, `acceleration_g[${index}][${axis}]`, -16, 16)
    );
  });
  if (typeof body.sensor_contact !== 'boolean') {
    throw errorHandler(400, 'sensor_contact wajib berupa boolean.');
  }
  result.sensor_contact = body.sensor_contact;
  if (!('signal_confidence' in body)) {
    throw errorHandler(400, 'signal_confidence wajib diisi dengan nilai 0-1.');
  }
  result.signal_confidence = optionalNumber(body.signal_confidence, 'signal_confidence', 0, 1);
  if ('sleep_quality' in body) {
    if (![null, 'very_good', 'good', 'fair', 'poor'].includes(body.sleep_quality)) {
      throw errorHandler(400, 'sleep_quality tidak valid.');
    }
    result.sleep_quality = body.sleep_quality;
  }
  if ('activity_intensity' in body) {
    if (!['low', 'moderate', 'vigorous', 'unknown'].includes(body.activity_intensity)) {
      throw errorHandler(400, 'activity_intensity tidak valid.');
    }
    result.activity_intensity = body.activity_intensity;
  }
  if ('posture' in body) {
    if (!['lying', 'sitting', 'standing', 'unknown'].includes(body.posture)) {
      throw errorHandler(400, 'posture tidak valid.');
    }
    result.posture = body.posture;
  }
  return result;
}

export function validateWearableStream(body) {
  requireObject(body, 'Wearable stream');
  rejectUnknownFields(
    body,
    new Set(['provider', 'is_simulated', 'device_id', 'activity', 'readings']),
    'Field wearable stream'
  );
  const isSimulated = body.is_simulated === true;
  if ('is_simulated' in body && typeof body.is_simulated !== 'boolean') {
    throw errorHandler(400, 'is_simulated harus berupa boolean.');
  }
  if (
    (isSimulated && body.provider !== 'other')
    || (!isSimulated && body.provider !== 'polar_h10')
  ) {
    throw errorHandler(
      400,
      'Streaming nyata harus menggunakan polar_h10; streaming simulasi harus ditandai is_simulated dan menggunakan provider other.'
    );
  }
  const deviceId = optionalString(body.device_id, 'device_id', 120);
  if (!deviceId) throw errorHandler(400, 'device_id wajib diisi.');
  if (!wearableActivities.has(body.activity)) {
    throw errorHandler(400, `activity wajib salah satu dari: ${[...wearableActivities].join(', ')}.`);
  }
  if (!Array.isArray(body.readings) || body.readings.length < 1 || body.readings.length > 100) {
    throw errorHandler(400, 'readings harus berisi 1-100 pengukuran.');
  }

  const readings = body.readings.map((reading, index) => {
    requireObject(reading, `readings[${index}]`);
    rejectUnknownFields(
      reading,
      new Set(['recorded_at', 'heart_rate_bpm', 'rr_interval_ms', 'acceleration_g', 'sensor_contact', 'signal_confidence']),
      `Field readings[${index}]`
    );
    const heartRate = optionalNumber(reading.heart_rate_bpm, `readings[${index}].heart_rate_bpm`, 20, 250);
    if (!Number.isInteger(heartRate)) {
      throw errorHandler(400, `readings[${index}].heart_rate_bpm harus bilangan bulat.`);
    }
    const rrInterval = optionalNumber(reading.rr_interval_ms, `readings[${index}].rr_interval_ms`, 300, 2000);
    if (!Number.isInteger(rrInterval)) {
      throw errorHandler(400, `readings[${index}].rr_interval_ms harus bilangan bulat.`);
    }
    if (reading.sensor_contact !== true) {
      throw errorHandler(400, `readings[${index}].sensor_contact harus true untuk streaming.`);
    }
    const signalConfidence = optionalNumber(
      reading.signal_confidence,
      `readings[${index}].signal_confidence`,
      0,
      1
    );
    if (!Array.isArray(reading.acceleration_g) || reading.acceleration_g.length !== 3) {
      throw errorHandler(400, `readings[${index}].acceleration_g harus berisi [x, y, z].`);
    }
    const acceleration = reading.acceleration_g.map((value, axis) =>
      optionalNumber(value, `readings[${index}].acceleration_g[${axis}]`, -16, 16)
    );
    return {
      recorded_at: parseDate(reading.recorded_at, `readings[${index}].recorded_at`),
      heart_rate_bpm: heartRate,
      rr_interval_ms: rrInterval,
      acceleration_g: acceleration,
      sensor_contact: true,
      signal_confidence: signalConfidence,
    };
  });

  return {
    provider: body.provider,
    is_simulated: isSimulated,
    device_id: deviceId,
    activity: body.activity,
    readings,
  };
}

export function validateHilRealtimeEvaluation(body) {
  requireObject(body, 'Evaluasi HIL realtime');
  rejectUnknownFields(
    body,
    new Set([
      'activity',
      'device_id',
      'readings',
      'dfa_rr_intervals_ms',
      'previous_mean_hr',
      'previous_elevated',
    ]),
    'Field evaluasi HIL'
  );
  if (!['sitting', 'standing', 'walking'].includes(body.activity)) {
    throw errorHandler(400, 'activity harus sitting, standing, atau walking.');
  }
  const deviceId = optionalString(body.device_id, 'device_id', 120);
  if (!deviceId) throw errorHandler(400, 'device_id wajib diisi.');
  if (!Array.isArray(body.readings) || body.readings.length < 1 || body.readings.length > 100) {
    throw errorHandler(400, 'readings harus berisi 1-100 pengukuran sensor.');
  }

  const readings = body.readings.map((reading, index) => {
    requireObject(reading, `readings[${index}]`);
    rejectUnknownFields(
      reading,
      new Set([
        'recorded_at',
        'heart_rate_bpm',
        'rr_interval_ms',
        'acceleration_g',
        'sensor_contact',
        'signal_confidence',
      ]),
      `Field readings[${index}]`
    );
    const heartRate = optionalNumber(
      reading.heart_rate_bpm,
      `readings[${index}].heart_rate_bpm`,
      20,
      250
    );
    const rrInterval = optionalNumber(
      reading.rr_interval_ms,
      `readings[${index}].rr_interval_ms`,
      250,
      3000
    );
    const signalConfidence = optionalNumber(
      reading.signal_confidence,
      `readings[${index}].signal_confidence`,
      0,
      1
    );
    if (!Number.isInteger(heartRate)) {
      throw errorHandler(400, `readings[${index}].heart_rate_bpm harus bilangan bulat.`);
    }
    if (reading.sensor_contact !== true) {
      throw errorHandler(400, `readings[${index}].sensor_contact harus true.`);
    }
    if (!Array.isArray(reading.acceleration_g) || reading.acceleration_g.length !== 3) {
      throw errorHandler(400, `readings[${index}].acceleration_g harus berisi [x, y, z].`);
    }
    return {
      recorded_at: parseDate(reading.recorded_at, `readings[${index}].recorded_at`),
      heart_rate_bpm: heartRate,
      rr_interval_ms: rrInterval,
      acceleration_g: reading.acceleration_g.map((value, axis) =>
        optionalNumber(value, `readings[${index}].acceleration_g[${axis}]`, -16, 16)
      ),
      sensor_contact: true,
      signal_confidence: signalConfidence,
    };
  });
  for (let index = 1; index < readings.length; index++) {
    if (readings[index].recorded_at < readings[index - 1].recorded_at) {
      throw errorHandler(400, 'readings harus berurutan berdasarkan recorded_at.');
    }
  }

  let dfaRrIntervals = null;
  if ('dfa_rr_intervals_ms' in body) {
    if (
      !Array.isArray(body.dfa_rr_intervals_ms)
      || body.dfa_rr_intervals_ms.length > 1200
    ) {
      throw errorHandler(400, 'dfa_rr_intervals_ms harus berisi maksimal 1200 interval RR.');
    }
    dfaRrIntervals = body.dfa_rr_intervals_ms.map((value, index) =>
      optionalNumber(value, `dfa_rr_intervals_ms[${index}]`, 250, 3000)
    );
  }

  const result = {
    activity: body.activity,
    device_id: deviceId,
    readings,
    dfa_rr_intervals_ms: dfaRrIntervals,
  };
  if ('previous_mean_hr' in body) {
    result.previous_mean_hr = optionalNumber(body.previous_mean_hr, 'previous_mean_hr', 20, 250);
  }
  if ('previous_elevated' in body) {
    if (typeof body.previous_elevated !== 'boolean') {
      throw errorHandler(400, 'previous_elevated harus berupa boolean.');
    }
    result.previous_elevated = body.previous_elevated;
  }
  return result;
}

export function validateCheckIn(body) {
  requireObject(body, 'Catatan harian');
  rejectUnknownFields(body, checkInFields, 'Field catatan');
  if (!('recorded_at' in body)) {
    throw errorHandler(400, 'recorded_at wajib diisi agar waktu catatan dapat dianalisis.');
  }

  const feelings = ['good', 'fair', 'poor', 'very_poor'];
  const activities = ['rest', 'sitting', 'standing', 'walking', 'running', 'exercise', 'work', 'meal', 'other'];
  const symptoms = [
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
    'other',
  ];
  if ('feeling' in body && body.feeling !== null && !feelings.includes(body.feeling)) {
    throw errorHandler(400, `feeling harus salah satu dari: ${feelings.join(', ')} atau null.`);
  }
  if ('activity' in body && body.activity !== null && !activities.includes(body.activity)) {
    throw errorHandler(400, `activity harus salah satu dari: ${activities.join(', ')} atau null.`);
  }

  const result = {};
  if ('feeling' in body) result.feeling = body.feeling;
  if ('activity' in body) result.activity = body.activity;
  result.recorded_at = parseDate(body.recorded_at, 'recorded_at');
  if ('posture' in body) {
    if (![null, 'lying', 'sitting', 'standing', 'unknown'].includes(body.posture)) {
      throw errorHandler(400, 'posture harus lying, sitting, standing, unknown, atau null.');
    }
    result.posture = body.posture;
  }
  if ('sleep' in body) {
    requireObject(body.sleep, 'sleep');
    rejectUnknownFields(
      body.sleep,
      new Set(['duration_minutes', 'quality', 'bedtime', 'wake_time', 'disturbances']),
      'Field sleep'
    );
    const sleep = {};
    if ('duration_minutes' in body.sleep) {
      sleep.duration_minutes = optionalNumber(body.sleep.duration_minutes, 'sleep.duration_minutes', 0, 1440);
    }
    if ('quality' in body.sleep) {
      const qualities = [null, 'very_good', 'good', 'fair', 'poor'];
      if (!qualities.includes(body.sleep.quality)) {
        throw errorHandler(400, 'sleep.quality tidak valid.');
      }
      sleep.quality = body.sleep.quality;
    }
    for (const key of ['bedtime', 'wake_time']) {
      if (key in body.sleep) {
        if (body.sleep[key] !== null && (typeof body.sleep[key] !== 'string' || !clockPattern.test(body.sleep[key]))) {
          throw errorHandler(400, `sleep.${key} harus menggunakan format waktu HH:mm atau null.`);
        }
        sleep[key] = body.sleep[key];
      }
    }
    if ('disturbances' in body.sleep) {
      requireObject(body.sleep.disturbances, 'sleep.disturbances');
      const disturbanceFields = new Set([
        'woke_frequently',
        'difficulty_falling_asleep',
        'nightmares',
      ]);
      rejectUnknownFields(body.sleep.disturbances, disturbanceFields, 'Field sleep.disturbances');
      sleep.disturbances = {};
      for (const key of disturbanceFields) {
        if (key in body.sleep.disturbances) {
          if (typeof body.sleep.disturbances[key] !== 'boolean') {
            throw errorHandler(400, `sleep.disturbances.${key} harus berupa boolean.`);
          }
          sleep.disturbances[key] = body.sleep.disturbances[key];
        }
      }
    }
    result.sleep = sleep;
  }
  if ('symptoms' in body) {
    result.symptoms = validateStringList(body.symptoms, 'symptoms', 11, 40);
  }
  if (result.symptoms?.some((symptom) => !checkInSymptoms.includes(symptom))) {
    throw errorHandler(400, `symptoms harus dipilih dari: ${checkInSymptoms.join(', ')}.`);
  }
  if ('stress_level' in body) {
    result.stress_level = optionalNumber(body.stress_level, 'stress_level', 1, 3);
    if (!Number.isInteger(result.stress_level)) throw errorHandler(400, 'stress_level harus berupa bilangan bulat 1-3.');
  }
  if ('hydration_ml' in body) {
    result.hydration_ml = optionalNumber(body.hydration_ml, 'hydration_ml', 0, 10000);
  }
  if ('symptom_severity' in body) {
    result.symptom_severity = optionalNumber(body.symptom_severity, 'symptom_severity', 1, 10);
    if (!Number.isInteger(result.symptom_severity)) {
      throw errorHandler(400, 'symptom_severity harus berupa bilangan bulat 1-10.');
    }
  }
  if ('deviation_follow_up' in body) {
    requireObject(body.deviation_follow_up, 'deviation_follow_up');
    const allowed = new Set([
      'segment_id',
      'perceived_factors',
      'ranked_context_factors',
      'symptom_onset',
      'activity_before_event',
      'strenuous_activity',
      'activity_intensity',
      'mental_activity',
      'measurement_condition',
      'note',
      'meal_count',
      'location',
      'action_taken',
      'response_after_action',
    ]);
    rejectUnknownFields(body.deviation_follow_up, allowed, 'Field deviation_follow_up');
    const followUp = body.deviation_follow_up;
    if (
      typeof followUp.segment_id !== 'string'
      || !/^[a-f\d]{24}$/i.test(followUp.segment_id)
    ) {
      throw errorHandler(400, 'deviation_follow_up.segment_id harus berupa ID segment yang valid.');
    }
    const perceivedFactors = followUp.perceived_factors === undefined
      ? []
      : validateStringList(followUp.perceived_factors, 'deviation_follow_up.perceived_factors', 10, 40);
    const allowedFactors = [
      'physical_activity',
      'mood',
      'meal',
      'stress',
      'poor_sleep',
      'medication',
      'food_or_caffeine',
      'illness',
      'pain',
      'other',
      'no_known_factor',
      'prefer_not_to_say',
    ];
    if (perceivedFactors.some((factor) => !allowedFactors.includes(factor))) {
      throw errorHandler(400, 'deviation_follow_up.perceived_factors berisi pilihan yang tidak valid.');
    }
    if (
      perceivedFactors.includes('no_known_factor')
      && perceivedFactors.length > 1
    ) {
      throw errorHandler(400, 'no_known_factor tidak dapat digabung dengan faktor lain.');
    }
    const resultFollowUp = {
      segment_id: followUp.segment_id,
      perceived_factors: perceivedFactors,
    };
    if ('ranked_context_factors' in followUp) {
      const rankedFactors = validateStringList(
        followUp.ranked_context_factors,
        'deviation_follow_up.ranked_context_factors',
        6,
        40
      );
      const allowedRankedFactors = [
        'mood',
        'meal',
        'stress',
        'physical_activity',
        'sleep',
        'other',
      ];
      if (
        rankedFactors.some((factor) => !allowedRankedFactors.includes(factor))
        || new Set(rankedFactors).size !== rankedFactors.length
      ) {
        throw errorHandler(
          400,
          'deviation_follow_up.ranked_context_factors harus berisi faktor unik yang valid.'
        );
      }
      resultFollowUp.ranked_context_factors = rankedFactors;
    }
    if ('symptom_onset' in followUp) {
      const validOnset = ['before_deviation', 'around_deviation', 'after_deviation', 'unknown'];
      if (!validOnset.includes(followUp.symptom_onset)) {
        throw errorHandler(400, 'deviation_follow_up.symptom_onset tidak valid.');
      }
      resultFollowUp.symptom_onset = followUp.symptom_onset;
    }
    if ('activity_before_event' in followUp) {
      const activitiesWithUnknown = [...activities, 'unknown'];
      if (!activitiesWithUnknown.includes(followUp.activity_before_event)) {
        throw errorHandler(400, 'deviation_follow_up.activity_before_event tidak valid.');
      }
      resultFollowUp.activity_before_event = followUp.activity_before_event;
    }
    if ('strenuous_activity' in followUp) {
      if (!['yes', 'no', 'uncertain'].includes(followUp.strenuous_activity)) {
        throw errorHandler(400, 'deviation_follow_up.strenuous_activity tidak valid.');
      }
      resultFollowUp.strenuous_activity = followUp.strenuous_activity;
    }
    if ('activity_intensity' in followUp) {
      const intensities = [
        'light',
        'moderate',
        'heavy',
        'very_heavy',
        'not_applicable',
        'uncertain',
      ];
      if (!intensities.includes(followUp.activity_intensity)) {
        throw errorHandler(400, 'deviation_follow_up.activity_intensity tidak valid.');
      }
      resultFollowUp.activity_intensity = followUp.activity_intensity;
    }
    if (
      resultFollowUp.strenuous_activity === 'yes'
      && resultFollowUp.activity_intensity === 'not_applicable'
    ) {
      throw errorHandler(
        400,
        'Aktivitas berat memerlukan intensitas yang dapat dinilai atau ditandai tidak yakin.'
      );
    }
    if (
      resultFollowUp.strenuous_activity === 'no'
      && resultFollowUp.activity_intensity
      && resultFollowUp.activity_intensity !== 'not_applicable'
    ) {
      throw errorHandler(
        400,
        'Intensitas harus not_applicable bila tidak ada aktivitas berat.'
      );
    }
    if ('mental_activity' in followUp) {
      const mentalActivities = [
        'none',
        'focused_work',
        'stressful_work',
        'conversation',
        'other',
        'unknown',
      ];
      if (!mentalActivities.includes(followUp.mental_activity)) {
        throw errorHandler(400, 'deviation_follow_up.mental_activity tidak valid.');
      }
      resultFollowUp.mental_activity = followUp.mental_activity;
    }
    if ('measurement_condition' in followUp) {
      const measurementConditions = [
        'worn_as_usual',
        'adjusted_during_event',
        'loose_or_moving',
        'not_worn',
        'unknown',
      ];
      if (!measurementConditions.includes(followUp.measurement_condition)) {
        throw errorHandler(400, 'deviation_follow_up.measurement_condition tidak valid.');
      }
      resultFollowUp.measurement_condition = followUp.measurement_condition;
    }
    if ('note' in followUp) {
      resultFollowUp.note = optionalString(followUp.note, 'deviation_follow_up.note', 500);
    }
    if ('meal_count' in followUp) {
      resultFollowUp.meal_count = optionalNumber(
        followUp.meal_count,
        'deviation_follow_up.meal_count',
        0,
        20
      );
      if (!Number.isInteger(resultFollowUp.meal_count)) {
        throw errorHandler(400, 'deviation_follow_up.meal_count harus berupa bilangan bulat 0-20.');
      }
    }
    if ('location' in followUp) {
      requireObject(followUp.location, 'deviation_follow_up.location');
      const locationFields = new Set([
        'latitude',
        'longitude',
        'place_name',
        'captured_at',
      ]);
      rejectUnknownFields(
        followUp.location,
        locationFields,
        'Field deviation_follow_up.location'
      );
      const location = {};
      for (const [key, min, max] of [
        ['latitude', -90, 90],
        ['longitude', -180, 180],
      ]) {
        if (!(key in followUp.location)) {
          throw errorHandler(400, `deviation_follow_up.location.${key} wajib diisi.`);
        }
        location[key] = optionalNumber(
          followUp.location[key],
          `deviation_follow_up.location.${key}`,
          min,
          max
        );
      }
      if ('place_name' in followUp.location) {
        location.place_name = optionalString(
          followUp.location.place_name,
          'deviation_follow_up.location.place_name',
          160
        );
      }
      if ('captured_at' in followUp.location) {
        location.captured_at = parseDate(
          followUp.location.captured_at,
          'deviation_follow_up.location.captured_at'
        );
      }
      resultFollowUp.location = location;
    }
    if ('action_taken' in followUp) {
      resultFollowUp.action_taken = optionalString(
        followUp.action_taken,
        'deviation_follow_up.action_taken',
        300
      );
    }
    if ('response_after_action' in followUp) {
      resultFollowUp.response_after_action = optionalString(
        followUp.response_after_action,
        'deviation_follow_up.response_after_action',
        500
      );
    }
    result.deviation_follow_up = resultFollowUp;
  }
  if ('lifestyle' in body) {
    requireObject(body.lifestyle, 'lifestyle');
    const allowed = new Set(['meal', 'meal_count', 'caffeine', 'alcohol', 'smoking']);
    rejectUnknownFields(body.lifestyle, allowed, 'Field lifestyle');
    result.lifestyle = {};
    for (const key of ['meal', 'caffeine', 'alcohol', 'smoking']) {
      if (key in body.lifestyle) {
        if (typeof body.lifestyle[key] !== 'boolean') {
          throw errorHandler(400, `lifestyle.${key} harus berupa boolean.`);
        }
        result.lifestyle[key] = body.lifestyle[key];
      }
    }
    if ('meal_count' in body.lifestyle) {
      result.lifestyle.meal_count = optionalNumber(
        body.lifestyle.meal_count,
        'lifestyle.meal_count',
        0,
        20
      );
      if (!Number.isInteger(result.lifestyle.meal_count)) {
        throw errorHandler(400, 'lifestyle.meal_count harus berupa bilangan bulat 0-20.');
      }
    }
    if (!Object.keys(result.lifestyle).length) {
      throw errorHandler(400, 'Minimal satu konteks lifestyle harus diisi.');
    }
  }
  if ('medication_taken' in body) {
    if (typeof body.medication_taken !== 'boolean') {
      throw errorHandler(400, 'medication_taken harus berupa boolean.');
    }
    result.medication_taken = body.medication_taken;
  }
  if ('medication_note' in body) result.medication_note = optionalString(body.medication_note, 'medication_note', 200);
  if ('medication_name' in body) result.medication_name = optionalString(body.medication_name, 'medication_name', 120);
  if ('medication_dosage' in body) {
    result.medication_dosage = optionalString(body.medication_dosage, 'medication_dosage', 80);
  }
  if ('medication_taken_at' in body) {
    result.medication_taken_at = parseDate(body.medication_taken_at, 'medication_taken_at');
  }
  if ('note' in body) result.note = optionalString(body.note, 'note', 500);
  if ('measurements' in body) {
    requireObject(body.measurements, 'measurements');
    const allowed = new Set([
      'systolic_bp',
      'diastolic_bp',
      'temperature_c',
      'weight_kg',
      'spo2_pct',
      'glucose_mg_dl',
      'additional',
    ]);
    rejectUnknownFields(body.measurements, allowed, 'Field measurements');
    const measurements = {};
    const limits = {
      systolic_bp: [50, 300],
      diastolic_bp: [20, 200],
      temperature_c: [30, 45],
      weight_kg: [2, 350],
      spo2_pct: [50, 100],
      glucose_mg_dl: [20, 1000],
    };
    for (const [key, [min, max]] of Object.entries(limits)) {
      if (key in body.measurements) measurements[key] = optionalNumber(body.measurements[key], `measurements.${key}`, min, max);
    }
    if ('additional' in body.measurements) {
      if (!Array.isArray(body.measurements.additional) || body.measurements.additional.length > 20) {
        throw errorHandler(400, 'measurements.additional harus berupa daftar maksimal 20 item.');
      }
      measurements.additional = body.measurements.additional.map((item) => {
        requireObject(item, 'measurements.additional item');
        rejectUnknownFields(item, new Set(['name', 'unit', 'value']), 'Field measurements.additional');
        const name = optionalString(item.name, 'measurements.additional.name', 80);
        const value = optionalString(item.value, 'measurements.additional.value', 80);
        if (!name || !value) {
          throw errorHandler(400, 'Nama dan nilai measurements.additional wajib diisi.');
        }
        return {
          name,
          unit: optionalString(item.unit, 'measurements.additional.unit', 24),
          value,
        };
      });
    }
    const systolic = measurements.systolic_bp;
    const diastolic = measurements.diastolic_bp;
    if (systolic !== undefined && systolic !== null && diastolic !== undefined && diastolic !== null && systolic <= diastolic) {
      throw errorHandler(400, 'measurements.systolic_bp harus lebih besar dari diastolic_bp.');
    }
    result.measurements = measurements;
  }
  const hasSleepData = Boolean(result.sleep && Object.entries(result.sleep).some(
    ([key, value]) => key === 'disturbances'
      ? Object.values(value).some((disturbance) => typeof disturbance === 'boolean')
      : value !== null && value !== undefined && value !== ''
  ));
  const hasMeasurementData = Boolean(result.measurements && Object.values(result.measurements).some(
    (value) => Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined
  ));
  const hasPatientInput = (
    (result.feeling != null)
    || (result.activity != null)
    || (result.posture != null)
    || Boolean(result.symptoms?.length)
    || (result.stress_level != null)
    || (result.hydration_ml != null)
    || (result.symptom_severity != null)
    || hasSleepData
    || hasMeasurementData
    || Boolean(result.lifestyle && Object.keys(result.lifestyle).length)
    || (typeof result.medication_taken === 'boolean')
    || Boolean(result.medication_name?.trim())
    || Boolean(result.medication_dosage?.trim())
    || Boolean(result.medication_note?.trim())
    || Boolean(result.deviation_follow_up)
    || Boolean(result.note?.trim())
  );
  if (!hasPatientInput) {
    throw errorHandler(400, 'Catatan kosong. Isi minimal satu bagian sebelum menyimpan.');
  }
  return result;
}

export function validateCheckInQuery(query) {
  const allowed = new Set(['from', 'to', 'limit', 'before']);
  rejectUnknownFields(query, allowed, 'Query');
  const result = {};
  if (query.from) result.from = parseDate(query.from, 'from');
  if (query.to) result.to = parseDate(query.to, 'to');
  if (result.from && result.to && result.from > result.to) {
    throw errorHandler(400, 'from harus lebih awal dari atau sama dengan to.');
  }
  if (query.before) result.before = parseDate(query.before, 'before');
  if (query.limit !== undefined) {
    const limit = Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw errorHandler(400, 'limit harus berupa bilangan bulat antara 1 dan 100.');
    }
    result.limit = limit;
  } else {
    result.limit = 30;
  }
  return result;
}

export function validateWearableHistoryQuery(query) {
  const allowed = new Set(['from', 'to', 'bucket_minutes']);
  rejectUnknownFields(query, allowed, 'Query');
  const from = parseDate(query.from, 'from');
  const to = parseDate(query.to, 'to');
  if (from > to) {
    throw errorHandler(400, 'from harus lebih awal dari atau sama dengan to.');
  }
  if (to.getTime() - from.getTime() > 31 * 24 * 60 * 60 * 1000) {
    throw errorHandler(400, 'Rentang riwayat wearable maksimal 31 hari.');
  }
  const bucketMinutes = query.bucket_minutes === undefined
    ? 60
    : Number(query.bucket_minutes);
  if (![15, 30, 60, 120, 360].includes(bucketMinutes)) {
    throw errorHandler(400, 'bucket_minutes harus 15, 30, 60, 120, atau 360.');
  }
  return { from, to, bucketMinutes };
}
