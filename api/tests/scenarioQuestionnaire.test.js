import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateScenarioQuestionnaireScore } from '../utils/scenarioQuestionnaire.js';

test('SUS score applies standard alternating item scoring', () => {
  const result = calculateScenarioQuestionnaireScore(
    'SUS',
    [4, 2, 4, 2, 5, 2, 4, 1, 4, 2]
  );
  assert.equal(result.score, 80);
  assert.equal(result.score_unit, 'SUS points');
});

test('NASA-TLX result is an unweighted six-dimension mean', () => {
  const result = calculateScenarioQuestionnaireScore('NASA_TLX', {
    mental_demand: 45,
    physical_demand: 10,
    temporal_demand: 30,
    performance: 25,
    effort: 40,
    frustration: 20,
  });
  assert.equal(result.score, 28.3);
  assert.match(result.score_summary, /bukan skor NASA-TLX berbobot/);
});
