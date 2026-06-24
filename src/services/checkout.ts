/**
 * Stripe Checkout entry (Step 6 of docs/PAYWALL_CREDIT_METERING_DESIGN.md).
 *
 * Invokes the create-checkout-session edge fn and redirects to the returned Stripe url. Dark until
 * the Stripe secrets/prices exist (the fn returns `price_not_configured` / `stripe_not_configured`
 * until then). The canonical tiers are the credit-metered ones; the legacy pricing UIs map their
 * ids to these via `toCheckoutTier`.
 */
import { supabase } from '@/integrations/supabase/client';

export type CheckoutTier = 'starter' | 'pro' | 'studio' | 'scale';
export type CheckoutInterval = 'month' | 'year';

/** Map a legacy pricing-UI id (PaywallModal / PricingPaywall) to a canonical credit tier. */
export function toCheckoutTier(legacyId: string): CheckoutTier {
  switch (legacyId) {
    case 'professional':
    case 'pro':
      return 'pro';
    case 'premium':
    case 'studio':
      return 'studio';
    case 'enterprise':
    case 'scale':
      return 'scale';
    case 'starter':
    default:
      return 'starter';
  }
}

/** Start a Stripe Checkout for a tier; redirects the browser to the Stripe url. Throws on failure. */
export async function startCheckout(tier: CheckoutTier, interval: CheckoutInterval = 'month'): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(
    'create-checkout-session',
    { body: { tier, interval } },
  );
  if (error) throw new Error(error.message);
  if (!data?.url) throw new Error(data?.error ?? 'checkout_unavailable');
  window.location.href = data.url;
}
