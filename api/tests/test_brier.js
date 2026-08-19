import { BrierEvaluator, brierSkillScore } from '../utils/brierEvaluator.js';

const evaluator = new BrierEvaluator();

const sampleRecords = [
  {
    probabilities: {
      BASELINE_COMPATIBLE: 0.10,
      DEVIATION_CANDIDATE: 0.10,
      PERSISTENT_DEVIATION: 0.10,
      RECOVERY_START: 0.60,
      RECOVERED: 0.10
    },
    actual_state: "RECOVERY_START"
  },
  {
    probabilities: {
      BASELINE_COMPATIBLE: 0.05,
      DEVIATION_CANDIDATE: 0.10,
      PERSISTENT_DEVIATION: 0.65,
      RECOVERY_START: 0.15,
      RECOVERED: 0.05
    },
    actual_state: "PERSISTENT_DEVIATION"
  },
  {
    probabilities: {
      BASELINE_COMPATIBLE: 0.05,
      DEVIATION_CANDIDATE: 0.05,
      PERSISTENT_DEVIATION: 0.05,
      RECOVERY_START: 0.15,
      RECOVERED: 0.70
    },
    actual_state: "RECOVERED"
  }
];

console.log('--- Testing BrierEvaluator ---');
const singleResult = evaluator.scoreSingle(sampleRecords[0].probabilities, sampleRecords[0].actual_state);
console.log('Single Record Result:', singleResult);

const batchResult = evaluator.evaluate(sampleRecords);
console.log('Batch Evaluation Result:\n', JSON.stringify(batchResult, null, 2));

const bssTest = brierSkillScore(0.12, 0.20);
console.log('BSS Test (0.12 vs 0.20):', bssTest); // Expected 0.40

if (batchResult.status === 'READY' && batchResult.n_predictions === 3 && bssTest === 0.4) {
  console.log('\n✅ BrierEvaluator tests PASSED!');
} else {
  console.error('\n❌ BrierEvaluator tests FAILED!');
  process.exit(1);
}
