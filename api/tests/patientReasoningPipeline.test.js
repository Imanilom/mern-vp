import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPatientReasoningPipeline } from '../utils/patientReasoningPipeline.js';

test('reasoning pipeline exposes real stages without inventing a posterior', () => {
  const pipeline = buildPatientReasoningPipeline({
    recentSegments: [{}, {}],
    acceptedSegments: [{}, {}],
    latestSegment: {
      activity_label: 'sitting',
      signal_quality_detail: { q_signal: 0.92 },
      features: { mean_hr: 72, rmssd: 34, unavailable: null },
    },
    latestMahalanobis: {
      available: true,
      state: 'within_personal_region',
      distance: 1.1,
    },
    matchingBaseline: {
      activity: 'sitting',
      time_period: 'morning',
      segment_count: 42,
    },
    polarData: [{}],
    checkIns: [{ symptoms: ['fatigue'], activity: 'sitting' }],
    behaviorEvents: [{}],
    persistence: { persistent: false },
    recovery: { status: 'stable', recovery_progress: null },
    episodeHistory: [{}],
    decision: { level: 'green', action: 'continue', policy: { status: 'NON-CLINICAL / PLACEHOLDER' } },
    followUp: { status: 'already_answered' },
    feedbackCheckIn: {
      deviation_follow_up: {
        action_taken: 'Beristirahat',
        response_after_action: 'Merasa lebih baik',
      },
    },
  });
  const stages = Object.fromEntries(
    pipeline.stages.map((stage) => [stage.stage_id, stage])
  );

  assert.equal(pipeline.processing_model, 'rule_and_statistical_mvp');
  assert.equal(pipeline.probabilistic_posterior.notation, 'P(X_t | T(t))');
  assert.equal(pipeline.probabilistic_posterior.distribution, null);
  assert.equal(stages.quality_gate.rejected_windows, 0);
  assert.deepEqual(stages.feature_engine.available_features, ['mean_hr', 'rmssd']);
  assert.equal(stages.evidence_fusion.sources.symptoms.available, true);
  assert.equal(stages.evidence_fusion.sources.clinical_records.status, 'not_integrated');
  assert.equal(stages.latent_state_estimation.state, 'within_personal_region');
  assert.equal(stages.latent_state_estimation.patient_context_used_in_state_estimate, false);
  assert.equal(stages.latent_state_estimation.posterior_probability, null);
  assert.equal(stages.temporal_reasoning.episode_count, 1);
  assert.equal(stages.decision_policy.action_level, 'green');
  assert.equal(stages.feedback.intervention_response_status, 'self_report_recorded');
  assert.equal(stages.feedback.patient_reported_action_recorded, true);
});

test('pipeline abstains when no sensor, baseline, state, or patient action exists', () => {
  const pipeline = buildPatientReasoningPipeline();
  const stages = Object.fromEntries(
    pipeline.stages.map((stage) => [stage.stage_id, stage])
  );

  assert.equal(stages.quality_gate.status, 'insufficient_data');
  assert.equal(stages.personal_baseline.status, 'insufficient_data');
  assert.equal(stages.latent_state_estimation.status, 'insufficient_data');
  assert.equal(stages.latent_state_estimation.state, null);
  assert.equal(stages.evidence_fusion.status, 'insufficient_data');
  assert.equal(stages.patient_pedagogy.status, 'insufficient_data');
  assert.equal(stages.feedback.intervention_response_status, 'not_collected');
});

test('historical records are not reported as current sensing', () => {
  const pipeline = buildPatientReasoningPipeline({
    polarData: [{}],
    checkIns: [{ symptoms: ['fatigue'] }],
  });
  const sensing = pipeline.stages.find((stage) => stage.stage_id === 'sensing');
  const quality = pipeline.stages.find((stage) => stage.stage_id === 'quality_gate');

  assert.equal(sensing.status, 'historical_only');
  assert.equal(quality.status, 'insufficient_data');
});

test('conflicting observed sources remain visible in the fusion stage', () => {
  const conflict = {
    type: 'context_sensor_activity_disagreement',
    evidence: [
      { source: 'patient', value: 'walking' },
      { source: 'sensor', value: 'sitting' },
    ],
  };
  const pipeline = buildPatientReasoningPipeline({
    evidenceConflicts: [conflict],
    checkIns: [{ activity: 'walking' }],
    latestSegment: { activity_label: 'sitting' },
  });
  const fusion = pipeline.stages.find(
    (stage) => stage.stage_id === 'evidence_fusion'
  );

  assert.equal(fusion.status, 'conflicting_evidence');
  assert.deepEqual(fusion.conflicts, [conflict]);
  assert.equal(fusion.causality_established, false);
});
