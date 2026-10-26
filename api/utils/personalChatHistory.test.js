import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPersonalChatDateFilter,
  parseActivityTime,
  summarizeManualActivityDurations,
} from './personalChatHistory.js';

test('parses valid manual activity times and rejects invalid values', () => {
  assert.equal(parseActivityTime('07:30'), 27000);
  assert.equal(parseActivityTime('07:30:15'), 27015);
  assert.equal(parseActivityTime('24:00'), null);
  assert.equal(parseActivityTime('12:60'), null);
  assert.equal(parseActivityTime('unknown'), null);
});

test('sums manual activity duration, including overnight intervals', () => {
  const result = summarizeManualActivityDurations([
    {
      Date: new Date('2026-10-24T00:00:00.000Z'),
      awal: '08:00',
      akhir: '09:30',
      aktivitas: 'Jalan',
    },
    {
      Date: new Date('2026-10-25T00:00:00.000Z'),
      awal: '23:00',
      akhir: '01:00',
      aktivitas: 'Jalan',
    },
    {
      Date: new Date('2026-10-25T00:00:00.000Z'),
      awal: '10:00',
      akhir: '10:00',
      aktivitas: 'Invalid',
    },
    {
      Date: new Date('2026-10-25T00:00:00.000Z'),
      awal: 'bad',
      akhir: '11:00',
      aktivitas: 'Invalid',
    },
  ]);

  assert.deepEqual(result, {
    total_hours: 3.5,
    average_hours_per_recorded_day: 1.75,
    valid_records: 2,
    recorded_days: 2,
    truncated: false,
    daily: [
      { date: '2026-10-25', records: 1, hours: 2 },
      { date: '2026-10-24', records: 1, hours: 1.5 },
    ],
    activities: [{ activity: 'Jalan', records: 2, hours: 3.5 }],
  });
});

test('uses explicit relative and calendar ranges but defaults to full history', () => {
  const now = new Date('2026-10-25T10:00:00.000Z');
  assert.equal(
    getPersonalChatDateFilter('aktivitas 7 hari terakhir', now).from.toISOString(),
    '2026-10-18T10:00:00.000Z',
  );
  assert.equal(
    getPersonalChatDateFilter('data bulan ini', now).from.toISOString(),
    '2026-10-01T00:00:00.000Z',
  );
  assert.equal(getPersonalChatDateFilter('ringkas semua riwayat', now), null);
});
