import { analyzeMultiPeakRelapseDynamics, computeTrapezoidalAuc } from './utils/multiPeakRelapseEngine.js';

console.log('=== Test 1: AUC Calculation ===');
const scores = [0.65, 1.85, 3.10, 1.09, 3.35, 2.85, 3.10, 3.35, 0.95];
const baseTime = 1700000000000;
const times = scores.map((_, i) => baseTime + i * 60000);
const auc = computeTrapezoidalAuc(scores, times);
console.log('Computed AUC:', auc);

console.log('\n=== Test 2: Multi-Peak & Relapse State Space Dynamics ===');
const result = analyzeMultiPeakRelapseDynamics({
  scores,
  timestampsMs: times,
  hrs: [72, 85, 114, 80, 118, 98, 110, 115, 74],
  tauIn: 1.86,
  tauOut: 1.18,
  tauNormal: 1.0
});

console.log('Peaks Count:', result.peaksCount);
console.log('Relapse Count:', result.relapseCount);
console.log('Max Peak Score:', result.maxPeakScore);
console.log('Primary TTR (min):', result.primaryTtrMin);
console.log('Damping Ratio:', result.dampingRatio);
console.log('Classification:', result.dynamicsClassification);
console.log('Relationship Chain:', result.relationshipChainStr);
console.log('Phase Space Orbit Steps:', result.phaseSpaceOrbit.length);
console.log('Sample Orbit Step 1:', result.phaseSpaceOrbit[0]);
console.log('Sample Relapse Orbit Step:', result.phaseSpaceOrbit.find(s => s.isRelapse));

if (result.peaksCount >= 2 && result.relapseCount >= 1 && result.relationshipChainStr.includes('Relapse')) {
  console.log('\n✅ ALL MULTI-PEAK & RELAPSE ENGINE TESTS PASSED SUCCESSFULLY!');
} else {
  console.error('\n❌ TEST FAILED: Dynamics did not match expected values.');
  process.exit(1);
}
