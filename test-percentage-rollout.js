/**
 * Percentage Rollout Distribution Verification Script
 *
 * This script verifies that the hash-based percentage rollout
 * produces the expected distribution at 10%, 50%, and 100%.
 *
 * Run with: node test-percentage-rollout.js
 */

/**
 * Simple hash function (same as in useFeatureFlag.ts)
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Test percentage distribution
 */
function testPercentageDistribution(targetPercentage, sampleSize = 1000) {
  let enabledCount = 0;

  // Simulate many different session IDs
  for (let i = 0; i < sampleSize; i++) {
    const sessionId = `test_session_${i}_${Math.random().toString(36).substring(2)}`;
    const hash = simpleHash(sessionId);
    const sessionPercentage = (hash % 100) + 1;

    if (sessionPercentage <= targetPercentage) {
      enabledCount++;
    }
  }

  const actualPercentage = (enabledCount / sampleSize) * 100;
  const deviation = Math.abs(actualPercentage - targetPercentage);

  return {
    targetPercentage,
    sampleSize,
    enabledCount,
    actualPercentage: parseFloat(actualPercentage.toFixed(2)),
    deviation: parseFloat(deviation.toFixed(2)),
  };
}

// Run tests
console.log('=== Percentage Rollout Distribution Tests ===\n');

const SAMPLE_SIZE = 10000;
const ACCEPTABLE_DEVIATION = 2;

// Test 10% rollout
console.log('Testing 10% rollout...');
const test10 = testPercentageDistribution(10, SAMPLE_SIZE);
console.log(`  Target: ${test10.targetPercentage}%`);
console.log(`  Actual: ${test10.actualPercentage}%`);
console.log(`  Enabled: ${test10.enabledCount} / ${test10.sampleSize}`);
console.log(`  Deviation: ${test10.deviation}%`);
console.log(`  Result: ${test10.deviation <= ACCEPTABLE_DEVIATION ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 50% rollout
console.log('Testing 50% rollout...');
const test50 = testPercentageDistribution(50, SAMPLE_SIZE);
console.log(`  Target: ${test50.targetPercentage}%`);
console.log(`  Actual: ${test50.actualPercentage}%`);
console.log(`  Enabled: ${test50.enabledCount} / ${test50.sampleSize}`);
console.log(`  Deviation: ${test50.deviation}%`);
console.log(`  Result: ${test50.deviation <= ACCEPTABLE_DEVIATION ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 100% rollout
console.log('Testing 100% rollout...');
const test100 = testPercentageDistribution(100, SAMPLE_SIZE);
console.log(`  Target: ${test100.targetPercentage}%`);
console.log(`  Actual: ${test100.actualPercentage}%`);
console.log(`  Enabled: ${test100.enabledCount} / ${test100.sampleSize}`);
console.log(`  Deviation: ${test100.deviation}%`);
console.log(`  Result: ${test100.deviation === 0 ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 0% rollout
console.log('Testing 0% rollout...');
const test0 = testPercentageDistribution(0, SAMPLE_SIZE);
console.log(`  Target: ${test0.targetPercentage}%`);
console.log(`  Actual: ${test0.actualPercentage}%`);
console.log(`  Enabled: ${test0.enabledCount} / ${test0.sampleSize}`);
console.log(`  Deviation: ${test0.deviation}%`);
console.log(`  Result: ${test0.deviation === 0 && test0.enabledCount === 0 ? '✅ PASS' : '❌ FAIL'}\n`);

// Summary
console.log('=== Summary ===');
const allPassed = (
  test10.deviation <= ACCEPTABLE_DEVIATION &&
  test50.deviation <= ACCEPTABLE_DEVIATION &&
  test100.deviation === 0 &&
  test0.deviation === 0
);

if (allPassed) {
  console.log('✅ All percentage rollout tests PASSED!');
  console.log('\nThe hash-based percentage rollout mechanism works correctly at:');
  console.log('  - 0% rollout (disabled)');
  console.log('  - 10% rollout (gradual rollout)');
  console.log('  - 50% rollout (half rollout)');
  console.log('  - 100% rollout (full rollout)');
  process.exit(0);
} else {
  console.log('❌ Some percentage rollout tests FAILED!');
  process.exit(1);
}
