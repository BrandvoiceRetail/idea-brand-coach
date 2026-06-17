import { describe, it, expect } from 'vitest';
import {
  resolveMarketplace,
  amazonProductUrl,
  resolveCredentials,
  basicAuthHeader,
  normalizeAmazonItem,
  normalizeAmazonReview,
  extractItems,
  getAmazonProductByAsin,
  searchTopCompetitors,
  getAmazonReviews,
} from '../dataforseo';

describe('resolveMarketplace', () => {
  it('resolves known marketplaces and defaults unknown to amazon.com', () => {
    expect(resolveMarketplace('amazon.co.uk').location_name).toBe('United Kingdom');
    expect(resolveMarketplace('AMAZON.DE').language_code).toBe('de_DE');
    expect(resolveMarketplace('amazon.zz').location_name).toBe('United States');
    expect(resolveMarketplace(undefined).host).toBe('www.amazon.com');
  });
});

describe('amazonProductUrl', () => {
  it('builds a canonical /dp/ url on the marketplace host', () => {
    expect(amazonProductUrl('B0TEST', 'amazon.co.uk')).toBe('https://www.amazon.co.uk/dp/B0TEST');
    expect(amazonProductUrl('B0TEST')).toBe('https://www.amazon.com/dp/B0TEST');
  });
});

describe('resolveCredentials', () => {
  it('returns null when no override and no Deno env (vitest runtime)', () => {
    // Deno is undefined under vitest, so without an override this is unconfigured.
    expect(resolveCredentials()).toBeNull();
  });

  it('uses an override and returns null when a half is missing', () => {
    expect(resolveCredentials({ username: 'u', password: 'p' })).toEqual({ username: 'u', password: 'p' });
    expect(resolveCredentials({ username: 'u' })).toBeNull();
    expect(resolveCredentials({ password: 'p' })).toBeNull();
  });
});

describe('basicAuthHeader', () => {
  it('base64-encodes user:pass', () => {
    expect(basicAuthHeader({ username: 'u', password: 'p' })).toBe(`Basic ${btoa('u:p')}`);
  });
});

describe('extractItems', () => {
  it('walks the DataForSEO Live envelope down to items, tolerating nulls', () => {
    const envelope = {
      tasks: [
        { result: [{ items: [{ asin: 'A1' }, { asin: 'A2' }] }] },
        { result: null },
        null,
      ],
    };
    const items = extractItems(envelope);
    expect(items.map((i) => i.asin)).toEqual(['A1', 'A2']);
    expect(extractItems(null)).toEqual([]);
    expect(extractItems({})).toEqual([]);
  });
});

describe('normalizeAmazonItem', () => {
  it('normalizes a product and grounds price/bullets, defaulting url from ASIN', () => {
    const item = {
      asin: 'B0ABC',
      title: 'Premium Card Binder',
      brand: 'CardCo',
      price: { current: 24.99, currency: 'GBP' },
      rating: { value: 4.6 },
      reviews_count: 312,
      bullet_points: ['Holds 480 cards', { value: 'Acid-free pages' }, ''],
      description: 'A premium binder.',
    };
    const p = normalizeAmazonItem(item, 'amazon.co.uk');
    expect(p).not.toBeNull();
    expect(p!.asin).toBe('B0ABC');
    expect(p!.title).toBe('Premium Card Binder');
    expect(p!.price).toBe(24.99);
    expect(p!.currency).toBe('GBP');
    expect(p!.rating).toBe(4.6);
    expect(p!.reviewsCount).toBe(312);
    expect(p!.bullets).toEqual(['Holds 480 cards', 'Acid-free pages']);
    expect(p!.url).toBe('https://www.amazon.co.uk/dp/B0ABC');
  });

  it('returns null when there is no ASIN to anchor evidence to (grounding)', () => {
    expect(normalizeAmazonItem({ title: 'No asin' })).toBeNull();
    expect(normalizeAmazonItem(null)).toBeNull();
    expect(normalizeAmazonItem('nope')).toBeNull();
  });

  it('never invents missing fields — absent stays undefined', () => {
    const p = normalizeAmazonItem({ asin: 'B0BARE' });
    expect(p!.title).toBeUndefined();
    expect(p!.price).toBeUndefined();
    expect(p!.rating).toBeUndefined();
    expect(p!.bullets).toEqual([]);
  });
});

describe('normalizeAmazonReview', () => {
  it('normalizes a review with a body and drops bodyless reviews (grounding)', () => {
    const r = normalizeAmazonReview({
      review_text: 'Great quality, pages do not bend.',
      rating: 5,
      title: 'Excellent',
      verified: true,
      publication_date: '2026-01-02',
      author: 'Sam',
    });
    expect(r).not.toBeNull();
    expect(r!.body).toBe('Great quality, pages do not bend.');
    expect(r!.rating).toBe(5);
    expect(r!.verified).toBe(true);
    expect(normalizeAmazonReview({ rating: 5 })).toBeNull();
  });
});

describe('public API — not_configured path (no creds under vitest)', () => {
  it('getAmazonProductByAsin returns not_configured without throwing', async () => {
    const res = await getAmazonProductByAsin('B0X');
    expect(res.status).toBe('not_configured');
    expect(res.product).toBeUndefined();
  });

  it('searchTopCompetitors returns not_configured with empty products', async () => {
    const res = await searchTopCompetitors('card binder');
    expect(res.status).toBe('not_configured');
    expect(res.products).toEqual([]);
  });

  it('getAmazonReviews returns not_configured with empty reviews', async () => {
    const res = await getAmazonReviews('B0X');
    expect(res.status).toBe('not_configured');
    expect(res.reviews).toEqual([]);
  });
});
