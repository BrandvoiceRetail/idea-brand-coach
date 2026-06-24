import { describe, it, expect } from 'vitest';
import { isTier, isInterval, creditsForTier, priceIdFor, tierForPriceId, type EnvGet } from '../stripeConfig';

// Only a subset of price ids configured — mirrors a partially-set-up Stripe (e.g. annual not yet created).
const env: EnvGet = (k) => (({
  STRIPE_PRICE_STARTER_MONTH: 'price_starter_m',
  STRIPE_PRICE_PRO_MONTH: 'price_pro_m',
  STRIPE_PRICE_PRO_YEAR: 'price_pro_y',
  STRIPE_PRICE_STUDIO_MONTH: 'price_studio_m',
  STRIPE_PRICE_SCALE_MONTH: 'price_scale_m',
} as Record<string, string>)[k]);

describe('tier config', () => {
  it('has the mode-based credit allotments', () => {
    expect(creditsForTier('starter')).toBe(2000);
    expect(creditsForTier('pro')).toBe(6000);
    expect(creditsForTier('studio')).toBe(15000);
    expect(creditsForTier('scale')).toBe(100000);
  });
  it('guards tiers and intervals', () => {
    expect(isTier('pro')).toBe(true);
    expect(isTier('gold')).toBe(false);
    expect(isTier(3)).toBe(false);
    expect(isInterval('month')).toBe(true);
    expect(isInterval('year')).toBe(true);
    expect(isInterval('week')).toBe(false);
  });
});

describe('priceIdFor', () => {
  it('resolves a configured price id', () => {
    expect(priceIdFor('pro', 'month', env)).toBe('price_pro_m');
    expect(priceIdFor('pro', 'year', env)).toBe('price_pro_y');
  });
  it('returns null when the price id is not configured', () => {
    expect(priceIdFor('starter', 'year', env)).toBeNull();
    expect(priceIdFor('scale', 'year', env)).toBeNull();
  });
});

describe('tierForPriceId (webhook reverse lookup)', () => {
  it('maps a price id back to tier + interval + credits', () => {
    expect(tierForPriceId('price_pro_m', env)).toEqual({ tier: 'pro', interval: 'month', credits: 6000 });
    expect(tierForPriceId('price_pro_y', env)).toEqual({ tier: 'pro', interval: 'year', credits: 6000 });
    expect(tierForPriceId('price_scale_m', env)).toEqual({ tier: 'scale', interval: 'month', credits: 100000 });
  });
  it('returns null for an unknown price id', () => {
    expect(tierForPriceId('price_unknown', env)).toBeNull();
  });
});
