# Decision Trigger™ — Agent & Testing Context

Feature-local context for the **Decision Trigger** panel: the named psychological
trigger derived after the Trust Gap scorecard, grounded in the seller's real
reviews. Spec: *Decision Trigger Developer Brief v2.20* (Slack, 2026-06-15);
build plan: `docs/decision-trigger/BUILD_PLAN.md`.

## What this feature is

After the Trust Gap scorecard, this panel reveals the ONE psychological trigger
the seller's customers act on (one of six: Identity, Belonging, Permission,
Fear-of-Loss, Recognition, Momentum), with 2-3 **verbatim** review phrases and a
single placement instruction. The trigger is **derived, never chosen** — the
value is in the derivation.

## The pieces

| Layer | Path | Notes |
|-------|------|-------|
| Pure prior + types | `src/lib/decisionTrigger.ts` | Stage-1 deterministic prior (§5.2 mapping). Edge fn carries a mirror copy (Deno boundary). |
| Hook | `src/components/decision-trigger/useDecisionTrigger.ts` | Calls `identify-decision-trigger`; sessionStorage cache by (scores+evidence) signature; stale-write guard. Idle unless `enabled`. |
| Panel | `src/components/decision-trigger/DecisionTriggerPanel.tsx` | 3 parts (label+anchor / verbatim evidence / placement) + "Why this trigger" expansion. Locked teaser without evidence. |
| Edge fn | `supabase/functions/identify-decision-trigger/index.ts` | Deterministic prior + one Sonnet(4-6) call → persists to `decision_triggers` under RLS. |
| Table | `supabase/migrations/20260615120000_create_decision_triggers.sql` | Owner-scoped RLS; `dominant_confidence` server-side only; `supporting_*` present-but-unpopulated (Beta). |

## Invariants (do not regress)

- **No calculation leaks.** The panel must never render a confidence score,
  percentage, per-type colour-badge system, or CAPTURE weighting table
  (brief §3.4). Guarded by `DecisionTriggerPanel.test.tsx`.
- **Evidence is verbatim.** `evidence_phrases` are copied from the seller's
  reviews/listing — never paraphrased or invented. Enforced in the fn prompt +
  the acceptance bar.
- **Grounded only.** Requires an imported listing/reviews + an authed caller;
  no derivation from scores alone.
- **Alpha scope = dominant trigger only.** Supporting trigger, CAPTURE copy
  generation, re-run, and per-avatar are Beta (brief §7.3) — columns exist but
  stay unpopulated.

## How to test

1. **Unit:** `npm test -- decisionTrigger DecisionTriggerPanel` (prior mapping +
   panel states + the no-score-leak guard).
2. **Live (authed):** QA account (`docs/TEST_ACCOUNT.md`) → complete a diagnostic
   → import an ASIN → the panel reveals the trigger after the scorecard. Confirm a
   `decision_triggers` row lands (SQL) and the phrases are verbatim from
   `user_product_reviews`. Validated on the real binder ASIN B0CJBQ7F5C (Empathetic
   primary gap → Recognition).
3. The model call shares the `diagnostic-interpretation` 500-class risk (unescaped
   quotes in cited evidence); the fn mitigates with the single-quote rule + one
   reroll. If you see underivable 500s, check the `detail` field first.
