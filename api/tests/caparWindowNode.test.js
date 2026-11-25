import test from 'node:test';
import assert from 'node:assert/strict';
import CaparWindowNode from '../models/capar_window_node.model.js';

test('CAPAR window nodes keep a unique source-window reference and patient snapshot', () => {
  assert.equal(CaparWindowNode.collection.collectionName, 'capar_window_nodes');
  assert.equal(CaparWindowNode.schema.path('segment_id').options.unique, true);
  assert.equal(CaparWindowNode.schema.path('account_id').options.ref, 'User');
  assert.equal(CaparWindowNode.schema.path('segment_id').options.ref, 'Segment');
  assert.ok(CaparWindowNode.schema.path('created_by'));
  assert.ok(CaparWindowNode.schema.path('window_start'));
  assert.ok(CaparWindowNode.schema.path('window_end'));
  assert.ok(CaparWindowNode.schema.path('features.rmssd'));
  assert.equal(CaparWindowNode.schema.path('rr_raw'), undefined);
});

test('CAPAR window nodes reject invalid window types', async () => {
  const node = new CaparWindowNode({
    account_id: new CaparWindowNode.base.Types.ObjectId(),
    segment_id: new CaparWindowNode.base.Types.ObjectId(),
    created_by: new CaparWindowNode.base.Types.ObjectId(),
    window_start: 1000,
    window_end: 2000,
    window_type: '10min',
  });

  await assert.rejects(node.validate(), (error) => (
    error.errors.window_type?.kind === 'enum'
  ));
});
