import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCheckIn,
  validateCheckInQuery,
  validatePatientEvent,
  validateProfileUpdate,
  validateRegistration,
  validateWearableStream,
  validateWearableSample,
  validateWearableHistoryQuery,
  registrationEmailPattern,
} from '../utils/patientApp.validation.js';

test('registration normalizes email and requires account fields', () => {
  const result = validateRegistration({
    name: 'Ani Setiawan',
    email: 'ANI@example.com',
    password: 'secure-password-1',
    phone_number: '+628123456789',
  });
  assert.equal(result.email, 'ani@example.com');
  assert.throws(
    () => validateRegistration({
      name: 'Ani',
      email: 'ani@example.com',
      password: 'short',
      phone_number: '+628123456789',
    }),
    { statusCode: 400 }
  );
});

test('registration duplicate lookup is exact and case-insensitive', () => {
  const pattern = registrationEmailPattern('person+tag@example.com');
  assert.equal(pattern.test('PERSON+TAG@EXAMPLE.COM'), true);
  assert.equal(pattern.test('other-person+tag@example.com'), false);
  assert.equal(pattern.test('person+tag@example.net'), false);
});

test('profile only accepts known and bounded patient fields', () => {
  const result = validateProfileUpdate({
    height_cm: 165,
    timezone: 'Asia/Jakarta',
    medication_reviewed: true,
    data_sharing: { share_with_clinician: false },
    notification_preferences: { morning_summary: false, quiet_start: '21:30' },
  });
  assert.deepEqual(result, {
    height_cm: 165,
    timezone: 'Asia/Jakarta',
    medication_reviewed: true,
    data_sharing: { share_with_clinician: false },
    notification_preferences: { morning_summary: false, quiet_start: '21:30' },
  });
  assert.throws(() => validateProfileUpdate({ role: 'admin' }), { statusCode: 400 });
  assert.throws(() => validateProfileUpdate({ height_cm: 500 }), { statusCode: 400 });
  assert.throws(() => validateProfileUpdate({ timezone: 'Not/AZone' }), { statusCode: 400 });
});

test('daily check-in validates input and does not accept account identifiers', () => {
  const result = validateCheckIn({
    recorded_at: '2026-10-05T08:15:00.000Z',
    feeling: 'fair',
    activity: 'walking',
    posture: 'standing',
    symptoms: ['fatigue'],
    sleep: {
      duration_minutes: 420,
      quality: 'good',
      bedtime: '22:30',
      wake_time: '05:30',
      disturbances: { woke_frequently: false },
    },
    symptom_severity: 4,
    stress_level: 2,
    hydration_ml: 500,
    medication_taken: true,
    medication_name: 'Medication X',
    medication_dosage: '1 tablet',
    medication_taken_at: '2026-10-05T07:30:00.000Z',
    lifestyle: { meal: true, caffeine: false, alcohol: false, smoking: false },
    measurements: { systolic_bp: 120, diastolic_bp: 80 },
  });
  assert.equal(result.feeling, 'fair');
  assert.equal(result.recorded_at.toISOString(), '2026-10-05T08:15:00.000Z');
  assert.equal(result.posture, 'standing');
  assert.equal(result.hydration_ml, 500);
  assert.equal(result.medication_name, 'Medication X');
  assert.deepEqual(result.sleep.disturbances, { woke_frequently: false });
  assert.equal(result.symptom_severity, 4);
  assert.deepEqual(result.lifestyle, {
    meal: true,
    caffeine: false,
    alcohol: false,
    smoking: false,
  });
  assert.equal(result.sleep.bedtime, '22:30');
  assert.equal(result.measurements.systolic_bp, 120);
  assert.throws(
    () => validateCheckIn({
      recorded_at: '2026-10-05T08:15:00.000Z',
      feeling: 'good',
      activity: 'rest',
      symptoms: [],
      sleep: { bedtime: '25:00' },
    }),
    { statusCode: 400 }
  );
  assert.throws(
    () => validateCheckIn({
      recorded_at: '2026-10-05T08:15:00.000Z',
      feeling: 'good',
      activity: 'rest',
      symptoms: [],
      sleep: {},
      account_id: 'another-user',
    }),
    { statusCode: 400 }
  );
  assert.throws(
    () => validateCheckIn({
      feeling: 'good',
      activity: 'rest',
      recorded_at: '2026-10-05T08:15:00.000Z',
      symptoms: [],
      sleep: {},
      measurements: { systolic_bp: 80, diastolic_bp: 100 },
    }),
    { statusCode: 400 }
  );
});

