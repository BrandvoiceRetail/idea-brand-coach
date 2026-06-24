# Paywall Seam — Goal + Loop Prompt (CREDIT-METERED, 2026-06-20)

Builds the free-diagnostic → paid-analysis paywall as **credit-metered subscription tiers** where credits map to
**real Anthropic token spend × margin**. Full design of record:
`.claude/worktrees/paywall-seam/docs/PAYWALL_CREDIT_METERING_DESIGN.md`. Build in the `feat/paywall-seam` worktree.

---

## THE GOAL (paste into `/goal`)

```
The credit-metered paywall is built behind two default-OFF flags on feat/paywall-seam: paid AI ops debit credits = ceil(realAnthropicTokenCost / $0.004) via an atomic SECURITY-DEFINER RPC; subscription tiers (2000/5000/10000/100000 credits, monthly+annual) grant credits on a signature-verified, idempotent Stripe webhook; a signed-in user out of credits sees the existing PaywallModal/PricingPaywall and a Stripe TEST checkout refills them; the FREE self-report diagnostic stays free; clients can never mint credits (RLS read-own, writes service-role only); both flags OFF is a perfect no-op so testers never hit a wall; tsc/lint/test green; no secrets committed.
```

---

## THE LOOP PROMPT (paste into `/loop`)

