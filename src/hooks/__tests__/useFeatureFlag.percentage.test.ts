/**
 * Percentage Rollout Distribution Tests
 *
 * Tests to verify that the hash-based percentage rollout
 * produces the expected distribution across many sessions.
 */
import { describe, it, expect } from 'vitest';
import { testPercentageDistribution } from '../useFeatureFlag';

describe('useFeatureFlag - Percentage Rollout Distribution', () => {
  const SAMPLE_SIZE = 10000; // Large sample for accurate distribution testing
  const ACCEPTABLE_DEVIATION = 2; // Allow 2% deviation from target

  it('should distribute 10% rollout correctly', () => {
    const result = testPercentageDistribution(10, SAMPLE_SIZE);

    expect(result.targetPercentage).toBe(10);
    expect(result.sampleSize).toBe(SAMPLE_SIZE);
    expect(result.actualPercentage).toBeGreaterThanOrEqual(10 - ACCEPTABLE_DEVIATION);
    expect(result.actualPercentage).toBeLessThanOrEqual(10 + ACCEPTABLE_DEVIATION);
    expect(result.deviation).toBeLessThanOrEqual(ACCEPTABLE_DEVIATION);
  });

  it('should distribute 50% rollout correctly', () => {
    const result = testPercentageDistribution(50, SAMPLE_SIZE);

    expect(result.targetPercentage).toBe(50);
    expect(result.sampleSize).toBe(SAMPLE_SIZE);
    expect(result.actualPercentage).toBeGreaterThanOrEqual(50 - ACCEPTABLE_DEVIATION);
    expect(result.actualPercentage).toBeLessThanOrEqual(50 + ACCEPTABLE_DEVIATION);
    expect(result.deviation).toBeLessThanOrEqual(ACCEPTABLE_DEVIATION);
  });

  it('should distribute 100% rollout correctly', () => {
    const result = testPercentageDistribution(100, SAMPLE_SIZE);

    expect(result.targetPercentage).toBe(100);
    expect(result.sampleSize).toBe(SAMPLE_SIZE);
    expect(result.actualPercentage).toBe(100);
    expect(result.deviation).toBe(0);
  });

  it('should disable at 0% rollout', () => {
    const result = testPercentageDistribution(0, SAMPLE_SIZE);

    expect(result.targetPercentage).toBe(0);
    expect(result.sampleSize).toBe(SAMPLE_SIZE);
    expect(result.actualPercentage).toBe(0);
    expect(result.enabledCount).toBe(0);
    expect(result.deviation).toBe(0);
  });

  it('should produce consistent distribution across multiple runs', () => {
    const run1 = testPercentageDistribution(25, SAMPLE_SIZE);
    const run2 = testPercentageDistribution(25, SAMPLE_SIZE);
    const run3 = testPercentageDistribution(25, SAMPLE_SIZE);

    // All runs should be within acceptable deviation
    expect(run1.actualPercentage).toBeGreaterThanOrEqual(25 - ACCEPTABLE_DEVIATION);
    expect(run1.actualPercentage).toBeLessThanOrEqual(25 + ACCEPTABLE_DEVIATION);

    expect(run2.actualPercentage).toBeGreaterThanOrEqual(25 - ACCEPTABLE_DEVIATION);
    expect(run2.actualPercentage).toBeLessThanOrEqual(25 + ACCEPTABLE_DEVIATION);

    expect(run3.actualPercentage).toBeGreaterThanOrEqual(25 - ACCEPTABLE_DEVIATION);
    expect(run3.actualPercentage).toBeLessThanOrEqual(25 + ACCEPTABLE_DEVIATION);
  });

  it('should handle edge case percentages', () => {
    const result1 = testPercentageDistribution(1, SAMPLE_SIZE);
    expect(result1.actualPercentage).toBeGreaterThan(0);
    expect(result1.actualPercentage).toBeLessThanOrEqual(1 + ACCEPTABLE_DEVIATION);

    const result99 = testPercentageDistribution(99, SAMPLE_SIZE);
    expect(result99.actualPercentage).toBeGreaterThanOrEqual(99 - ACCEPTABLE_DEVIATION);
    expect(result99.actualPercentage).toBeLessThan(100);
  });
});
