import test from 'node:test';
import assert from 'node:assert/strict';
import { saveDoctorCaparDynamicProfile } from '../controllers/doctorCaparVisualization.controller.js';

function makeResponse() {
  return {
    statusCode: 200,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('dynamic profile persistence rejects demo data before any Mongo write', async () => {
  const res = makeResponse();
  await saveDoctorCaparDynamicProfile({
    body: {
      patient_id: '507f1f77bcf86cd799439011',
      scope: 'day',
      date: '2026-11-18',
      activity: 'all',
      profile: {
        source: 'demo',
        scope: 'day',
        graph: { nodes: [], edges: [] },
        model: {},
        history: [],
      },
    },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Payload dynamic profile tidak valid/);
});

test('dynamic profile persistence rejects oversized history before any Mongo write', async () => {
  const res = makeResponse();
  await saveDoctorCaparDynamicProfile({
    body: {
      patient_id: '507f1f77bcf86cd799439011',
      scope: 'person',
      activity: 'all',
      profile: {
        source: 'mongo',
        scope: 'person',
        graph: { nodes: [], edges: [] },
        model: {},
        history: Array.from({ length: 366 }, () => ({})),
      },
    },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Payload dynamic profile tidak valid/);
});
