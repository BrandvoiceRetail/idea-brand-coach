/**
 * Stripe tier configuration (Step 4 of docs/PAYWALL_CREDIT_METERING_DESIGN.md).
 *
 * Deno-free + pure (no top-level `Deno.env` / `esm.sh`) so it imports cleanly under vitest. The
 * Stripe price ids live in Supabase secrets (one per tier × interval) and are resolved through an
 * INJECTED `env` accessor; the credit allotments are the product's source of truth and live here.
 */
export type Tier = 'starter' | 'pro' | 'studio' | 'scale';
export type Interval = 'month' | 'year';

export interface TierConfig {
  tier: Tier;
  /** Monthly credit allotment (use-it-or-lose-it; refilled to this each billing cycle). */
  credits: number;
  /** Supabase-secret names that hold the Stripe price ids for each interval. */
  priceEnv: Record<Interval, string>;
}

/** Source of truth for the per-tier credit allotment (mode-based ladder). */
export const TIERS: Record<Tier, TierConfig> = {
  starter: { tier: 'starter', credits: 2_000,   priceEnv: { month: 'STRIPE_PRICE_STARTER_MONTH', year: 'STRIPE_PRICE_STARTER_YEAR' } },
  pro:     { tier: 'pro',     credits: 6_000,   priceEnv: { month: 'STRIPE_PRICE_PRO_MONTH',     year: 'STRIPE_PRICE_PRO_YEAR' } },
  studio:  { tier: 'studio',  credits: 15_000,  priceEnv: { month: 'STRIPE_PRICE_STUDIO_MONTH',  year: 'STRIPE_PRICE_STUDIO_YEAR' } },
  scale:   { tier: 'scale',   credits: 100_000, priceEnv: { month: 'STRIPE_PRICE_SCALE_MONTH',   year: 'STRIPE_PRICE_SCALE_YEAR' } },
};

export type EnvGet = (key: string) => string | undefined;

export function isTier(x: unknown): x is Tier {
  return typeof x === 'string' && Object.prototype.hasOwnProperty.call(TIERS, x);
}

export function isInterval(x: unknown): x is Interval {
  return x === 'month' || x === 'year';
}

/** Credit allotment for a tier. */
export function creditsForTier(tier: Tier): number {
  return TIERS[tier].credits;
}

/** Resolve the Stripe price id for a tier + interval from the injected env; null if unset. */
export function priceIdFor(tier: Tier, interval: Interval, env: EnvGet): string | null {
  return env(TIERS[tier].priceEnv[interval]) || null;
}

/** Reverse lookup (webhook): which {tier, interval, credits} does a Stripe price id map to? */
export function tierForPriceId(
  priceId: string,
  env: EnvGet,
): { tier: Tier; interval: Interval; credits: number } | null {
  for (const cfg of Object.values(TIERS)) {
    for (const interval of ['month', 'year'] as Interval[]) {
      if (env(cfg.priceEnv[interval]) === priceId) {
        return { tier: cfg.tier, interval, credits: cfg.credits };
      }
    }
  }
  return null;
}
