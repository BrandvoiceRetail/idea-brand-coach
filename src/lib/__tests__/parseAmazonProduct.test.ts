/**
 * Tests for the Amazon /dp/ product parser.
 *
 * Fixtures are trimmed slices of a REAL Firecrawl response for ASIN B0CJBQ7F5C
 * (captured 2026-06-04): the head section (productTitle / price / feature-bullets
 * / images) plus the full embedded-review section.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseAmazonProduct, type ParsedAmazonProduct } from '../parseAmazonProduct';

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const ASIN = 'B0CJBQ7F5C';

describe('parseAmazonProduct', () => {
  let html: string;
  let markdown: string;
  let product: ParsedAmazonProduct;

  beforeAll(() => {
    html = readFileSync(join(FIXTURE_DIR, `dp_${ASIN}.html`), 'utf-8');
    markdown = readFileSync(join(FIXTURE_DIR, `dp_${ASIN}.md`), 'utf-8');
    const result = parseAmazonProduct(markdown, html, ASIN);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    product = result.data as ParsedAmazonProduct;
  });

  it('echoes the ASIN', () => {
    expect(product.asin).toBe(ASIN);
  });

  it('extracts the product title from productTitle span', () => {
    expect(product.title).toContain('Toploader Card Binder');
    expect(product.title.length).toBeGreaterThan(20);
  });

  it('extracts the rating as 4.6', () => {
    expect(product.rating).toBe(4.6);
  });

  it('extracts the price as 21.99', () => {
    expect(product.price).toBe(21.99);
  });

  it('extracts the review count', () => {
    expect(product.reviewCount).toBe(143);
  });

  it('extracts between 1 and 10 feature bullets', () => {
    expect(product.bullets.length).toBeGreaterThanOrEqual(1);
    expect(product.bullets.length).toBeLessThanOrEqual(10);
    for (const bullet of product.bullets) {
      expect(bullet.length).toBeGreaterThan(20);
    }
  });

  it('extracts product images capped at 15', () => {
    expect(product.images.length).toBeGreaterThan(0);
    expect(product.images.length).toBeLessThanOrEqual(15);
    expect(product.images[0].type).toBe('main');
    expect(product.images[0].url).toMatch(/^https:\/\/m\.media-amazon\.com\/images\/I\//);
  });

  it('extracts at least 5 reviews with non-empty bodies', () => {
    expect(product.reviews.length).toBeGreaterThanOrEqual(5);
    for (const review of product.reviews) {
      expect(review.body.trim().length).toBeGreaterThanOrEqual(10);
    }
  });

  it('extracts review metadata (rating, reviewer, verified)', () => {
    const withRating = product.reviews.filter((r) => r.rating >= 1 && r.rating <= 5);
    expect(withRating.length).toBe(product.reviews.length);

    const withReviewer = product.reviews.filter((r) => r.reviewerName.length > 0);
    expect(withReviewer.length).toBeGreaterThan(0);

    const verified = product.reviews.filter((r) => r.verified);
    expect(verified.length).toBeGreaterThan(0);
  });

  it('does not leak Amazon teaser-collapse boilerplate into review bodies', () => {
    for (const review of product.reviews) {
      expect(review.body).not.toContain('Brief content visible');
      expect(review.body).not.toContain('Full content visible');
    }
  });
});
