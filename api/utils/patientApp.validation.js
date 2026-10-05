import { errorHandler } from './error.js';

const profileFields = new Set([
  'date_of_birth',
  'timezone',
  'sex',
  'height_cm',
  'weight_kg',
  'conditions',
  'allergies',
  'allergies_reviewed',
  'special_conditions',
  'clinical_note',
  'medications',
  'medication_reviewed',
  'data_sharing',
  'goal',
  'notification_preferences',
  'wearable_provider',
]);

const checkInFields = new Set([
  'recorded_at',
  'feeling',
  'activity',
  'posture',
  'sleep',
  'symptoms',
  'symptom_severity',
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
  'other',
];

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
    const goals = ['daily_monitoring', 'early_awareness', 'fitness', 'other'];
    if (!goals.includes(body.goal)) throw errorHandler(400, `goal harus salah satu dari: ${goals.join(', ')}.`);
    result.goal = body.goal;
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
  if ('notification_preferences' in body) {
    const preferences = body.notification_preferences;
    requireObject(preferences, 'notification_preferences');
    const allowed = new Set([
      'morning_summary',
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
  'menstruation',
  'other',
]);
const wearableProviders = new Set(['polar_h10', 'apple_watch', 'garmin', 'fitbit', 'other']);
const wearableActivities = new Set(['rest', 'sitting', 'standing', 'walking', 'exercise', 'sleep', 'other']);

export function validatePatientEvent(body) {
  requireObject(body, 'Event');
  rejectUnknownFields(
    body,
    new Set(['event_type', 'occurred_at', 'details', 'value', 'intensity', 'unit']),
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
  if ('value' in body) {
    if (typeof body.value === 'string') {
      result.value = optionalString(body.value, 'value', 120);
    } else if (typeof body.value === 'number' && Number.isFinite(body.value)) {
      result.value = body.value;
    } else if (typeof body.value === 'boolean') {
      result.value = body.value;
    } else {
      throw errorHandler(400, 'value harus berupa teks, angka, atau boolean.');
    }
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

export function validateWearableSample(body) {
  requireObject(body, 'Data wearable');
  const allowed = new Set([
    'provider',
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

  const result = {
    provider: body.provider,
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

export function validateCheckIn(body) {
  requireObject(body, 'Catatan harian');
  rejectUnknownFields(body, checkInFields, 'Field catatan');
  for (const field of ['recorded_at', 'sleep', 'symptoms']) {
    if (!(field in body)) {
      throw errorHandler(400, `${field} wajib diisi agar konteks pasien dan timestamp dapat dianalisis.`);
    }
  }

  const feelings = ['good', 'fair', 'poor', 'very_poor'];
  const activities = ['rest', 'sitting', 'standing', 'walking', 'exercise', 'work', 'meal', 'other'];
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
  if (!feelings.includes(body.feeling)) throw errorHandler(400, `feeling harus salah satu dari: ${feelings.join(', ')}.`);
  if (!activities.includes(body.activity)) throw errorHandler(400, `activity harus salah satu dari: ${activities.join(', ')}.`);

  const result = {
    feeling: body.feeling,
    activity: body.activity,
  };
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
  result.symptoms = validateStringList(body.symptoms, 'symptoms', 11, 40);
  if (result.symptoms.some((symptom) => !checkInSymptoms.includes(symptom))) {
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
  if ('lifestyle' in body) {
    requireObject(body.lifestyle, 'lifestyle');
    const allowed = new Set(['meal', 'caffeine', 'alcohol', 'smoking']);
    rejectUnknownFields(body.lifestyle, allowed, 'Field lifestyle');
    result.lifestyle = {};
    for (const key of allowed) {
      if (key in body.lifestyle) {
        if (typeof body.lifestyle[key] !== 'boolean') {
          throw errorHandler(400, `lifestyle.${key} harus berupa boolean.`);
        }
        result.lifestyle[key] = body.lifestyle[key];
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
    const systolic = measurements.systolic_bp;
    const diastolic = measurements.diastolic_bp;
    if (systolic !== undefined && systolic !== null && diastolic !== undefined && diastolic !== null && systolic <= diastolic) {
      throw errorHandler(400, 'measurements.systolic_bp harus lebih besar dari diastolic_bp.');
    }
    result.measurements = measurements;
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
