import test from 'node:test';
import assert from 'node:assert/strict';
import PatientAppCheckIn from '../models/patient_app_checkin.model.js';
import PatientAppEvent from '../models/patient_app_event.model.js';
import PatientAppAction from '../models/patient_app_action.model.js';
import PatientAppProfile from '../models/patient_app_profile.model.js';
import PatientAppWearableSample from '../models/patient_app_wearable_sample.model.js';
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
