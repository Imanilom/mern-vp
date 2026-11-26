import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCaparTemporalTimeline,
  buildTemporalEdges,
} from '../utils/caparTemporalTimeline.js';

const accountId = 'patient-account';
const start = Date.parse('2026-11-25T01:00:00.000Z');

test('temporal anchors preserve sources and infer signal gaps without claiming device removal', () => {
  const timeline = buildCaparTemporalTimeline({
    accountId,
    rows: [
      { _id: 'row-1', device_id: 'polar-1', timestamp: start, activity: 'Duduk' },
      { _id: 'row-2', device_id: 'polar-1', timestamp: start + 7 * 60_000, activity: 'Berjalan' },
    ],
    wearableSamples: [
      {
        _id: 'sample-1',
        device_id: 'polar-1',
        recorded_at: new Date(start),
        sensor_contact: true,
        signal_confidence: 0.9,
      },
      {
        _id: 'sample-2',
        device_id: 'polar-1',
        recorded_at: new Date(start + 60_000),
        sensor_contact: false,
        signal_confidence: 0.1,
      },
    ],
  });

  assert.ok(timeline.anchors.some((anchor) => (
    anchor.anchor_type === 'SIGNAL_LOST'
    && anchor.inferred
    && anchor.source === 'row_timestamp_gap'
  )));
  assert.ok(timeline.anchors.some((anchor) => (
    anchor.anchor_type === 'DEVICE_WORN'
    && anchor.source === 'PatientAppWearableSample.sensor_contact'
    && anchor.related_entity_id === 'sample-1'
  )));
  assert.ok(!timeline.anchors.some((anchor) => anchor.anchor_type === 'DEVICE_REMOVED'));
  assert.ok(timeline.device_sessions.some((session) => session.status === 'signal_gap_inferred'));
  assert.ok(timeline.anchors.every((anchor) => anchor.user_id === accountId));
});

test('sensor contact transitions show contact lost and worn again only at evidence boundaries', () => {
  const timeline = buildCaparTemporalTimeline({
    accountId,
    wearableSamples: [
      { _id: 'a', device_id: 'polar-1', recorded_at: new Date(start), sensor_contact: true },
      { _id: 'b', device_id: 'polar-1', recorded_at: new Date(start + 10_000), sensor_contact: true },
      { _id: 'c', device_id: 'polar-1', recorded_at: new Date(start + 20_000), sensor_contact: false },
      { _id: 'd', device_id: 'polar-1', recorded_at: new Date(start + 30_000), sensor_contact: true },
    ],
  });

  assert.deepEqual(
    timeline.anchors
      .filter((anchor) => ['DEVICE_WORN', 'DEVICE_WORN_AGAIN'].includes(anchor.anchor_type))
      .map((anchor) => anchor.anchor_type),
    ['DEVICE_WORN', 'DEVICE_WORN_AGAIN'],
  );
  assert.ok(timeline.anchors.some((anchor) => (
    anchor.anchor_type === 'SIGNAL_LOST'
    && anchor.source === 'PatientAppWearableSample.sensor_contact'
    && !anchor.inferred
  )));
});

test('temporal edges expose predecessor, successor, activity change, and metric direction', () => {
  const nodes = [
    { id: 'later', timestamp: start + 60_000, activity: 'Jalan', hr: 100 },
    { id: 'earlier', timestamp: start, activity: 'Duduk', hr: 70 },
    { id: 'last', timestamp: start + 120_000, activity: 'Jalan', hr: 95 },
  ];
  const edges = buildTemporalEdges(nodes, {
    getTime: (node) => node.timestamp,
    getActivity: (node) => node.activity,
    getMetric: (node) => node.hr,
    getId: (node) => node.id,
  });

  assert.deepEqual(edges.map((edge) => edge.node_id), ['earlier', 'later', 'last']);
  assert.deepEqual(edges.map((edge) => edge.successor_id), ['later', 'last', null]);
  assert.deepEqual(edges.map((edge) => edge.metric_direction), ['unavailable', 'rising', 'falling']);
  assert.equal(edges[1].activity_changed, true);
});