test('deviation follow-up answers require a segment reference and known patient-reported factors', () => {
  const base = {
    recorded_at: '2026-10-05T08:15:00.000Z',
    feeling: 'fair',
    activity: 'rest',
    symptoms: [],
    sleep: {},
  };
  const result = validateCheckIn({
    ...base,
    deviation_follow_up: {
      segment_id: '507f1f77bcf86cd799439011',
      perceived_factors: ['stress', 'poor_sleep'],
      symptom_onset: 'around_deviation',
      note: 'Kurang tidur semalam',
    },
  });
  assert.deepEqual(result.deviation_follow_up, {
    segment_id: '507f1f77bcf86cd799439011',
    perceived_factors: ['stress', 'poor_sleep'],
    symptom_onset: 'around_deviation',
    note: 'Kurang tidur semalam',
  });
  assert.throws(() => validateCheckIn({
    ...base,
    deviation_follow_up: {
      segment_id: 'not-a-valid-id',
      perceived_factors: [],
    },
  }), { statusCode: 400 });
  assert.throws(() => validateCheckIn({
    ...base,
    deviation_follow_up: {
      segment_id: '507f1f77bcf86cd799439011',
      perceived_factors: ['no_known_factor', 'stress'],
    },
  }), { statusCode: 400 });
});

test('patient event markers and wearable samples validate their source values', () => {
  const event = validatePatientEvent({
    event_type: 'medication',
    occurred_at: '2026-10-05T07:30:00.000Z',
    details: 'Obat pagi',
    value: '1 tablet',
    unit: 'tablet',
  });
  assert.equal(event.event_type, 'medication');
  assert.equal(event.details, 'Obat pagi');
  assert.equal(event.occurred_at.toISOString(), '2026-10-05T07:30:00.000Z');
  assert.equal(event.value, '1 tablet');
  assert.throws(
    () => validatePatientEvent({ event_type: 'unknown', occurred_at: '2026-10-05T07:30:00Z' }),
    { statusCode: 400 }
  );

  const sample = validateWearableSample({
    provider: 'apple_watch',
    device_id: 'watch-01',
    recorded_at: '2026-10-05T08:15:00.000Z',
    heart_rate_bpm: 72,
    rr_intervals_ms: Array(64).fill(830),
    acceleration_g: Array.from({ length: 10 }, () => [0, 0, 1]),
    sensor_contact: true,
    signal_confidence: 0.95,
    spo2_pct: 98,
    steps: 1200,
    activity: 'walking',
  });
  assert.equal(sample.provider, 'apple_watch');
  assert.equal(sample.heart_rate_bpm, 72);
  assert.equal(sample.rr_intervals_ms.length, 64);
  assert.equal(sample.acceleration_g.length, 10);
  assert.equal(sample.activity, 'walking');
  assert.equal(sample.device_id, 'watch-01');
  assert.throws(
    () => validateWearableSample({
      provider: 'polar_h10',
      device_id: 'watch-01',
      recorded_at: '2026-10-05T08:15:00.000Z',
      heart_rate_bpm: 72,
      rr_intervals_ms: Array(10).fill(830),
      acceleration_g: Array.from({ length: 10 }, () => [0, 0, 1]),
      sensor_contact: true,
      signal_confidence: 0.9,
    }),
    { statusCode: 400 }
  );
  assert.throws(
    () => validateWearableSample({ provider: 'garmin', rr_intervals_ms: Array(257).fill(800) }),
    { statusCode: 400 }
  );
  assert.throws(
    () => validateWearableSample({ provider: 'unknown', heart_rate_bpm: 72 }),
    { statusCode: 400 }
  );
});

