/**
 * create-checkout-session — start a Stripe Checkout for a membership tier.
 *
 * The browser calls this (authenticated) with a tier; it returns a Stripe-hosted
 * Checkout URL the frontend redirects to. Membership itself is granted ONLY by the
 * stripe-webhook (on checkout.session.completed / subscription events) writing
 * user_subscriptions — never here — so a started-but-unpaid session never grants
 * access. src/lib/entitlement.ts reads that table to flip isMember.
 *
 * Auth: verify_jwt=true + getAuthedUserId (rejects anon). The success/cancel URLs
 * are built from APP_URL (server-trusted) — never from the request body — so this
 * can't be used as an open redirect.
 *
 * Secrets (Supabase function env; never committed):
 *   STRIPE_SECRET_KEY                 — Stripe secret key (sk_live_… / sk_test_…)
 *   STRIPE_PRICE_STARTER|PROFESSIONAL|PREMIUM|FOUNDING — recurring price ids per tier
 *   STRIPE_PRICE_SETUP                — OPTIONAL one-time setup-fee price id (added as a line item if set)
 *   APP_URL                          — OPTIONAL site origin for return URLs (defaults to prod)
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno&deno-std=0.168.0';
import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient, getAuthedUserId, jsonResponse } from '../_shared/edge-auth.ts';
import { APP_URL } from '../_shared/appUrl.ts';

type Tier = 'starter' | 'professional' | 'premium' | 'founding';

const PRICE_ENV: Record<Tier, string> = {
  starter: 'STRIPE_PRICE_STARTER',
  professional: 'STRIPE_PRICE_PROFESSIONAL',
  premium: 'STRIPE_PRICE_PREMIUM',
  founding: 'STRIPE_PRICE_FOUNDING',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const secret = Deno.env.get('STRIPE_SECRET_KEY');
  if (!secret) return jsonResponse({ error: 'Billing is not configured yet.' }, 503);

  try {
    const userId = await getAuthedUserId(req);
    if (!userId) return jsonResponse({ error: 'Authentication required' }, 401);

    const body = (await req.json().catch(() => ({}))) as { tier?: string };
    const tier = body.tier as Tier | undefined;
    if (!tier || !(tier in PRICE_ENV)) {
      return jsonResponse({ error: 'Unknown membership tier.' }, 400);
    }
    const priceId = Deno.env.get(PRICE_ENV[tier]);
    if (!priceId) {
      return jsonResponse({ error: `The ${tier} tier is not configured for checkout yet.` }, 503);
    }

    const stripe = new Stripe(secret, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const service = getServiceClient();

    // Reuse the user's Stripe customer if we've seen one, so repeat checkouts don't
    // create duplicate customers. Email is best-effort (for the Stripe dashboard).
    const { data: existing } = await service
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .not('stripe_customer_id', 'is', null)
      .limit(1)
      .maybeSingle();

    let customerId = existing?.stripe_customer_id ?? null;
    if (!customerId) {
      const { data: userRes } = await service.auth.admin.getUserById(userId);
      const customer = await stripe.customers.create({
        email: userRes?.user?.email ?? undefined,
        metadata: { user_id: userId },
      });
      customerId = customer.id;
    }

    const lineItems: { price: string; quantity: number }[] = [{ price: priceId, quantity: 1 }];
    const setupPrice = Deno.env.get('STRIPE_PRICE_SETUP');
    if (setupPrice) lineItems.push({ price: setupPrice, quantity: 1 });

    const appUrl = APP_URL;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: lineItems,
      // user_id travels on BOTH the session and the subscription so the webhook can
      // resolve the owner regardless of which event arrives first.
      client_reference_id: userId,
      metadata: { user_id: userId, tier },
      subscription_data: { metadata: { user_id: userId, tier } },
      allow_promotion_codes: true,
      success_url: `${appUrl}/v4/fix?checkout=success`,
      cancel_url: `${appUrl}/v1/subscribe?checkout=cancelled`,
    });

    return jsonResponse({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[create-checkout-session] error:', err instanceof Error ? err.message : err);
    return jsonResponse({ error: 'Could not start checkout. Please try again.' }, 500);
  }
});
