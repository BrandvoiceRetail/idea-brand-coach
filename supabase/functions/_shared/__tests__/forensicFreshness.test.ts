import { describe, it, expect } from 'vitest';
import { shouldSkipScrape, type ProductFreshnessData } from '../forensicFreshness';

describe('shouldSkipScrape', () => {
  const now = Date.now();
  const oneHourMs = 3600000;

  it('should return false when product is null', () => {
    expect(shouldSkipScrape(null, oneHourMs, now)).toBe(false);
  });

  it('should return false when scraped_at is null', () => {
    const product: ProductFreshnessData = {
      scraped_at: null,
      review_count: 5
    };
    expect(shouldSkipScrape(product, oneHourMs, now)).toBe(false);
  });

  it('should return false when data is stale even with reviews', () => {
    // 2 hours ago = stale
    const twoHoursAgo = new Date(now - (2 * oneHourMs)).toISOString();
    const product: ProductFreshnessData = {
      scraped_at: twoHoursAgo,
      review_count: 10
    };
    expect(shouldSkipScrape(product, oneHourMs, now)).toBe(false);
  });

  it('should return false when data is fresh but has zero reviews', () => {
    // 30 minutes ago = fresh
    const thirtyMinutesAgo = new Date(now - (oneHourMs / 2)).toISOString();
    const product: ProductFreshnessData = {
      scraped_at: thirtyMinutesAgo,
      review_count: 0
    };
    expect(shouldSkipScrape(product, oneHourMs, now)).toBe(false);
  });

  it('should return true when data is fresh AND has reviews', () => {
    // 30 minutes ago = fresh
    const thirtyMinutesAgo = new Date(now - (oneHourMs / 2)).toISOString();
    const product: ProductFreshnessData = {
      scraped_at: thirtyMinutesAgo,
      review_count: 8
    };
    expect(shouldSkipScrape(product, oneHourMs, now)).toBe(true);
  });

  it('should respect custom freshness windows', () => {
    const fiveMinutesMs = 300000;
    const threeMinutesAgo = new Date(now - 180000).toISOString();
    const product: ProductFreshnessData = {
      scraped_at: threeMinutesAgo,
      review_count: 5
    };
    // Within 5 minute window = skip
    expect(shouldSkipScrape(product, fiveMinutesMs, now)).toBe(true);
    // Outside 2 minute window = scrape
    expect(shouldSkipScrape(product, 120000, now)).toBe(false);
  });

  it('should handle edge case of exactly at window boundary', () => {
    const exactlyOneHourAgo = new Date(now - oneHourMs).toISOString();
    const product: ProductFreshnessData = {
      scraped_at: exactlyOneHourAgo,
      review_count: 5
    };
    // Exactly at boundary = stale (not less than window)
    expect(shouldSkipScrape(product, oneHourMs, now)).toBe(false);
  });
});