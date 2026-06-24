# Credit-Metered Paywall — Design of Record (2026-06-20)

Branch: `feat/paywall-seam` (worktree, off `origin/main`). Builds the free-diagnostic → paid-analysis
paywall as **credit-metered subscription tiers**, where credits map to **real Anthropic token spend ×
margin** so pricing is cost-based and provably profitable. Supersedes the subscription-unlock draft.

> Designed solo (the design workflow's subagent runner hit a 401 — needs `/login`). The 3 metering
> architectures and the adversarial dimensions were reasoned through inline; the must-fixes are folded in (§8).

---

## 1. Architecture decision — HYBRID metering

Considered three strategies:
- **Post-debit** — run the op, debit actual tokens after. Simplest; can overspend a near-zero balance.
- **Pre-auth hold** — reserve an estimate, settle to actual. Safest; most moving parts (holds, settlement).
- **HYBRID (chosen)** — a cheap **pre-check reserve gate** blocks starting an op when balance < the op-class
  floor; the op runs; on a **successful** model response the **actual** `usage` is debited **atomically**.
  Worst case a user dips at most ~one op's cost negative, then is locked out. Accurate, overspend-bounded,
  no hold/settlement machinery.

It **extends** the existing UI (`PaywallModal.tsx`, `PricingPaywall.tsx` at `/v1/subscribe`) — we wire their
stubbed `handleUpgrade`/`handleSelectTier` to real Stripe Checkout; we do not rebuild them.

**Enforcement is server-side.** The metered edge fns themselves gate + debit (the client gate is UX only).

---

## 2. Cost & pricing model (the crux)

**Model rates** (Anthropic API list, per million tokens — ASSUMPTION, verify against live billing; prompt-cache
reads bill ~10% of input):

| Model | input $/MTok | output $/MTok |
|---|---|---|
| Haiku 4.5 | 1.00 | 5.00 |
| Sonnet 4.x | 3.00 | 15.00 |
| Opus 4.x | 15.00 | 75.00 |

Stored in a **`model_rates`** table (authoritative; editable without redeploy).

**Definitions**
- `rawCostUSD(op) = (input_tokens·inRate + output_tokens·outRate) / 1e6`
- **1 credit is backed by `COST_PER_CREDIT_USD = $0.004` of raw model cost ≈ ~800 tokens** (blended, mostly Sonnet; Haiku-heavy ops yield more tokens/credit, Opus fewer). This single peg locks the chain: **dollars ↔ credits ↔ tokens**.
- `creditsDebited(op) = max(1, ceil(rawCostUSD(op) / 0.004))`
- `tokens/mo ≈ credits/mo × ~800`
- Customers pay ≈ **$0.008–0.0145 per credit** (less at higher tiers), so margin is baked in:
  `grossMargin ≈ (pricePerCredit − 0.004) / pricePerCredit ≈ 50–72%` floor at full utilization (higher in practice).

**Tiers map to MODES, not just sizes** (prices set by value; credits are the cost-control cap; allotments
PROVISIONAL — calibrated from the usage we record pre-launch). $/credit descends with tier (real volume discount):

| Tier | Credits/mo | Monthly | Annual | $/credit | Margin floor (full use) | Best for |
|---|---|---|---|---|---|---|
| Starter | 2,000 | $29 | $290 | $0.0145 | ~72% | try it / 1 small brand, light |
| Pro | 6,000 | $79 | $790 | $0.0132 | ~70% | **ongoing maintenance** — steady brand work |
| Studio | 15,000 | $149 | $1,490 | $0.0099 | ~60% | **all-in rebrand sprint** — your first month / a big push |
| Scale | 100,000 | $799 | $7,990 | $0.0080 | ~50% | agency / team — many brands |

**The chain — $/mo ↔ credits/mo ↔ tokens/mo** (`tokens ≈ credits × ~800`): Starter $29 → 2,000 cr → ~1.6M tok · Pro $79 → 6,000 cr → ~4.8M tok · Studio $149 → 15,000 cr → ~12M tok · Scale $799 → 100,000 cr → ~80M tok.

**Active-user usage (estimate, tracked live).** A steady user ≈ ~250K tokens/week → ~1.1M/mo (~1,300 credits, ~$5 raw cost) — well inside Pro's ~4.8M. Casual users a fraction; an all-in sprint several×. Measured per-user in the usage dashboard (Tableau / in-app); recorded now with both flags OFF to calibrate.

**Usage envelope (estimated — to be measured).** Intense, hands-on branding burns ~250–400 credits/active hour
(the coach is an agentic tool loop: ~9–25 cr/turn; + audits 6 / briefs 9 / heavy engine runs ~70). So a
**2-week all-in rebrand push (~40 hrs) ≈ ~10–15k credits → a Studio month.** Pro (6k) suits steady ongoing work
(~1 hr/day), not an all-day sprint; a very heavy full-month all-in tips into a top-up or Scale. **Agent burn is
hard to predict a priori (context size, prompt caching, tool-loop depth swing it 2–3×) — so `meterAndDebit`
RECORDS usage while both flags are OFF, and final allotments are set from that real data before we ever charge.**

**Recommended positioning:** up/downgrade freely (Stripe proration) — **Studio for your all-in branding month,
drop to Pro/Starter for maintenance** — and/or buy a one-time **credit top-up pack** for a spike without changing
tiers (lower friction than a tier hop; converts would-be churn into a downgrade).

**Worked op costs** (so the numbers are real):

| Op | Model | ~in/out tok | raw $ | credits |
|---|---|---|---|---|
| Trust Gap interpretation | Haiku | 2,000 / 500 | $0.0045 | 2 |
| Funnel audit (vision) | Sonnet | 3,000 / 900 | $0.0225 | 6 |
| Export brief / prompt | Sonnet | 4,000 / 1,500 | $0.0345 | 9 |
| Coach turn (w/ tools) | Sonnet | 6,000 / 1,000 | $0.0330 | 9 |
| Heavy engine run (≈8 Sonnet calls) | Sonnet | — | ~$0.25–0.33 | ~65–85 |

→ These are SINGLE-op maxes; real months mix ops. A balanced **maintenance** month sits well under a Pro
allotment; an **all-in sprint** month is a Studio (see the usage envelope above). Allotments are finalized from
what `meterAndDebit` records pre-launch (flags off), not from these estimates.

---

## 3. Data model (new tables; RLS read-own, writes service-role/SECURITY DEFINER only)

```sql
-- which tier the user is on (one row per user)
user_subscriptions (
  user_id uuid PK REFERENCES auth.users ON DELETE CASCADE,
  tier text NOT NULL,                 -- starter|pro|studio|scale
  status text NOT NULL,               -- active|trialing|past_due|canceled
  interval text NOT NULL,             -- month|year
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
)
-- cached balance (truth = SUM(ledger); cache updated atomically by the RPCs)
credit_wallets ( user_id uuid PK REFERENCES auth.users ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0, updated_at timestamptz DEFAULT now() )
-- append-only; every grant (+) and debit (-)
credit_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PK,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  delta integer NOT NULL,             -- +grant / -debit / +-adjustment
  reason text NOT NULL,               -- grant|debit|refund|adjustment
  op_name text, model text, input_tokens int, output_tokens int, raw_cost_usd numeric(12,6),
  stripe_event_id text,               -- set on grants; UNIQUE → webhook idempotency
  balance_after integer NOT NULL,
  created_at timestamptz DEFAULT now()
)
CREATE UNIQUE INDEX ON credit_ledger (stripe_event_id) WHERE stripe_event_id IS NOT NULL;
model_rates ( model text PK, input_per_mtok_usd numeric NOT NULL,
  output_per_mtok_usd numeric NOT NULL, updated_at timestamptz DEFAULT now() )
```

**RLS:** `user_subscriptions`, `credit_wallets`, `credit_ledger` → `SELECT` where `user_id = auth.uid()`;
**no client INSERT/UPDATE policy at all.** `model_rates` → service-role read (edge fns).

**RPCs (SECURITY DEFINER, owner-run):**
- `grant_credits(p_user, p_credits, p_reason, p_stripe_event_id)` — idempotent on `stripe_event_id`
  (ON CONFLICT DO NOTHING); inserts +ledger, sets wallet (refill-to-allotment on cycle; config toggle for
  additive/rollover). Called by the webhook only.
- `debit_credits(p_user, p_op, p_model, p_in_tok, p_out_tok)` — computes `raw_cost` from `model_rates`,
  `credits = max(1, ceil(raw/0.004))`, then **atomically** `UPDATE credit_wallets SET balance = balance - credits
  ... RETURNING balance` (single statement = race-safe), inserts −ledger with `balance_after`. Returns
  `{balance, locked: balance <= 0}`. Called by the meter util (service role) only.

---

## 4. Metering — the shared seam

There is **no shared Anthropic client** today (each edge fn `fetch`es `api.anthropic.com` and reads `usage`
implicitly). Add:

- **`supabase/functions/_shared/meter.ts`**
  - `assertCredits(userId, op)` → pre-check: if `PAYWALL_ENFORCED` and (`!activeSub` or `balance < FLOOR[op]`)
    → return a 402-style `{ needs_upgrade: true }`. (No-op when the server flag is off.)
  - `meterAndDebit(userId, op, model, usage)` → calls `debit_credits` RPC with `usage.input_tokens/output_tokens`.
    Always RECORDS usage (analytics) even when enforcement is off; only BLOCKS when enforced.
- **Wire the metered fns** (2 lines each): after a successful Anthropic response, `const usage = json.usage;
  await meterAndDebit(userId, '<op>', model, usage);`. Metered: `audit-asset`, `identify-decision-trigger`,
  `export-brief`, `marketing-audit`, `idea-framework-consultant(-claude)` (coach turns),
  `competitor-analysis-asset`, `brand-copy-generator`, `reveal-signature`, the avatar-* engine fns.
- **FREE — never metered/gated:** the self-report diagnostic (`/v1/diagnostic`, `diagnostic-interpretation`)
  and its result. That's the lead magnet.
- **Debit only on success.** A failed/`!resp.ok` model call → no debit (no charge-for-nothing); a refund
  ledger path exists for the rare post-debit failure.

---

## 5. Stripe

- 4 tiers × {monthly, annual} = 8 Prices in Stripe (TEST mode first), mapped in
  `supabase/functions/_shared/stripeConfig.ts`: `tier → {priceMonthly, priceYearly, credits}`.
- **`create-checkout-session`** (verify_jwt=true): look up/create `stripe_customer_id`, create a
  **subscription-mode** Checkout Session for the chosen price, `metadata{user_id, tier, credits}`,
  `success_url=/v1/subscribe/success`, `cancel_url=/v1/subscribe`. Secrets: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_*`.
- **`stripe-webhook`** (verify_jwt=false): **verify signature** (`STRIPE_WEBHOOK_SECRET`) — reject if invalid.
  - `checkout.session.completed` / `invoice.paid` → `grant_credits(user, tierCredits, 'grant', event.id)`
    (idempotent) + upsert `user_subscriptions` (status active, period dates, tier, interval).
  - `customer.subscription.updated` → status/tier/cancel_at_period_end; **upgrade** grants the delta now,
    **downgrade/cancel** applies at period end.
  - `customer.subscription.deleted` → status canceled.
  - **Grant policy (default):** refill to the tier allotment each cycle (use-it-or-lose-it) for predictable
    cost; `ROLLOVER`/top-up is a config toggle.

---

## 6. Feature flags + tester safety (non-negotiable)

- **`VITE_PAYWALL_ENABLED`** (frontend, default OFF) — gates the `<RequirePaid>` UI. OFF ⇒ perfect no-op.
- **`PAYWALL_ENFORCED`** (edge-fn env, default false) — gates server-side `assertCredits` blocking. OFF ⇒ fns
  still RECORD usage (so we learn real costs pre-launch) but never block.
- **Both OFF through the tester window (week of 6/21).** Testers never see a wall; the free diagnostic is
  always free. We flip them on only after Alpha, once the live cost data confirms the rates.

---

## 7. Adversarial fixes folded in

1. **Double-spend/concurrency** → debit is a single atomic `UPDATE ... RETURNING` (no app-side read-modify-write);
   ledger `balance_after` recorded. Bounded overspend (≤ one op).
2. **Server-side enforcement** → metered edge fns gate+debit; client `<RequirePaid>` is UX only.
3. **Webhook idempotency** → `UNIQUE(stripe_event_id)` on grants + signature verification mandatory; replays no-op.
4. **No client minting** → wallets/ledger have NO client write policy; only SECURITY DEFINER RPCs (service role) write.
5. **Margin across models** → `model_rates` authoritative; `ceil(raw/0.004)`, min 1 credit/op; Haiku and Opus
   both bill proportionally.
6. **Zero/low balance mid-op** → pre-check reserve floor blocks starting; debit only on success; last op may dip
   slightly negative then lock.
7. **Free-flow + flag-off** → diagnostic never calls meter/gate; both flags OFF = no behavior change.
8. **Upgrade/downgrade/annual** → upgrade grants delta immediately; downgrade/cancel at period end; annual = same
   credits/cycle at the discounted price.

---

## 8. Implementation step plan (ordered; each has a verify) + file ownership

1. **Migration** — the 4 tables + RLS + `grant_credits`/`debit_credits` RPCs + seed `model_rates`. *Verify:*
   migration applies; RLS test (cross-user SELECT = 0 rows; client INSERT denied); `debit_credits` atomic under a
   concurrent test.
2. **`_shared/meter.ts`** + unit tests (`assertCredits`, `meterAndDebit`, free-op bypass, flag-off no-op).
3. **Wire metered edge fns** (2 lines each) — record usage; gate when enforced. *Verify:* a metered call writes a
   −ledger row with real tokens; the diagnostic writes nothing.
4. **`create-checkout-session`** + **`stripe-webhook`** edge fns + `_shared/stripeConfig.ts` + `stripe` dep.
   *Verify:* test-card checkout → `invoice.paid` → `grant_credits` → balance set; forged signature rejected;
   duplicate event no-ops.
5. **`useEntitlement()`** hook ({ hasActiveSub, tier, balance, loading }) + a small balance display.
6. **Wire `PricingPaywall`/`PaywallModal`** to `create-checkout-session` (remove stubs); add `/v1/subscribe/success`
   (polls balance) + cancel.
7. **`<RequirePaid>`** gate at the paid-analysis entry; `VITE_PAYWALL_ENABLED` flag in `src/config/features.ts`.
   *Verify:* flag OFF = today's behavior; flag ON + no balance = wall; entitled = open; persists on reload.
8. **Runbook** — secrets to set, Stripe test cards, the cost-model rates, how/when to flip both flags, the
   live-mode go-live checklist.

**Owns:** new `supabase/migrations/<ts>_credit_paywall.sql`, `supabase/functions/{create-checkout-session,
stripe-webhook}/`, `supabase/functions/_shared/{meter.ts,stripeConfig.ts}`, 2-line edits in the metered fns,
`src/hooks/useEntitlement.ts`, `src/components/paywall/RequirePaid.tsx`, edits to `PaywallModal.tsx`,
`PricingPaywall.tsx`, `src/config/features.ts`, `src/App.tsx`, regenerate `types.ts`.
**Don't touch:** the free diagnostic logic, coach/funnel engines beyond the 2-line meter add, competitor/figma/
canva code, the MCP server core.

---

## 9. THE GOAL (`/goal`)

```
The credit-metered paywall is built behind two default-OFF flags on feat/paywall-seam: paid AI ops debit credits = ceil(realAnthropicTokenCost / $0.004) via an atomic SECURITY-DEFINER RPC; subscription tiers (2000/5000/10000/100000 credits, monthly+annual) grant credits on a signature-verified, idempotent Stripe webhook; a signed-in user out of credits sees the existing PaywallModal/PricingPaywall and a Stripe TEST checkout refills them; the FREE self-report diagnostic stays free; clients can never mint credits (RLS read-own, writes service-role only); both flags OFF is a perfect no-op so testers never hit a wall; tsc/lint/test green; no secrets committed.
```

## 10. THE LOOP PROMPT (`/loop`) — see the credit-metered build prompt in
`_bmad-output/loop-prompts-paywall-seam-2026-06-20.md` (kept in sync with this doc).

---

## 11. Stripe go-live runbook (TEST mode first — human-gated)

The money-flow is built DARK: `create-checkout-session` + `stripe-webhook` are deployed but inert until
the secrets + Stripe products exist. To activate in TEST:

1. **Stripe products/prices (TEST mode):** one Product per tier, a recurring Price per interval. Note each price id.
2. **Supabase secrets** (dashboard or `supabase secrets set`):
   - `STRIPE_SECRET_KEY` (sk_test_…), `STRIPE_WEBHOOK_SECRET` (whsec_… from step 4)
   - `STRIPE_PRICE_STARTER_MONTH` / `_STARTER_YEAR` / `_PRO_MONTH` / `_PRO_YEAR` / `_STUDIO_MONTH` /
     `_STUDIO_YEAR` / `_SCALE_MONTH` / `_SCALE_YEAR` (only the ones you created; an unset price → that
     tier/interval returns `price_not_configured`).
   - `APP_URL` (optional; defaults to the prod SPA URL for the success/cancel redirects).
3. **Deploy:** `npx supabase functions deploy create-checkout-session stripe-webhook` (config.toml sets
   verify_jwt true / false respectively).
4. **Webhook endpoint:** Stripe → Developers → Webhooks → add `https://<project>.functions.supabase.co/stripe-webhook`,
   subscribe to `invoice.paid`, `customer.subscription.created` / `.updated` / `.deleted`; copy the signing
   secret into `STRIPE_WEBHOOK_SECRET` and redeploy.
5. **Smoke test (TEST):** POST create-checkout-session `{tier:'pro',interval:'month'}` → open the url → pay with
   `4242 4242 4242 4242` (any future expiry / any CVC). Confirm: `invoice.paid` fires → `credit_ledger` has a
   `+6000` grant (replay the event → NO second grant, idempotent) → `credit_wallets.balance = 6000` →
   `user_subscriptions.status = active`. Then a metered op (audit / decision-trigger) debits and the ledger nets out.
6. **Going LIVE** is a separate, deliberate switch: swap to live keys/prices, re-point the webhook, and only THEN
   flip `VITE_PAYWALL_ENABLED` / `PAYWALL_ENFORCED` on — after the tester window. Until then everything stays dark.

> NOTE: the Stripe SDK is imported in-fn via `https://esm.sh/stripe@14.21.0?target=deno` (`createFetchHttpClient` +
> `createSubtleCryptoProvider` for async signature verification). If a deploy flags the version/`apiVersion`, bump
> them — the pure tier↔price↔credits + event-classification logic is in `_shared/stripeConfig.ts` /
> `_shared/stripeWebhook.ts` and is unit-tested independently.
