import test from 'node:test';
import assert from 'node:assert/strict';
import {
  identifyPatientRedFlags,
  recommendPatientAction,
  summarizePatientPersistence,
  summarizePatientRecovery,
} from '../utils/patientPedagogy.js';

test('red flag action bypasses quality and sensor status', () => {
  const action = recommendPatientAction({
    dataQualityAvailable: false,
    redFlag: true,
  });
  assert.equal(action.level, 'red');
  assert.equal(action.bypassed_sensor_scoring, true);
});

test('very severe patient-reported symptoms bypass sensor scoring', () => {
  const action = recommendPatientAction({
    dataQualityAvailable: true,
    symptomSeverity: 9,
  });
  assert.equal(action.level, 'red');
  assert.equal(action.action, 'emergency');
  assert.equal(action.bypassed_sensor_scoring, true);
});

test('safety action distinguishes clinician contact, observation, and quality warning', () => {
  assert.equal(recommendPatientAction({
    dataQualityAvailable: true,
    persistentDeviation: true,
    symptomsPresent: true,
  }).action, 'contact_clinician');
  assert.equal(recommendPatientAction({
    dataQualityAvailable: true,
    recovering: true,
  }).action, 'observe_and_record');
  assert.equal(recommendPatientAction({
    dataQualityAvailable: false,
  }).action, 'quality_warning');
  assert.equal(recommendPatientAction({
    dataQualityAvailable: false,
    symptomsPresent: true,
  }).level, 'yellow');
  assert.equal(recommendPatientAction({
    dataQualityAvailable: true,
    persistentDeviation: true,
  }).action, 'observe_and_record');
  assert.equal(recommendPatientAction({
    dataQualityAvailable: true,
    deviationPresent: true,
  }).action, 'observe_and_record');
});

test('red-flag symptoms are derived from patient report and high severity', () => {
  assert.equal(identifyPatientRedFlags({
    symptoms: ['chest_pain'],
    symptom_severity: 1,
  }).red_flag, true);
  assert.equal(identifyPatientRedFlags({
    symptoms: ['breathlessness'],
    symptom_severity: 7,
  }).red_flag, true);
  assert.equal(identifyPatientRedFlags({
    symptoms: ['fatigue'],
    symptom_severity: 4,
  }).red_flag, false);
});

test('recovery summary reports a falling deviation trend, dwell time, and relapse', () => {
  const now = Date.parse('2026-10-05T10:00:00Z');
  const result = summarizePatientRecovery([
    { window_start: now - 5 * 60000, anomaly_score: 3, rr_status: 'PERSISTENT_DEVIATION' },
    { window_start: now - 2 * 60000, anomaly_score: 1, rr_status: 'RECOVERING' },
  ], [{
    status: 'open',
    onset_time: now - 10 * 60000,
    persistent_at: now - 7 * 60000,
    peak_time: now - 5 * 60000,
    relapse_count: 1,
    relapse: true,
    window_count: 5,
  }], now);
  assert.equal(result.status, 'recovering');
  assert.equal(result.score_trend, 'decreasing');
  assert.equal(result.latest_episode.persistent_dwell_minutes, 3);
  assert.equal(result.latest_episode.elapsed_minutes, 10);
  assert.equal(result.relapse_detected, true);
});

test('persistence requires four of the latest five Mahalanobis windows', () => {
  const now = Date.parse('2026-10-05T10:00:00Z');
  const observations = [true, true, false, true, true].map((deviating, index) => ({
    recorded_at: new Date(now - (4 - index) * 60000),
    squared_distance: deviating ? 8 : 1,
    distance: deviating ? 2.8 : 1,
    thresholds: { mild: 5.9 },
  }));
  const result = summarizePatientPersistence(observations);

  assert.equal(result.method, 'k_of_m_mahalanobis_threshold');
  assert.equal(result.deviating_windows, 4);
  assert.equal(result.persistent, true);
  assert.equal(result.dwell_minutes, 1);
});

test('persistence abstains when the latest windows are temporally discontinuous', () => {
  const now = Date.parse('2026-10-05T10:00:00Z');
  const observations = [0, 1, 2, 3, 4].map((index) => ({
    recorded_at: new Date(now - (4 - index) * 15 * 60000),
    squared_distance: 8,
    distance: 2.8,
    thresholds: { mild: 5.9 },
  }));
  const result = summarizePatientPersistence(observations);

  assert.equal(result.window_contiguous, false);
  assert.equal(result.persistent, false);
});

test('recovery uses Mahalanobis distance trend and marks return inside baseline region', () => {
  const now = Date.parse('2026-10-05T10:00:00Z');
  const threshold = 5.9;
  const result = summarizePatientRecovery([
    {
      window_start: now - 2 * 60000,
      distance: 4,
      squared_distance: 16,
      thresholds: { mild: threshold },
      rr_status: 'DEVIATION_CANDIDATE',
    },
    {
      window_start: now - 60000,
      distance: 2,
      squared_distance: 4,
      thresholds: { mild: threshold },
      rr_status: 'RECOVERING',
    },
    {
      window_start: now,
      distance: 1,
      squared_distance: 1,
      thresholds: { mild: threshold },
      rr_status: 'NORMAL',
    },
  ], [], now);

  assert.equal(result.status, 'recovered');
  assert.equal(result.score_trend, 'decreasing');
  assert.equal(result.recovery_progress, 75);
  assert.equal(result.time_to_recovery_minutes, null);
});

test('recovery trajectory detects a deviation after return to personal baseline', () => {
  const now = Date.parse('2026-10-05T10:00:00Z');
  const threshold = 5.9;
  const result = summarizePatientRecovery([
    { window_start: now - 4 * 60000, distance: 3, squared_distance: 9, thresholds: { mild: threshold } },
    { window_start: now - 3 * 60000, distance: 1, squared_distance: 1, thresholds: { mild: threshold } },
    { window_start: now - 2 * 60000, distance: 1, squared_distance: 1, thresholds: { mild: threshold } },
    { window_start: now - 60000, distance: 3, squared_distance: 9, thresholds: { mild: threshold } },
  ], [], now);

  assert.equal(result.relapse_detected, true);
  assert.equal(result.relapse_source, 'distance_trajectory');
});

test('a stale CAPAR relapse does not affect the current-day action summary', () => {
  const now = Date.parse('2026-10-05T10:00:00Z');
  const result = summarizePatientRecovery([], [{
    onset_time: now - 48 * 60 * 60000,
    relapse: true,
  }], now);

  assert.equal(result.relapse_detected, false);
});
