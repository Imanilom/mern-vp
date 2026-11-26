import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdjacencyList,
  findGraphPath,
  getGraphNeighbors,
  getWeaklyConnectedComponents,
  isGraphReachable,
  projectCaparGraph,
  traverseGraph,
} from './caparGraph.js';

const graph = createAdjacencyList(
  [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'isolated' }],
  [
    { id: 'ab', source: 'a', target: 'b', type: 'NEXT', weight: 2 },
    { id: 'bc', source: 'b', target: 'c', type: 'NEXT', weight: 3 },
    { id: 'ac', source: 'a', target: 'c', type: 'ASSOCIATED_WITH', weight: null },
  ],
);

test('adjacency list retains incoming and outgoing directed relationships', () => {
  assert.deepEqual(getGraphNeighbors(graph, 'b', 'incoming').map(({ node }) => node.id), ['a']);
  assert.deepEqual(getGraphNeighbors(graph, 'b', 'outgoing').map(({ node }) => node.id), ['c']);
});

test('BFS and DFS traverse only outgoing edges and respect edge filters', () => {
  assert.deepEqual(traverseGraph(graph, 'a', 'bfs'), ['a', 'b', 'c']);
  assert.deepEqual(traverseGraph(graph, 'a', 'dfs', ['NEXT']), ['a', 'b', 'c']);
  assert.deepEqual(traverseGraph(graph, 'a', 'bfs', []), ['a']);
  assert.equal(isGraphReachable(graph, 'a', 'c', ['NEXT']), true);
  assert.equal(isGraphReachable(graph, 'a', 'c', []), false);
  assert.equal(isGraphReachable(graph, 'c', 'a'), false);
});

test('shortest paths support hop count and explicit non-negative weights', () => {
  assert.deepEqual(findGraphPath(graph, 'a', 'c'), {
    nodeIds: ['a', 'c'],
    edgeIds: ['ac'],
    totalWeight: 0,
  });
  assert.deepEqual(findGraphPath(graph, 'a', 'c', { weighted: true }), {
    nodeIds: ['a', 'b', 'c'],
    edgeIds: ['ab', 'bc'],
    totalWeight: 5,
  });
  assert.equal(findGraphPath(graph, 'c', 'a'), null);
});

test('weak components include isolated vertices without implying directed reachability', () => {
  assert.deepEqual(getWeaklyConnectedComponents(graph), [['a', 'b', 'c'], ['isolated']]);
});

test('graph construction rejects duplicate ids and missing edge endpoints', () => {
  assert.throws(() => createAdjacencyList([{ id: 'a' }, { id: 'a' }]), /Duplicate graph node id/);
  assert.throws(() => createAdjacencyList([{ id: 'a' }], [
    { id: 'bad', source: 'a', target: 'missing', type: 'NEXT' },
  ]), /references a missing node/);
});

test('CAPAR projection keeps metrics as node attributes and links source-backed entities', () => {
  const projected = projectCaparGraph({
    patient: { _id: 'p1', name: 'P01' },
    rows: [
      {
        _id: 'r1',
        source_id: 'r1',
        source_collection: 'PolarData',
        timestamp_ms: 1_798_000_000_000,
        hr: 75,
        rr: 800,
        activity: 'Duduk',
        device_id: 'watch-1',
        parent_window_id: 'w1',
        parent_relation_source: 'timestamp_overlap',
      },
      {
        _id: 'r2',
        source_id: 'r2',
        source_collection: 'PolarData',
        timestamp_ms: 1_798_000_180_000,
        hr: 83,
        rr: 810,
        activity: 'Duduk',
        device_id: 'watch-1',
      },
    ],
    windows: [{
      _id: 'w1',
      window_start: 1_798_000_000_000,
      window_end: 1_798_000_300_000,
      activity_label: 'Duduk',
      device_id: 'watch-1',
      raw_count: 2,
      features: { mean_hr: 79 },
    }],
    activities: [{
      _id: 'a1',
      episode_key: 'activity-1',
      activity_label: 'Duduk',
      episode_start: 1_798_000_000_000,
      episode_end: 1_798_000_300_000,
      device_id: 'watch-1',
      source_segment_ids: ['w1'],
      summary: { window_count: 1 },
    }],
    episodes: [{
      _id: 'e1',
      onset_time: 1_798_000_010_000,
      recovered_at: 1_798_000_200_000,
      classification: 'Caution',
      device_id: 'watch-1',
      segment_ids: ['w1'],
    }],
    anchors: [{
      anchor_id: 'event-1',
      timestamp: 1_798_000_000_000,
      device_id: 'watch-1',
      anchor_type: 'DEVICE_WORN',
      source: 'PatientAppWearableSample.sensor_contact',
      confidence: 1,
      inferred: false,
    }],
  });

  const raw = projected.nodeById.get('raw:PolarData:r1');
  assert.equal(raw.type, 'RAW_DATA');
  assert.equal(raw.properties.hr, 75);
  assert.equal(projected.nodeById.has('hr:75'), false);
  assert.ok(projected.edgeById.has('NEXT:raw:PolarData:r1->raw:PolarData:r2'));
  assert.ok(projected.edgeById.has('HAS_RAW_DATA:window:w1->raw:PolarData:r1'));
  assert.ok(projected.edgeById.has('HAS_WINDOW:activity:activity-1->window:w1'));
  assert.ok(projected.edgeById.has('ASSOCIATED_WITH:activity:activity-1->episode:e1'));
  assert.equal(
    projected.edges.find((edge) => edge.id === 'NEXT:raw:PolarData:r1->raw:PolarData:r2').weight,
    180,
  );
  assert.equal(projected.nodes.find((node) => node.id === 'event:event-1').properties.inferred, false);
  assert.equal(projected.nodes.some((node) => node.label === 'DEVICE_REMOVED'), false);
});
