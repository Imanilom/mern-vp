import test from 'node:test';
import assert from 'node:assert/strict';
import PatientAppCheckIn from '../models/patient_app_checkin.model.js';
import PatientAppEvent from '../models/patient_app_event.model.js';
import PatientAppProfile from '../models/patient_app_profile.model.js';
import PatientAppWearableSample from '../models/patient_app_wearable_sample.model.js';
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

test('patient check-in, events, and wearable schemas retain patient provenance', () => {
  for (const model of [PatientAppProfile, PatientAppCheckIn, PatientAppEvent, PatientAppWearableSample]) {
    assert.ok(model.schema.path('account_id'));
    assert.ok(model.schema.path('account_type'));
    assert.deepEqual(model.schema.path('account_type').enumValues, ['user', 'patient']);
  }
});
