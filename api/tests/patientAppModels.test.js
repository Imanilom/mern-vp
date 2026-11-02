import test from 'node:test';
import assert from 'node:assert/strict';
import PatientAppCheckIn from '../models/patient_app_checkin.model.js';
import PatientAppEvent from '../models/patient_app_event.model.js';
import PatientAppAction from '../models/patient_app_action.model.js';
import PatientAppProfile from '../models/patient_app_profile.model.js';
import PatientAppWearableSample from '../models/patient_app_wearable_sample.model.js';
import PatientHilExplanation from '../models/patient_hil_explanation.model.js';
import PatientHilBaseline from '../models/patient_hil_baseline.model.js';
import PatientHilScenarioLog from '../models/patient_hil_scenario_log.model.js';
import PatientHilRealtimeEvaluation from '../models/patient_hil_realtime_evaluation.model.js';
import PatientHilSession from '../models/patient_hil_session.model.js';
import PatientGamificationProfile from '../models/patient_gamification_profile.model.js';
import PatientRecordingCoin from '../models/patient_recording_coin.model.js';
import PatientScenarioEvent from '../models/patient_scenario_event.model.js';
import PatientScenarioQuestionnaire from '../models/patient_scenario_questionnaire.model.js';
import PatientScenarioSession from '../models/patient_scenario_session.model.js';
import Patient from '../models/patient.model.js';
import User from '../models/user.model.js';

test('legacy Patient records can be linked to one canonical CAPAR User', () => {
  assert.ok(Patient.schema.path('user_id'));
  assert.equal(Patient.schema.path('user_id').options.ref, 'User');
  const linkIndex = Patient.schema.indexes().find(([keys, options]) => (
    keys.user_id === 1 && options.unique && options.partialFilterExpression
  ));
  assert.ok(linkIndex);
});

test('User exposes the one-to-one patient profile extension', () => {
  const virtual = User.schema.virtuals.patient_profile;
  assert.ok(virtual);
  assert.equal(virtual.options.ref, 'PatientAppProfile');
  assert.equal(virtual.options.localField, '_id');
  assert.equal(virtual.options.foreignField, 'account_id');
  assert.deepEqual(virtual.options.match, { account_type: 'user' });
});

