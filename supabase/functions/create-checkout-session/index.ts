import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { getServiceClient, getAuthedUserId } from "../_shared/edge-auth.ts";
import { isTier, isInterval, priceIdFor, creditsForTier } from "../_shared/stripeConfig.ts";

/**
 * create-checkout-session (Step 4 of docs/PAYWALL_CREDIT_METERING_DESIGN.md).
 *
 * Authed (verify_jwt true). Body: { tier, interval }. Ensures a Stripe customer for the user and
 * persists the user↔customer mapping in user_subscriptions EARLY (so stripe-webhook can resolve the
 * user regardless of event ordering), then opens a subscription-mode Checkout Session and returns
 * its url. TEST keys only until go-live. No charges happen here — the webhook grants credits on
 * invoice.paid. Pure tier↔price↔credits logic lives in _shared/stripeConfig.ts (unit-tested).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://ideabrandcoach.icodemybusiness.com";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!STRIPE_SECRET_KEY) return json({ error: "stripe_not_configured" }, 500);

    const userId = await getAuthedUserId(req);
    if (!userId) return json({ error: "unauthorized" }, 401);

    const { tier, interval } = await req.json();
    if (!isTier(tier)) return json({ error: "invalid_tier" }, 400);
    const iv = isInterval(interval) ? interval : "month";

    const priceId = priceIdFor(tier, iv, (k) => Deno.env.get(k));
    if (!priceId) return json({ error: "price_not_configured", detail: `${tier}/${iv}` }, 500);

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });
    const svc = getServiceClient();

    // Resolve or create the Stripe customer, and persist the user↔customer mapping early.
    const { data: existing } = await svc
      .from("user_subscriptions").select("stripe_customer_id").eq("user_id", userId).maybeSingle();
    let customerId = existing?.stripe_customer_id as string | null ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({ metadata: { user_id: userId } });
      customerId = customer.id;
      await svc.from("user_subscriptions").upsert({
        user_id: userId,
        tier,
        interval: iv,
        status: "incomplete",
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    }

    const credits = creditsForTier(tier);
    const meta = { user_id: userId, tier, interval: iv, credits: String(credits) };
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL}/v1/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/v1/subscribe`,
      allow_promotion_codes: true,
      metadata: meta,
      subscription_data: { metadata: meta },
    });

    return json({ url: session.url });
  } catch (err) {
    console.error("create-checkout-session error:", err instanceof Error ? err.message : err);
    return json({ error: "checkout_failed" }, 500);
  }
});