```
Build the CREDIT-METERED paywall for IDEA Brand Coach in the feat/paywall-seam worktree. Follow docs/PAYWALL_CREDIT_METERING_DESIGN.md exactly. Work the steps in order; after each, run `npx tsc --noEmit`, `npm run lint`, `npm test`, fix regressions, and loop until every DONE-GATE check passes.

TOOLING
- Consult the shared engineering guide (mango-tools MCP get_best_practice/get_checklist) before non-trivial steps.
- Use the supabase MCP for live schema (list_tables), migrations (apply_migration / database-migrator pattern — never ad-hoc DDL), edge-fn deploy, and secrets. Inspect live schema BEFORE migrating (other sessions drift it).
- TDD: write the failing test first for the debit/grant RPCs, the meter util, useEntitlement, and the gate.
- Work ONLY in this worktree (off origin/main). Do not touch other worktrees or main directly.

GAP
- EXISTS (UI only): PaywallModal.tsx (3 tiers, handleUpgrade = console.log stub), PricingPaywall.tsx (/v1/subscribe, handleSelectTier stub, "TODO Stripe", references a user_subscriptions table that doesn't exist), useAuth.tsx.
- MISSING: credit ledger + wallet + subscriptions + model_rates tables; the SECURITY-DEFINER debit/grant RPCs; the shared meter util; metering at the edge-fn call sites; Stripe checkout + webhook; the entitlement hook + gate; the flags.
- No shared Anthropic client: each edge fn fetches api.anthropic.com and the response carries usage.input_tokens/output_tokens — capture it at a new _shared/meter.ts seam.
- The FREE self-report diagnostic (/v1/diagnostic, diagnostic-interpretation) must stay free and unmetered.

PLANNED WORK (each step verifies before moving on)
1. Migration: user_subscriptions, credit_wallets, credit_ledger (UNIQUE stripe_event_id), model_rates (seed Haiku/Sonnet/Opus rates). RLS: SELECT own only; NO client write policy. RPCs (SECURITY DEFINER): grant_credits(user,credits,reason,stripe_event_id) idempotent; debit_credits(user,op,model,in_tok,out_tok) = atomic UPDATE ... SET balance = balance - max(1, ceil(raw/0.004)) RETURNING + ledger insert. Regenerate types.ts.
2. supabase/functions/_shared/meter.ts: assertCredits(userId,op) pre-check (no-op unless PAYWALL_ENFORCED); meterAndDebit(userId,op,model,usage) → debit_credits RPC; always records usage, only blocks when enforced. Unit tests incl. free-op bypass + flag-off no-op.
3. Wire metered edge fns (2 lines each, after a SUCCESSFUL Anthropic response): audit-asset, identify-decision-trigger, export-brief, marketing-audit, idea-framework-consultant(-claude), competitor-analysis-asset, brand-copy-generator, reveal-signature, avatar-* engine fns. Debit ONLY on success.
4. create-checkout-session (verify_jwt=true, subscription mode, TEST keys) + stripe-webhook (verify_jwt=false, signature-verified; invoice.paid → grant_credits idempotent + upsert user_subscriptions; sub.updated/deleted → status/tier; upgrade grants delta now, downgrade/cancel at period end) + _shared/stripeConfig.ts (tier→price→credits). Add the `stripe` dep.
5. src/hooks/useEntitlement.ts ({ hasActiveSub, tier, balance, loading }) + a small balance display.
6. Wire PricingPaywall.handleSelectTier + PaywallModal.handleUpgrade → create-checkout-session → redirect to Stripe URL (remove stubs). Add /v1/subscribe/success (polls balance until granted) + cancel back to /v1/subscribe.
7. src/components/paywall/RequirePaid.tsx at the PAID listing-analysis entry; add VITE_PAYWALL_ENABLED to src/config/features.ts (default OFF). Server truth = PAYWALL_ENFORCED env (default false).
8. Runbook: secrets (STRIPE_*, model rates), test card 4242 4242 4242 4242, how/when to flip BOTH flags, live-mode go-live checklist.

FILE OWNERSHIP
- New: supabase/migrations/<ts>_credit_paywall.sql, supabase/functions/{create-checkout-session,stripe-webhook}/, supabase/functions/_shared/{meter.ts,stripeConfig.ts}, src/hooks/useEntitlement.ts, src/components/paywall/RequirePaid.tsx (+ tests).
- Edit: the metered edge fns (2-line meter add only), PaywallModal.tsx, PricingPaywall.tsx, src/config/features.ts, src/App.tsx, src/integrations/supabase/types.ts (regenerate).
- DO NOT touch: the free diagnostic logic, coach/funnel engines beyond the meter add, competitor/figma/canva code, the MCP server core.

GUARDRAILS
- VITE_PAYWALL_ENABLED and PAYWALL_ENFORCED both DEFAULT OFF and STAY OFF in prod through the tester window (week of 6/21) — testers must NEVER hit a wall; the free self-report diagnostic is always free.
- Stripe TEST mode only; live keys + going live are a separate HUMAN step; no live charges.
- Secrets via Supabase secrets only — never commit, never log card data / PII.
- Credits can ONLY be written by the SECURITY-DEFINER RPCs (service role / webhook). Users read their own balance; a client can never mint or grant credits. The webhook MUST verify the Stripe signature.
- Debit is a single atomic statement (no app-side read-modify-write). Debit only on a successful model response.
- Deploying the dark (flags-off) backend is fine; DO NOT deploy enforcement enabled, and DO NOT break the free flow or the build.

DONE GATE (loop until ALL pass)
- tsc --noEmit clean; lint at/under baseline; npm test green incl. new RPC/meter/gate/webhook tests.
- RLS: cross-user SELECT = 0 rows; a client INSERT/UPDATE to wallet/ledger is DENIED; only the RPCs write.
- Concurrency: two simultaneous debits never double-spend or drop below -(one op); ledger balance_after is consistent.
- Stripe TEST: checkout → invoice.paid → grant_credits → balance set; a forged webhook signature is rejected; a duplicate event no-ops (idempotent).
- Metering: a metered op writes a −ledger row with REAL input/output tokens + raw_cost; the free diagnostic writes nothing.
- Flags OFF: app behaves exactly as today (no wall, free flow intact) — verified. Flag ON (local): out-of-credit user is gated, completes a TEST checkout, balance refills, gate opens, persists on reload.
- No secrets in the diff; runbook written; branch is feat/paywall-seam, not deployed with enforcement on.
```

---

## Pricing snapshot (mode-based; full math in the design doc §2)
1 credit ⇐ $0.004 raw model cost; $/credit descends with tier; allotments PROVISIONAL (calibrated from usage
recorded with both flags OFF). Tiers map to MODES:

| Tier | Credits/mo | Monthly | Annual | Best for |
|---|---|---|---|---|
| Starter | 2,000 | $29 | $290 | try it / 1 small brand, light |
| Pro | 6,000 | $79 | $790 | ongoing maintenance — steady |
| Studio | 15,000 | $149 | $1,490 | all-in rebrand sprint (~2-wk push) |
| Scale | 100,000 | $799 | $7,990 | agency / team, many brands |

Up/downgrade freely (Studio for the sprint month → Pro for maintenance) + optional credit top-up packs.
A ~2-week all-in push ≈ ~10–15k credits ≈ a Studio month; an intense hour ≈ ~250–400 credits.