test('User generates a non-null unique GUID when one is omitted', () => {
  const first = new User({
    name: 'First User',
    email: 'first@example.com',
    password: 'hashed-password',
    phone_number: '000000',
  });
  const second = new User({
    name: 'Second User',
    email: 'second@example.com',
    password: 'hashed-password',
    phone_number: '000000',
  });

  assert.match(first.guid, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.match(second.guid, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.notEqual(first.guid, second.guid);
});

test('patient check-in, events, and wearable schemas retain patient provenance', () => {
  for (const model of [PatientAppProfile, PatientAppCheckIn, PatientAppEvent, PatientAppWearableSample]) {
    assert.ok(model.schema.path('account_id'));
    assert.ok(model.schema.path('account_type'));
    assert.deepEqual(model.schema.path('account_type').enumValues, ['user', 'patient']);
  }
  assert.ok(
    PatientAppWearableSample.schema
      .path('ingestion_source')
      .enumValues.includes('rabbitmq_stream')
  );
  assert.deepEqual(
    PatientAppWearableSample.schema.path('recording_purpose').enumValues,
    ['standard', 'hil_baseline']
  );
  assert.equal(
    PatientAppWearableSample.schema.path('recording_purpose').options.default,
    'standard'
  );
  assert.ok(PatientAppWearableSample.schema.path('motion_index'));
  assert.ok(PatientAppEvent.schema.path('run_id'));
  assert.ok(PatientAppWearableSample.schema.indexes().some(([keys, options]) => (
    keys.account_id === 1
    && keys.account_type === 1
    && keys.device_id === 1
    && keys.recorded_at === 1
    && options.unique === true
    && options.partialFilterExpression?.is_simulated === true
  )));
});

test('gamification models scope pseudonyms and award one coin per local date', async () => {
  assert.ok(PatientGamificationProfile.schema.path('account_id'));
  assert.ok(PatientGamificationProfile.schema.path('leaderboard_opt_in'));
  assert.ok(PatientGamificationProfile.schema.path('location_opt_in'));
  assert.ok(PatientGamificationProfile.schema.path('location.coordinates'));
  assert.ok(PatientRecordingCoin.schema.path('recording_date'));
  assert.ok(PatientRecordingCoin.schema.path('sample_id'));
  assert.ok(PatientRecordingCoin.schema.indexes().some(([keys, options]) => (
    keys.account_id === 1
    && keys.account_type === 1
    && keys.recording_date === 1
    && options.unique === true
  )));
  const profile = new PatientGamificationProfile({
    account_id: new PatientGamificationProfile.base.Types.ObjectId(),
    account_type: 'user',
    nickname: 'TemanSehat',
    location_opt_in: true,
    location: { type: 'Point', coordinates: [106.8, -6.2] },
  });
  await profile.validate();
  assert.deepEqual(profile.location.coordinates, [106.8, -6.2]);
});

test('patient action schema stores scoped records and auditable lifecycle states', () => {
  assert.ok(PatientAppAction.schema.path('account_id'));
  assert.deepEqual(
    PatientAppAction.schema.path('account_type').enumValues,
    ['user', 'patient']
  );
  assert.deepEqual(
    PatientAppAction.schema.path('status').enumValues,
    ['CREATED', 'DELIVERED', 'ACKNOWLEDGED', 'COMPLETED', 'FAILED']
  );
  assert.ok(PatientAppAction.schema.path('status_history'));
});

test('scenario sessions retain versioned interpretations and explicit consent', () => {
  assert.ok(PatientScenarioSession.schema.path('account_id'));
  assert.ok(PatientScenarioSession.schema.path('participant_pseudonym'));
  assert.ok(PatientScenarioSession.schema.path('consent.given'));
  assert.ok(PatientScenarioSession.schema.path('current_interpretation_version'));
  assert.ok(PatientScenarioSession.schema.path('interpretations'));
  assert.deepEqual(
    PatientScenarioSession.schema.path('scenario_id').enumValues,
    ['a', 'b', 'c']
  );
  assert.ok(
    PatientScenarioSession.schema.path('source').enumValues.includes(
      'RECORDED_POLAR_SAMPLE'
    )
  );
});

test('scenario events are scoped and deduplicated per session', () => {
  assert.ok(PatientScenarioEvent.schema.path('account_id'));
  assert.ok(PatientScenarioEvent.schema.path('session_id'));
  assert.ok(PatientScenarioEvent.schema.path('idempotency_key'));
  const idempotencyIndex = PatientScenarioEvent.schema.indexes().find(
    ([keys, options]) => (
      keys.session_id === 1
      && keys.idempotency_key === 1
      && options.unique === true
    )
  );
  assert.ok(idempotencyIndex);
});

test('scenario questionnaires are scoped and unique per session and instrument', () => {
  assert.ok(PatientScenarioQuestionnaire.schema.path('account_id'));
  assert.ok(PatientScenarioQuestionnaire.schema.path('session_id'));
  assert.ok(PatientScenarioQuestionnaire.schema.path('responses'));
  assert.deepEqual(
    PatientScenarioQuestionnaire.schema.path('instrument').enumValues,
    ['SUS', 'NASA_TLX']
  );
  const uniqueIndex = PatientScenarioQuestionnaire.schema.indexes().find(
    ([keys, options]) => (
      keys.session_id === 1
      && keys.instrument === 1
      && options.unique === true
    )
  );
  assert.ok(uniqueIndex);
});

test('HIL explanations use a separate account-scoped collection', () => {
  assert.equal(PatientHilExplanation.collection.collectionName, 'patient_hil_explanations');
  assert.ok(PatientHilExplanation.schema.path('account_id'));
  assert.ok(PatientHilExplanation.schema.path('session_id'));
  assert.ok(PatientHilExplanation.schema.path('explanation'));
  assert.deepEqual(
    PatientHilExplanation.schema.path('scenario').enumValues,
    ['B', 'C']
  );
  assert.ok(PatientHilExplanation.schema.indexes().some(([keys]) => (
    keys.account_id === 1
    && keys.account_type === 1
    && keys.createdAt === -1
  )));
});

test('HIL sessions scope repeatable runs without merging them into the profile', async () => {
  assert.equal(PatientHilSession.collection.collectionName, 'patient_hil_sessions');
  assert.ok(PatientHilSession.schema.path('run_id'));
  assert.ok(PatientHilSession.schema.path('scenario'));
  assert.ok(PatientHilSession.schema.path('source'));
  assert.ok(PatientHilSession.schema.path('status'));
  assert.ok(PatientHilSession.schema.path('last_activity_at'));
  assert.ok(PatientHilSession.schema.indexes().some(([keys, options]) => (
    keys.account_id === 1
    && keys.account_type === 1
    && keys.run_id === 1
    && options.unique === true
  )));
  const sessionId = new PatientHilSession.base.Types.ObjectId();
  const session = new PatientHilSession({
    _id: sessionId,
    account_id: new PatientHilSession.base.Types.ObjectId(),
    account_type: 'user',
    run_id: 'hil-live-1793508969984',
    scenario: 'C',
    source: 'realtime_wearable',
    activity: 'sitting',
  });
  await session.validate();
});

test('HIL baseline windows are isolated from CAPAR baseline documents', () => {
  assert.equal(PatientHilBaseline.collection.collectionName, 'patient_hil_baselines');
  assert.ok(PatientHilBaseline.schema.path('sample_id'));
  assert.ok(PatientHilBaseline.schema.path('window_start'));
  assert.deepEqual(
    PatientHilBaseline.schema.path('recording_purpose').enumValues,
    ['hil_baseline']
  );
  assert.deepEqual(
    PatientHilBaseline.schema.path('activity').enumValues,
    ['sitting', 'standing', 'walking']
  );
  assert.ok(PatientHilBaseline.schema.indexes().some(([keys, options]) => (
    keys.account_id === 1
    && keys.account_type === 1
    && keys.activity === 1
    && keys.window_start === 1
    && options.unique === true
  )));
});

test('HIL scenario paper logs are append-only and account-scoped', () => {
  assert.equal(
    PatientHilScenarioLog.collection.collectionName,
    'patient_hil_scenario_logs'
  );
  assert.ok(PatientHilScenarioLog.schema.path('run_id'));
  assert.ok(PatientHilScenarioLog.schema.path('session_id'));
  assert.ok(PatientHilScenarioLog.schema.path('event_type'));
  assert.ok(
    PatientHilScenarioLog.schema.path('event_type').enumValues.includes(
      'zero_shot_failed'
    )
  );
  assert.ok(PatientHilScenarioLog.schema.path('history'));
  assert.ok(PatientHilScenarioLog.schema.path('clarification'));
  assert.ok(PatientHilScenarioLog.schema.path('explanation'));
  assert.ok(PatientHilScenarioLog.schema.indexes().some(([keys]) => (
    keys.account_id === 1
    && keys.account_type === 1
    && keys.run_id === 1
    && keys.createdAt === 1
  )));
});

test('HIL realtime evaluations persist scoped readings and analysis separately', async () => {
  assert.equal(
    PatientHilRealtimeEvaluation.collection.collectionName,
    'patient_hil_realtime_evaluations'
  );
  assert.ok(PatientHilRealtimeEvaluation.schema.path('readings'));
  assert.ok(PatientHilRealtimeEvaluation.schema.path('analysis'));
  assert.ok(PatientHilRealtimeEvaluation.schema.path('session_id'));
  assert.ok(PatientHilRealtimeEvaluation.schema.indexes().some(([keys]) => (
    keys.account_id === 1
    && keys.account_type === 1
    && keys.run_id === 1
    && keys.evaluated_at === 1
  )));
  const evaluation = new PatientHilRealtimeEvaluation({
    account_id: new PatientHilRealtimeEvaluation.base.Types.ObjectId(),
    account_type: 'user',
    session_id: new PatientHilRealtimeEvaluation.base.Types.ObjectId(),
    run_id: 'hil-live-1793508969984',
    activity: 'sitting',
    device_id: 'polar-h10-01',
    evaluation_kind: 'hr_window',
    evaluated_at: new Date(),
    readings: [{
      recorded_at: new Date(),
      heart_rate_bpm: 72,
      rr_interval_ms: 830,
      acceleration_g: [0, 0, 1],
      sensor_contact: true,
      signal_confidence: 0.9,
    }],
    analysis: { interpretation: { status: 'normal' } },
  });
  await evaluation.validate();
});
