# Stripe Checkout — membership hook-up runbook

What's built (this repo) and the **manual Stripe + secrets steps** to make membership
go live. Until the secrets are set the functions return `503` and the UI shows a
graceful "checkout isn't available yet" — nothing breaks.

## The flow

```
PricingPaywall / UpgradeDialog  ──"Become a member"──▶  /v1/subscribe (choose tier)
        │ supabase.functions.invoke('create-checkout-session', { tier })
        ▼
create-checkout-session (edge, verify_jwt=true)  ──▶  Stripe-hosted Checkout
        │  (membership NOT granted here)
        ▼  user pays
Stripe  ──webhook──▶  stripe-webhook (edge, verify_jwt=false, signature-verified)
        │  upsert user_subscriptions (PK user_id): status/tier/period/stripe ids
        ▼
src/lib/entitlement.isMember()  reads user_subscriptions (active/trialing)
        ▼
Trial gate lifts: UI (V4Fix), service (fixService.addPiece), AND DB trigger
(enforce_trial_piece_limit) all treat the user as a member → whole funnel unlocked.
```

`user_subscriptions` is written **only** by the webhook (service role). RLS already
has an owner SELECT policy, so `isMember` reads work; there is intentionally no
client INSERT/UPDATE policy.

## Code map

| Piece | Path |
| --- | --- |
| Checkout session | `supabase/functions/create-checkout-session/index.ts` |
| Webhook (writes subs) | `supabase/functions/stripe-webhook/index.ts` |
| Function flags | `supabase/config.toml` (`create-checkout-session` jwt=true; `stripe-webhook` jwt=false) |
| Entitlement read | `src/lib/entitlement.ts` + `src/hooks/useEntitlement.ts` |
| Paywall CTA | `src/pages/PricingPaywall.tsx` (`handleSelectTier`) |
| Return handling | `src/pages/v4/V4Fix.tsx` (`?checkout=success` → refetch entitlement) |
| Server gate | `supabase/migrations/20260629160000_trial_piece_limit_gate.sql` |

## Manual hook-up (do these in order)

### 1. Stripe dashboard — products & prices
Start in **test mode**. Create one Product per tier you want to sell (Starter,
Professional, Premium, and/or a Founding tier) with a **recurring Price**. Copy each
`price_…` id. (Optional one-time **setup-fee** Price → `STRIPE_PRICE_SETUP`.)

### 2. Set the secrets (Supabase function env)
Dashboard → Edge Functions → Secrets, or CLI:
```bash
npx supabase secrets set --project-ref ecdrxtbclxfpkknasmrw \
  STRIPE_SECRET_KEY=sk_test_xxx \
  STRIPE_PRICE_STARTER=price_xxx \
  STRIPE_PRICE_PROFESSIONAL=price_xxx \
  STRIPE_PRICE_PREMIUM=price_xxx \
  STRIPE_PRICE_FOUNDING=price_xxx   # optional
  # STRIPE_PRICE_SETUP=price_xxx    # optional one-time setup fee
  # APP_URL=https://ideabrandcoach.icodemybusiness.com  # optional; this is the default
```
`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` are already present.

### 3. Deploy the functions
```bash
npx supabase functions deploy create-checkout-session --project-ref ecdrxtbclxfpkknasmrw
npx supabase functions deploy stripe-webhook --project-ref ecdrxtbclxfpkknasmrw
```

### 4. Stripe webhook endpoint
Stripe dashboard → Developers → Webhooks → Add endpoint:
- **URL:** `https://ecdrxtbclxfpkknasmrw.supabase.co/functions/v1/stripe-webhook`
- **Events:** `checkout.session.completed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`
- Copy the signing secret and set it:
```bash
npx supabase secrets set --project-ref ecdrxtbclxfpkknasmrw STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### 5. Test
Use a Stripe test card (`4242 4242 4242 4242`, any future expiry/CVC). Pick a tier
on `/v1/subscribe`, complete Checkout, land back on `/v4/fix?checkout=success` — the
banner should be gone and "Add a piece" should work (membership active). Verify a
row appeared: `select user_id, tier, status from user_subscriptions;`.

### 6. Go live
Swap the secrets to live-mode keys/prices, add a live-mode webhook endpoint, redeploy
is not needed (same code; only secrets change).

## Notes
- A started-but-unpaid checkout never grants access — only the webhook writes `user_subscriptions`.
- Tier travels in `subscription_data.metadata.tier`; the webhook also reverse-maps the
  price id as a fallback.
- One row per user (`user_id` PK). A re-subscribe upserts the same row.
- Cancellation: `customer.subscription.deleted` sets status `canceled` → `isMember` false
  → the trial gate re-applies (they keep one piece; the rest re-locks).
