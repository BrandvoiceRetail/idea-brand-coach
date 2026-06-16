# Decision Trigger™ — Build Plan (Alpha-scope)

**Worktree:** `.claude/worktrees/decision-trigger` · **Branch:** `feat/decision-trigger`
**Base:** `feature/intelligent-memory` @ 0b2ff96 (the live Alpha lineage = product-data + memory; consultant v12). Decision Trigger consumes Trust Gap scores + review corpus, neither of which is on `main`.
**Source of truth:** Trevor's *Decision Trigger Developer Brief v2.20 ("Avatar 2.20")* + *Session Report* (Slack DM 2026-06-15; cached + summarised in memory `project_decision_trigger_alpha_proposal`).

---

## ⚠️ Gating — do not start implementation yet

This worktree is **staged, not authorised to build**. Two gates first:

1. **Scope decision pending.** Trevor *proposed* (for discussion, not decided) moving the dominant-trigger panel from Beta into Alpha. Matthew's call + the call with Trevor settle whether this is Alpha or stays Beta. This plan is written Alpha-scope so it's ready either way.
2. **De-risk before build (Trevor's own suggestion).** Dry-run the two-stage derivation prompt against the **Guyology fixture inputs** (the diagnostic answers + review excerpts in `Guyology_Labs_Recognition_Led_Listing_Rewrite.docx`) and confirm it independently reaches **Recognition (+ Permission)**. If the prompt can't reproduce the manual result, fix the prompt before writing any schema/UI. This is the cheapest possible validation of the whole feature.

Until both clear, this branch holds the plan only.

---

## What it is (one paragraph)

A **derived** (never user-chosen) named output that identifies the single psychological mechanism causing a customer to act now, and tells the seller exactly where to deploy it. Derived from data already in the flow: the four Trust Gap pillar scores + the imported review corpus. The value is entirely in the derivation — *"a dropdown makes it a label maker, not an insight engine."* Output must **feel like a finding, not a calculation** (no scores/algorithm surfaced).

## Where it plugs into the live flow

Brief's position: after the Trust Gap Scorecard, before the Signature. Real surfaces on this base:

| Layer | Existing file (consumed) | DT adds |
|---|---|---|
| Scorecard | `src/components/diagnostic/TrustGapScorecard.tsx` | DT panel renders after it |
| Page wiring | `src/pages/DiagnosticResults.tsx` (holds `importedProducts` + `evidence`) | invoke DT once scorecard + evidence present |
| Evidence source | `src/hooks/useTrustGapInterpretation.ts`, `TrustGapEvidence` | reuse the same review-evidence inputs |
| Import | `supabase/functions/import-product-data` → `user_products` / `user_product_reviews` | review corpus = DT Stage-2 input |
| Pattern to mirror | `supabase/functions/diagnostic-interpretation/index.ts` (single `index.ts`, 2-call shape) | new sibling fn |

---

## Data model — `decision_triggers` table

New migration `supabase/migrations/<UTCstamp>_create_decision_triggers.sql` (mirror `20260604120000_user_products.sql`: RLS on, user-scoped, `search_path` pinned per the hardening migrations). Schema from brief §4.2:

```
decision_triggers (
  id uuid pk,
  session_id text not null,
  avatar_id uuid null,
  dominant_type text not null check (in Identity|Belonging|Permission|Fear-of-Loss|Recognition|Momentum),
  brand_anchor text not null,
  evidence_phrases text[] not null,        -- 2-3 verbatim review quotes
  placement_instruction text not null,     -- ≤2 sentences
  dominant_confidence real,                 -- INTERNAL ONLY — never sent to client panel
  supporting_type text null,                -- Beta
  supporting_confidence real null,          -- Beta
  why_this_trigger text,                    -- secondary expansion, plain language
  model_version text,
  generated_at timestamptz default now(),
  user_id uuid not null default auth.uid()  -- RLS owner
)
```
RLS: owner-only select/insert (copy the `user_products` policies). `dominant_confidence` stays server-side; the panel never receives it.

## Edge function — `supabase/functions/identify-decision-trigger/index.ts`

Two-stage (brief §5.3):
- **Stage 1 — Haiku** (`claude-haiku-4-5-20251001`): 4 Trust Gap scores → prior over Identity/Belonging/Permission/Recognition (table §5.2: low Empathetic→Recognition, low Distinctive→Identity, low Insight→Permission, low Authentic→Belonging).
- **Stage 2 — Sonnet** (`claude-sonnet-4-6` — **NOT** `claude-sonnet-4-20250514`; that string is retired and still lingers in `diagnostic-interpretation`/`reveal-signature` on this base — do not copy it): review corpus → (a) verbatim evidence phrases for the favoured trigger(s), (b) comparison/research language → **Momentum**, (c) regret/delay language → **Fear-of-Loss**. Momentum/Fear-of-Loss can win independent of the Stage-1 prior.
- Dominant = highest combined confidence after Stage 2.
- **Borrow the v8 reliability fixes from `diagnostic-interpretation`**: single-quote citations rule + one reroll on unparseable JSON + max_tokens headroom + `detail` in the 500 body (unescaped quotes-in-evidence was the root cause of the interpretation 500s — DT cites evidence too, same landmine).

## The six triggers / CAPTURE config

Reference brief §2 (cards) + §6.2 (the `capture_weighting` JSON). At Alpha the config block is loaded as a **generator seed only** (single dominant trigger; no supporting-trigger fill, no live copy generation — that's Beta). Store the JSON as a typed fixture, e.g. `supabase/functions/identify-decision-trigger/captureWeighting.ts`, kept byte-in-sync with the brief's §6.2.

## Output panel — `src/components/decision-trigger/`

3 components, nothing else on first view (brief §3):
1. `DecisionTriggerLabel` — name + one-line brand anchor.
2. `DecisionTriggerEvidence` — 2-3 verbatim review quotes (exact, no paraphrase).
3. `DecisionTriggerPlacement` — one ≤2-sentence deployment instruction naming a CAPTURE element.
Plus a tap-to-expand `WhyThisTrigger` (one paragraph, plain language — no "confidence", no "Stage 1/2", no model names). **Explicitly NOT in the panel:** any score/percentage, colour-coded badges, CAPTURE weighting table, supporting trigger (Beta).
Add `src/components/decision-trigger/AGENTS.md` when the first component lands (feature-local testing context per repo convention).

---

## Alpha vs Beta scope (brief §7.2 / §7.3)

**Alpha (this branch, IF the scope decision says so):**
- [ ] Stage-1 Haiku prior classification *(Must)*
- [ ] Stage-2 Sonnet evidence + Momentum/Fear-of-Loss *(Must)*
- [ ] `decision_triggers` schema + migration; `supporting_*` columns present but unpopulated *(Must)*
- [ ] 3-component panel *(Must)*
- [ ] "Why this trigger" expansion *(Should)*
- [ ] CAPTURE config block loaded as seed, dominant only *(Must)*
- [ ] PDF export integration — DT panel between Scorecard and Signature *(Should)*

**Beta (NOT this branch):** supporting trigger, supporting-trigger CAPTURE fill, live CAPTURE copy generation, re-run/refresh, per-avatar trigger.

## Task DAG (each step: change → verify)

1. **Prompt dry-run** vs Guyology fixture → *verify:* reaches Recognition+Permission with verbatim evidence. **(gate — do first)**
2. Migration → *verify:* `supabase db` applies clean; RLS blocks cross-user select (SQL probe).
3. Edge fn Stage 1 → *verify:* known scores produce expected prior (unit/contract test).
4. Edge fn Stage 2 + merge → *verify:* on 3 real brands incl. one Momentum/Fear-of-Loss-dominant; evidence phrases are verbatim from `user_product_reviews` (SQL match).
5. Panel components → *verify:* renders the 3 parts; no score/badge leaks; mobile clean.
6. Wire into `DiagnosticResults` after scorecard → *verify:* live walk on QA account (`docs/TEST_ACCOUNT.md`), row persists + retrievable on reload.
7. PDF integration → *verify:* DT panel appears between Scorecard and Signature in export.

## Acceptance (brief §8)

Verified on **≥3 real brands with different Trust Gap profiles** (incl. one expected Momentum/Fear-of-Loss). Evidence phrases verbatim/near-verbatim (never invented). Placement instruction ≤2 sentences naming a CAPTURE element. Brand anchor from the six approved (Apple/Nike/Innocent/Spotify-Gymshark/Lego/Netflix). No confidence/score/algorithm anywhere in the panel. Stored against `session_id`, retrievable on reload. **Quality bar:** feels like a *finding* a seller hadn't articulated — measured against the **Guyology rewrite** (the regression fixture). Matthew builds/runs; Trevor reviews against the InfinityVault bar.

## Open questions (brief §9)

1. Recognition vs Belonging distinguishable in practice? (validate vs 2-3 real review sets)
2. Review-only Momentum/Fear-of-Loss derivation is new + unvalidated — test a brand expected to be each.
3. Brand-anchor list fixed/hardcoded for Alpha? (Trevor: yes for Alpha)
4. Trademark usage consistency (Decision Trigger™ / Trust Gap Score™ / CAPTURE™) across app + docs.

## Guardrails

Feature branch only; commit+push fine; **never merge to main** (operator HALT — and DT stacks on the unmerged product-data→memory lineage, so merge order is product-data → intelligent-memory → decision-trigger). Protected paths still apply (`supabase/migrations` via migration files, not ad-hoc DDL; no `src/integrations/supabase/types.ts` hand-edits — regenerate). No `any`; Zod-validate the fn response; evidence phrases must be **verbatim** (acceptance gate). Use current model strings only.
