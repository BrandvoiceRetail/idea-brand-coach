/**
 * stripe-webhook — the ONLY writer of user_subscriptions.
 *
 * Stripe calls this (no browser JWT → verify_jwt=false) on checkout + subscription
 * lifecycle events. It verifies the Stripe signature, then upserts the user's
 * subscription row (PK = user_id, one row per user) via the service role. That row
 * is what src/lib/entitlement.ts reads to decide membership (status in
 * active/trialing) and what the DB trial-limit trigger checks — so membership is
 * driven entirely by Stripe's source of truth, never by the client.
 *
 * Secrets (Supabase function env):
 *   STRIPE_SECRET_KEY      — to construct the client + retrieve subscriptions
 *   STRIPE_WEBHOOK_SECRET  — signing secret for this endpoint (whsec_…)
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno&deno-std=0.168.0';
import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/edge-auth.ts';

type Tier = 'starter' | 'professional' | 'premium' | 'founding';

/** Reverse-map a Stripe price id back to a tier, for subs missing metadata.tier. */
function tierFromPrice(priceId: string | undefined): Tier | null {
  if (!priceId) return null;
  const map: Record<string, Tier> = {
    [Deno.env.get('STRIPE_PRICE_STARTER') ?? '_']: 'starter',
    [Deno.env.get('STRIPE_PRICE_PROFESSIONAL') ?? '_']: 'professional',
    [Deno.env.get('STRIPE_PRICE_PREMIUM') ?? '_']: 'premium',
    [Deno.env.get('STRIPE_PRICE_FOUNDING') ?? '_']: 'founding',
  };
  return map[priceId] ?? null;
}

function isoFromEpoch(sec: number | null | undefined): string | null {
  return typeof sec === 'number' ? new Date(sec * 1000).toISOString() : null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const secret = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret || !webhookSecret) {
    return new Response(JSON.stringify({ error: 'Billing is not configured.' }), { status: 503 });
  }

  const stripe = new Stripe(secret, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  });

  // Verify the Stripe signature over the RAW body (Deno needs the async + SubtleCrypto variant).
  const sig = req.headers.get('stripe-signature');
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    if (!sig) throw new Error('missing signature');
    event = await stripe.webhooks.constructEventAsync(
      raw, sig, webhookSecret, undefined, Stripe.createSubtleCryptoProvider(),
    );
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', err instanceof Error ? err.message : err);
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 });
  }

  const service = getServiceClient();

  /** Upsert the user's subscription row from a Stripe Subscription. */
  async function syncSubscription(sub: Stripe.Subscription, fallbackUserId?: string | null): Promise<void> {
    // Resolve the owner: subscription metadata → session fallback → existing row by customer.
    let userId = (sub.metadata?.user_id as string | undefined) ?? fallbackUserId ?? null;
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null;
    if (!userId && customerId) {
      const { data } = await service
        .from('user_subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .limit(1)
        .maybeSingle();
      userId = data?.user_id ?? null;
    }
    if (!userId) {
      console.error('[stripe-webhook] could not attribute subscription to a user; skipping', sub.id);
      return;
    }

    const priceId = sub.items?.data?.[0]?.price?.id;
    const tier = (sub.metadata?.tier as Tier | undefined) ?? tierFromPrice(priceId) ?? 'professional';
    const interval = sub.items?.data?.[0]?.price?.recurring?.interval ?? 'month';

    const { error } = await service.from('user_subscriptions').upsert(
      {
        user_id: userId,
        tier,
        status: sub.status,
        interval,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        current_period_start: isoFromEpoch(sub.current_period_start),
        current_period_end: isoFromEpoch(sub.current_period_end),
        cancel_at_period_end: sub.cancel_at_period_end ?? false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (error) console.error('[stripe-webhook] upsert failed:', error.message);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await syncSubscription(sub, session.client_reference_id ?? (session.metadata?.user_id as string | undefined));
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      default:
        // Other events are acknowledged but ignored.
        break;
    }
  } catch (err) {
    console.error('[stripe-webhook] handler error:', err instanceof Error ? err.message : err);
    return new Response(JSON.stringify({ error: 'Handler error' }), { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
