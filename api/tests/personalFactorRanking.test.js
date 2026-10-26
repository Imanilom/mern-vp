import test from 'node:test';
import assert from 'node:assert/strict';
import { rankPersonalReportedFactors } from '../../vidyamedic-web/src/utils/personalFactorRanking.js';

test('personal factor ranking uses repeated user ranking order without inventing factors', () => {
  const ranking = rankPersonalReportedFactors([
    { deviation_follow_up: { ranked_context_factors: ['stress', 'mood', 'meal'] } },
    { deviation_follow_up: { ranked_context_factors: ['stress', 'meal'] } },
    { deviation_follow_up: { ranked_context_factors: ['mood'] } },
  ]);

  assert.deepEqual(ranking.map((item) => item.factor), ['stress', 'mood', 'meal']);
  assert.equal(ranking[0].events, 2);
  assert.equal(ranking[0].points, 5);
  assert.equal(ranking[1].events, 2);
  assert.equal(ranking[2].events, 2);
});

test('personal factor ranking is empty without submitted user rankings', () => {
  assert.deepEqual(rankPersonalReportedFactors([{ feeling: 'poor' }, {}]), []);
});
