import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPatientAppDemoSampleOperations,
  buildPolarDataDocuments,
  buildTransportEnvelope,
  publishLogTransport,
} from '../utils/logTransport.js';
import PatientAppWearableSample from '../models/patient_app_wearable_sample.model.js';
import PolarData from '../models/data.model.js';
import { calculateRollingRmssd } from '../utils/polarRmssd.js';

test('buildTransportEnvelope normalizes sensor payload for backend transport', () => {
  const envelope = buildTransportEnvelope({
    user_id: 'user123',
    source: 'polar_ble',
    device_id: 'polar-01',
    readings: [{
      timestamp: 1710000000,
      heart_rate: 72,
      rr_interval: 910,
      motion_state: 'Berjalan',
      battery: 89,
      signal_quality: 92,
      rmssd: 44.1,
      dfa_alpha1: 0.82,
    }],
  });

  assert.equal(envelope.user_id, 'user123');
  assert.equal(envelope.source, 'polar_ble');
  assert.equal(envelope.device_id, 'polar-01');
  assert.equal(envelope.readings[0].heart_rate, 72);
  assert.equal(envelope.readings[0].activity, 'Berjalan');
  assert.equal(envelope.readings[0].rr_interval, 910);
});

test('buildTransportEnvelope retains the simulated-data marker', () => {
  const envelope = buildTransportEnvelope({
    user_id: 'user123',
    source: 'patient_app_polar_ble_demo',
    is_simulated: true,
    device_id: 'VIDYAMEDIC-DEMO',
    readings: [{
      timestamp: 1710000000,
      heart_rate: 72,
      rr_interval: 830,
      is_simulated: true,
    }],
  });

  assert.equal(envelope.is_simulated, true);
  assert.equal(envelope.readings[0].is_simulated, true);
});

test('patient app real stream builds Mongo PolarData docs with pending pipeline status', async () => {
  const accountId = new PolarData.base.Types.ObjectId();
  const envelope = buildTransportEnvelope({
    user_id: accountId.toString(),
    account_type: 'user',
    provider: 'polar_h10',
    source: 'patient_app_polar_ble',
    device_id: 'polar-h10-01',
    readings: [
      {
        timestamp: 1792857600.25,
        heart_rate: 78,
        rr_interval: 769,
        activity: 'Berjalan',
        acc_x: 0.1,
        acc_y: -0.2,
        acc_z: 1,
      },
      {
        timestamp: 1792857600.95,
        heart_rate: 79,
        rr_interval: 761,
        activity: 'Berjalan',
        acc_x: 0.1,
        acc_y: -0.2,
        acc_z: 1,
      },
      {
        timestamp: 1792857601,
        heart_rate: 20,
        rr_interval: 769,
      },
    ],
  });

  const documents = buildPolarDataDocuments(envelope, accountId);
  assert.equal(documents.length, 2);
  assert.notEqual(documents[0].timestamp, documents[1].timestamp);
  const document = new PolarData(documents[0]);
  await document.validate();
  assert.equal(document.user_id.toString(), accountId.toString());
  assert.equal(document.timestamp, 1792857600.25);
  assert.equal(document.hr, 78);
  assert.equal(document.rr, 769);
  assert.equal(document.device_id, 'polar-h10-01');
  assert.equal(document.processStatus, 'PENDING');
  assert.equal(document.isChecked, false);
});

test('PolarData stream derives rolling RRMS from neighboring RR intervals', () => {
  const accountId = new PolarData.base.Types.ObjectId();
  const baseTimestamp = 1792857600;
  const envelope = buildTransportEnvelope({
    user_id: accountId.toString(),
    device_id: 'polar-h10-01',
    readings: [
      { timestamp: baseTimestamp, heart_rate: 75, rr_interval: 800, activity: 'Duduk' },
      { timestamp: baseTimestamp + 1, heart_rate: 74, rr_interval: 810, activity: 'Duduk' },
      { timestamp: baseTimestamp + 2, heart_rate: 73, rr_interval: 830, activity: 'Duduk' },
    ],
  });

  const documents = buildPolarDataDocuments(envelope, accountId);
  assert.equal(documents[0].rrms, null);
  assert.equal(documents[1].rrms, 10);
  assert.equal(documents[2].rrms, 15.81);

  envelope.readings[1].rmssd = 0;
  assert.equal(buildPolarDataDocuments(envelope, accountId)[1].rrms, 0);
  envelope.readings[1].rmssd = null;

  const withPrior = buildPolarDataDocuments(
    envelope,
    accountId,
    [{ timestamp: baseTimestamp - 1, rr_interval: 790, activity: 'Duduk' }]
  );
  assert.equal(withPrior[0].rrms, 10);
});

