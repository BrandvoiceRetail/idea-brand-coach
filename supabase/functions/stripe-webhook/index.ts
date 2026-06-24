import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { getServiceClient } from "../_shared/edge-auth.ts";
import { classifyEvent, type StripeEventLike } from "../_shared/stripeWebhook.ts";

/**
 * stripe-webhook (Step 4 of docs/PAYWALL_CREDIT_METERING_DESIGN.md).
 *
 * verify_jwt MUST be false (Stripe calls it). Verifies the Stripe signature against the RAW body,
 * then routes via the pure classifyEvent():
 *  - `grant` (invoice.paid): resolve the user by stripe_customer_id, call grant_credits (IDEMPOTENT
 *    on the Stripe event id), refill to the tier allotment, sync the subscription row.
 *  - `update_subscription` (customer.subscription.*): sync status / tier / period / cancel flag.
 * Credits are written ONLY here, via the service-role RPCs. Returns 500 on a recoverable failure so
 * Stripe retries (grant_credits is idempotent, so retries never double-grant).
 */

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

const toIso = (unixSeconds: number | null): string | null =>
  unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;

serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) return new Response("stripe_not_configured", { status: 500 });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("missing signature", { status: 400 });

  const rawBody = await req.text(); // RAW body is required for signature verification
  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody, sig, STRIPE_WEBHOOK_SECRET, undefined, Stripe.createSubtleCryptoProvider(),
    );
  } catch (err) {
    console.error("stripe-webhook signature verification failed:", err instanceof Error ? err.message : err);
    return new Response("invalid signature", { status: 400 });
  }

  try {
    const svc = getServiceClient();
    const intent = classifyEvent(event as unknown as StripeEventLike, (k) => Deno.env.get(k));

    if (intent.kind === "grant") {
      const { data: sub } = await svc
        .from("user_subscriptions").select("user_id").eq("stripe_customer_id", intent.customerId).maybeSingle();
      const userId = sub?.user_id as string | undefined;
      if (!userId) {
        // Mapping is written at checkout BEFORE payment, so this is an anomaly — 500 so Stripe retries
        // (grant_credits is idempotent on the event id, so retries are safe).
        console.error("stripe-webhook grant: no user for customer", intent.customerId);
        return new Response("no user mapping yet", { status: 500 });
      }
      const { error: grantErr } = await svc.rpc("grant_credits", {
        p_user: userId,
        p_credits: intent.credits,
        p_reason: "grant",
        p_stripe_event_id: event.id,
        p_set_to_allotment: true,
      });
      if (grantErr) {
        console.error("stripe-webhook grant_credits failed:", grantErr.message);
        return new Response("grant failed", { status: 500 });
      }
      await svc.from("user_subscriptions").update({
        tier: intent.tier,
        interval: intent.interval,
        status: "active",
        stripe_subscription_id: intent.subscriptionId,
        current_period_end: toIso(intent.periodEnd),
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId);
    } else if (intent.kind === "update_subscription") {
      const update: Record<string, unknown> = {
        status: intent.status,
        cancel_at_period_end: intent.cancelAtPeriodEnd,
        stripe_subscription_id: intent.subscriptionId,
        updated_at: new Date().toISOString(),
      };
      if (intent.tier) update.tier = intent.tier;
      if (intent.interval) update.interval = intent.interval;
      if (intent.periodEnd) update.current_period_end = toIso(intent.periodEnd);
      await svc.from("user_subscriptions").update(update).eq("stripe_customer_id", intent.customerId);
    }
    // intent.kind === 'ignore' → acknowledged, nothing to do

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("stripe-webhook handler error:", err instanceof Error ? err.message : err);
    return new Response("handler error", { status: 500 });
  }
});