test('Polar H10 streaming batches require authenticated-safe sensor provenance and valid readings', () => {
  const reading = {
    recorded_at: '2026-10-05T08:15:00.000Z',
    heart_rate_bpm: 72,
    rr_interval_ms: 830,
    acceleration_g: [0.02, -0.01, 0.98],
    sensor_contact: true,
    signal_confidence: 1,
  };
  const payload = {
    provider: 'polar_h10',
    device_id: 'polar-h10-01',
    activity: 'sitting',
    readings: [reading],
  };
  const result = validateWearableStream(payload);
  assert.equal(result.provider, 'polar_h10');
  assert.equal(result.device_id, 'polar-h10-01');
  assert.equal(result.readings[0].recorded_at.toISOString(), '2026-10-05T08:15:00.000Z');
  assert.equal(result.readings[0].rr_interval_ms, 830);
  assert.deepEqual(result.readings[0].acceleration_g, [0.02, -0.01, 0.98]);
  assert.throws(() => validateWearableStream({ ...payload, user_id: 'another-user' }), { statusCode: 400 });
  assert.throws(() => validateWearableStream({ ...payload, readings: [] }), { statusCode: 400 });
  assert.throws(() => validateWearableStream({ ...payload, readings: Array(101).fill(reading) }), { statusCode: 400 });
  assert.throws(() => validateWearableStream({
    ...payload,
    readings: [{ ...reading, recorded_at: 'invalid-time' }],
  }), { statusCode: 400 });
  assert.throws(() => validateWearableStream({
    ...payload,
    readings: [{ ...reading, heart_rate_bpm: 251 }],
  }), { statusCode: 400 });
  assert.throws(() => validateWearableStream({
    ...payload,
    readings: [{ ...reading, rr_interval_ms: 2200 }],
  }), { statusCode: 400 });
  assert.throws(() => validateWearableStream({
    ...payload,
    readings: [{ ...reading, acceleration_g: [0, 0, 17] }],
  }), { statusCode: 400 });
  assert.throws(() => validateWearableStream({
    ...payload,
    readings: [{ ...reading, sensor_contact: false }],
  }), { statusCode: 400 });
});

test('check-in query bounds pagination and validates date ranges', () => {
  assert.deepEqual(
    validateCheckInQuery({ limit: '20', from: '2026-01-01T00:00:00.000Z' }),
    { limit: 20, from: new Date('2026-01-01T00:00:00.000Z') }
  );
  assert.throws(() => validateCheckInQuery({ limit: '500' }), { statusCode: 400 });
  assert.throws(
    () => validateCheckInQuery({ from: '2026-02-01', to: '2026-01-01' }),
    { statusCode: 400 }
  );
});

test('wearable history requires a bounded date range and supported chart interval', () => {
  assert.deepEqual(
    validateWearableHistoryQuery({
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-08T00:00:00.000Z',
    }),
    {
      from: new Date('2026-10-01T00:00:00.000Z'),
      to: new Date('2026-10-08T00:00:00.000Z'),
      bucketMinutes: 60,
    }
  );
  assert.equal(validateWearableHistoryQuery({
    from: '2026-10-01T00:00:00.000Z',
    to: '2026-10-02T00:00:00.000Z',
    bucket_minutes: '15',
  }).bucketMinutes, 15);
  assert.throws(
    () => validateWearableHistoryQuery({
      from: '2026-10-08T00:00:00.000Z',
      to: '2026-10-01T00:00:00.000Z',
    }),
    { statusCode: 400 }
  );
  assert.throws(
    () => validateWearableHistoryQuery({
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-10-08T00:00:00.000Z',
    }),
    { statusCode: 400 }
  );
  assert.throws(
    () => validateWearableHistoryQuery({
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-02T00:00:00.000Z',
      bucket_minutes: '10',
    }),
    { statusCode: 400 }
  );
});
