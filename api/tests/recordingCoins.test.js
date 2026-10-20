import test from 'node:test';
import assert from 'node:assert/strict';
import {
  awardRecordingDayCoin,
  isCoinEligibleRecording,
  localRecordingDate,
} from '../utils/recordingCoins.js';

const acceptedSample = {
  _id: 'sample-1',
  is_simulated: false,
  sensor_contact: true,
  data_quality: { status: 'accepted' },
  rr_intervals_ms: [800, 810],
  recorded_at: new Date('2026-01-01T01:00:00.000Z'),
};

test('recording day uses the account timezone', () => {
  assert.equal(localRecordingDate(acceptedSample.recorded_at, 'Asia/Jakarta'), '2026-01-01');
  assert.equal(localRecordingDate(acceptedSample.recorded_at, 'America/Los_Angeles'), '2025-12-31');
});

test('real sensor recordings with contact and RR data earn coins', () => {
  assert.equal(isCoinEligibleRecording(acceptedSample), true);
  assert.equal(isCoinEligibleRecording({ ...acceptedSample, is_simulated: true }), false);
  assert.equal(isCoinEligibleRecording({ ...acceptedSample, sensor_contact: false }), false);
  assert.equal(isCoinEligibleRecording({
    ...acceptedSample,
    data_quality: { status: 'warning' },
  }), true);
  assert.equal(isCoinEligibleRecording({ ...acceptedSample, rr_intervals_ms: [] }), false);
});

test('coin award is idempotent for an account local date', async () => {
  const ledger = new Set();
  const model = {
    async updateOne(filter, update) {
      const key = `${filter.account_id}:${filter.account_type}:${filter.recording_date}`;
      if (ledger.has(key)) return { upsertedCount: 0 };
      ledger.add(key);
      assert.equal(update.$setOnInsert.sample_id, acceptedSample._id);
      return { upsertedCount: 1 };
    },
  };
  const args = {
    CoinModel: model,
    accountId: 'account-1',
    accountType: 'user',
    sample: acceptedSample,
    timezone: 'Asia/Jakarta',
  };
  assert.equal(await awardRecordingDayCoin(args), true);
  assert.equal(await awardRecordingDayCoin(args), false);
  assert.equal(ledger.size, 1);
});
