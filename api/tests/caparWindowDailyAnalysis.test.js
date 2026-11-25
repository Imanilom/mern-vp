import test from 'node:test';
import assert from 'node:assert/strict';
import CaparWindowDailyAnalysis from '../models/capar_window_daily_analysis.model.js';

test('daily CAPAR analyses are unique per patient and date', () => {
  assert.equal(CaparWindowDailyAnalysis.collection.collectionName, 'capar_window_daily_analyses');
  assert.ok(CaparWindowDailyAnalysis.schema.indexes().some(([fields, options]) => (
    fields.account_id === 1
    && fields.analysis_date === 1
    && options.unique === true
  )));
});

test('daily CAPAR analysis validates its date and required ownership fields', async () => {
  const analysis = new CaparWindowDailyAnalysis({
    account_id: new CaparWindowDailyAnalysis.base.Types.ObjectId(),
    analysis_date: '2026-10-26',
    source_window_count: 1,
    valid_window_count: 1,
    invalid_window_count: 0,
    generated_by: new CaparWindowDailyAnalysis.base.Types.ObjectId(),
    activity_summaries: [{
      activity: 'Rest',
      window_count: 1,
      valid_window_count: 1,
      invalid_window_count: 0,
      mean_hr: 70,
    }],
  });
  await assert.doesNotReject(analysis.validate());

  analysis.analysis_date = 'not-a-date';
  await assert.rejects(analysis.validate(), (error) => (
    error.errors.analysis_date?.kind === 'regexp'
  ));
});
