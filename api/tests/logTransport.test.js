import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTransportEnvelope, publishLogTransport } from '../utils/logTransport.js';

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