test('rolling RMSSD resets after activity changes and long gaps', () => {
  const timestamp = 1710000000;
  const rmssd = calculateRollingRmssd([
    { timestamp, rr_interval: 800, activity: 'Duduk' },
    { timestamp: timestamp + 1, rr_interval: 810, activity: 'Duduk' },
    { timestamp: timestamp + 40, rr_interval: 820, activity: 'Duduk' },
    { timestamp: timestamp + 41, rr_interval: 830, activity: 'Duduk' },
    { timestamp: timestamp + 42, rr_interval: 840, activity: 'Berjalan' },
  ]);
  assert.deepEqual(rmssd, [null, 10, null, 10, null]);
});

test('patient app demo stream is excluded from clinical PolarData', () => {
  const envelope = buildTransportEnvelope({
    user_id: new PolarData.base.Types.ObjectId().toString(),
    is_simulated: true,
    readings: [{
      timestamp: 1792857600,
      heart_rate: 78,
      rr_interval: 769,
    }],
  });
  assert.deepEqual(buildPolarDataDocuments(envelope), []);
});

test('patient app demo transport creates idempotent non-clinical Mongo samples', async () => {
  const accountId = new PatientAppWearableSample.base.Types.ObjectId().toString();
  const envelope = buildTransportEnvelope({
    user_id: accountId,
    account_type: 'user',
    provider: 'other',
    source: 'patient_app_polar_ble_demo',
    is_simulated: true,
    device_id: 'VIDYAMEDIC-DEMO',
    readings: [{
      timestamp: 1710000000,
      heart_rate: 84,
      rr_interval: 714,
      activity: 'Berdiri',
      signal_quality: 0.9,
      acc_x: 0.1,
      acc_y: -0.2,
      acc_z: 1,
      is_simulated: true,
    }],
  });

  const operations = buildPatientAppDemoSampleOperations(envelope);
  assert.equal(operations.length, 1);
  const operation = operations[0].updateOne;
  const sample = new PatientAppWearableSample(operation.update.$setOnInsert);
  await sample.validate();
  assert.equal(sample.account_id.toString(), accountId);
  assert.equal(sample.account_type, 'user');
  assert.equal(sample.provider, 'other');
  assert.equal(sample.is_simulated, true);
  assert.equal(sample.ingestion_source, 'rabbitmq_stream');
  assert.equal(sample.posture, 'standing');
  assert.equal(sample.activity, 'standing');
  assert.deepEqual(sample.data_quality.reasons, ['simulated_sensor_data']);
  assert.equal(operation.upsert, true);
  assert.equal('createdAt' in operation.update.$setOnInsert, false);
  assert.equal('updatedAt' in operation.update.$setOnInsert, false);
  assert.equal(operation.filter.recorded_at.toISOString(), sample.recorded_at.toISOString());
});

test('patient app demo persistence rejects missing or invalid account scope', () => {
  assert.throws(
    () => buildPatientAppDemoSampleOperations({
      user_id: 'not-an-object-id',
      account_type: 'user',
      readings: [],
    }),
    /missing a valid account scope/
  );
});

test('publishLogTransport invokes publishFn if provided', async () => {
  let called = false;
  let dataPassed = null;
  const result = await publishLogTransport({
    user_id: 'user123',
    readings: [{ heart_rate: 80 }]
  }, async (envelope) => {
    called = true;
    dataPassed = envelope;
    return true;
  });

  assert.equal(called, true);
  assert.equal(result.published, true);
  assert.equal(dataPassed.user_id, 'user123');
});
