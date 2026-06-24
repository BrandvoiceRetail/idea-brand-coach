# Brand Funnel Tracker — Execution Backlog (sequenced, adversarially reviewed)

> **Date:** 2026-06-18 · **Status:** execution-ready, dependency-ordered
> **Source:** Matthew's confirmed decisions (#1–#4) + carried defaults (A/B/C) + a verified code-inspection of the funnel branch, then run through an adversarial sequencing critic. Effort: **S** ≤1d · **M** 2–4d · **L** 1–2wk.
> **Code location:** the funnel tracker lives on `worktree-customer-journey-tracking` (a git worktree), **not yet merged**. Key files: `FunnelTracker.tsx`, `SupabaseBrandFunnelService.ts`, `supabase/functions/audit-asset/index.ts`, `touchpointTaxonomy.ts`.

## Confirmed decisions (baked in)
1. **Scoring** — keep flat `(i+d+e+a)/4` for Beta, but source weights + threshold from a **per-stage config table** (stage-weighting later = data change, no rebuild).
2. **Decision Trigger** — auditor emits a structured `decision_trigger_flag` **alongside** I/D/E/A; tag sentence generated from it; **DT stays OUT of the composite score**.
3. **ROI** — build **both** the per-test Testing & Lift tab (exists) **and** the cumulative lift rollup (net-new).
4. **Multi-brand** — add `brand_id` across the data model **now** + brand-scoped RLS; UI stays single-brand.
Defaults: **A** merge funnel branch first · **B** reuse the IV-OS append-only ledger for the audit trail (no new table) · **C** guardrails are a hard gate before any paywall.

---

## ⚠️ Top risk + the one decision I need from you

**The merge is bigger than "resolve drift."** Verified: `feat/competitor-agents` forked from a funnel-inclusive point and has since **independently rewritten the same four files** the funnel branch did — `FunnelTracker.tsx`, `FixDialog.tsx`, `SupabaseBrandFunnelService.ts`, `audit-asset/index.ts` — and competitor-agents even split `TestingLiftTab.tsx` out of `FunnelTracker`. Every task below edits those files, so a sloppy merge silently invalidates the file/line targets (e.g. W4-ROI's old `~L276-304` won't exist post-merge). This is **W0-MERGE = L, semantic conflicts, not textual.**

**Decision needed (dev call, yours):** what's the merge target/strategy?
- (a) merge funnel → `feat/competitor-agents` (carry the competitor work as the base),
- (b) merge both → a **fresh integration branch off main** (cleanest history, my lean),
- (c) rebase one onto the other.

Everything in Wave 0 is gated on this answer.

---

## Wave 0 — Unblock (nothing else starts until these land)

### W0-MERGE · Integrate the funnel + competitor lines — **L**
Merge per the decision above. Treat as a semantic merge of two full rewrites of the same 4 files, not a drift resolution. Keep competitor-agents' `FunnelTracker.competitor.test.tsx` green.
- **Files:** `FunnelTracker.tsx`, `FixDialog.tsx`, `SupabaseBrandFunnelService.ts`, `audit-asset/index.ts`, `TestingLiftTab.tsx` (split-out on competitor-agents), `brand_assets`/competitor migrations
- **Depends-on:** merge-target decision · **Implements:** Default A

### W0-TIMESTAMPS · Resolve migration-timestamp collisions + allocate new ones — **S**
The funnel branch already has a **duplicate** `20260617000000_*` (two migrations share it). Resolve that, and pre-allocate distinct timestamps for the ~4 new migrations below so apply-order is deterministic.
- **Files:** `supabase/migrations/` (rename the dupe; reserve timestamps) · **Depends-on:** W0-MERGE · **Implements:** hygiene (critic finding)

### W0-TYPES · Regenerate types + green the build — **S**
Regenerate `types.ts` against live schema; `tsc --noEmit` + `npm test` clean. Gate before feature work.
- **Files:** `src/integrations/supabase/types.ts` (regen — never hand-edit) · **Depends-on:** W0-MERGE · **Implements:** Default A

---

## Wave 1 — Foundations (schema + config; everything binds to these)

### W1-BACKFILL · Populate `avatars.brand_id` from the brands table — **M**
**Prerequisite for W1-BRANDID.** On-branch, `20260301065445_create_avatars_table.sql` already added a **nullable** `avatars.brand_id`, but the funnel migration `20260616120000` assumed it didn't exist and scopes RLS via `avatars.user_id`; existing rows are almost certainly NULL. Populate `avatars.brand_id` (from `getOrCreateDefaultBrand` / the brands table) so downstream backfills aren't backfilling NULL.
- **Files:** NEW migration (backfill `avatars.brand_id`); cross-check `getOrCreateDefaultBrand` · **Depends-on:** W0-TYPES · **Implements:** Decision #4 (data prereq) · **Ask-First:** `database-migrator`

### W1-BRANDID · `brand_id` across the model + brand-scoped RLS — **L**
Add `brand_assets.brand_id` (backfill from `avatars.brand_id`, NOT-NULL after); **rewrite the 4-policy RLS on `brand_assets` AND `brand_tests`** (both currently join through `avatars.user_id`, verified) to scope by brand; carry `brand_id` through every read/write in the service. UI stays single-brand.
- **Files:** NEW migration (`brand_assets.brand_id` + RLS rewrite on `brand_assets`/`brand_tests`); `20260616120000_brand_funnel_tracker.sql` (RLS rewrite target); `SupabaseBrandFunnelService.ts` · **Depends-on:** W1-BACKFILL · **Implements:** Decision #4 · **Ask-First:** `database-migrator`

### W1-CONFIG · Per-stage scoring config table — **M**
Move the hardcoded `≥70` threshold + implicit equal weights into `funnel_scoring_config` (stage, w_i/w_d/w_e/w_a, pass_threshold) **with its own RLS** (global-read or per-brand — decide). Beta still computes flat `(i+d+e+a)/4`; the table only sources the weights/threshold.
- **Files:** NEW migration `funnel_scoring_config` + RLS; `audit-asset/index.ts` (~L228 read config vs literal); `touchpointTaxonomy.ts` (stage keys) · **Depends-on:** W0-TYPES (parallel to W1-BRANDID) · **Implements:** Decision #1 · **Ask-First:** `database-migrator`

### W1-SNAPSHOTS · `last_audit_run_at` + append-only snapshots — **M**
Add `brand_assets.last_audit_run_at`; create `brand_asset_snapshots` (asset_id, brand_id, scored_at, i/d/e/a, overall, status) **+ RLS**. The time-series substrate that ROI trend, coverage trend, and the stat-strip timestamp all read — **must precede all three.**
- **Files:** NEW migration; `audit-asset/index.ts` (write snapshot + stamp on each run) — **note: this edits the same `audit-asset` block as W1-CONFIG and the W2 auditor rewrite; do them as one coordinated auditor change, not three colliding edits**; `SupabaseBrandFunnelService.ts` · **Depends-on:** W1-BRANDID (carries brand_id) · **Implements:** Trevor-item + enabler for W4-ROI/W3-STATSTAMP/coverage-trend · **Ask-First:** `database-migrator`

### W1-REGEN · Regenerate types after the Wave-1 migrations — **S**
- **Files:** `types.ts` · **Depends-on:** W1-BRANDID, W1-CONFIG, W1-SNAPSHOTS · **Implements:** known `types.ts`-drift hygiene

---

## Wave 2 — Scoring + Diagnosis (one coordinated auditor change)

### W2-AUDITOR · Structured `decision_trigger_flag` + structured diagnosis tags — **M**
One combined `audit-asset` output rewrite + **one** migration (avoids a second collision on the same file/table). Auditor emits `decision_trigger_flag` (which named trigger missing/misapplied) **alongside** I/D/E/A, plus a structured `diagnosis_tags` object (rationale, fix, dimension, severity); the human-readable tag sentence is generated from the flag + fields. **Composite math stays `Math.round((i+d+e+a)/4)`, untouched** (verified). Import the existing `DecisionTrigger` type from `avatarS3Triggers.ts` and pull the DT v2.2 taxonomy from `feat/decision-trigger` — don't re-spec.
- **Files:** `audit-asset/index.ts` (output + prompt; input mapping ~L77-90 stays); NEW migration (`brand_assets.decision_trigger_flag` + `diagnosis_tags` in one); `SupabaseBrandFunnelService.ts`; `FixDialog.tsx` · **Depends-on:** W1-CONFIG, W1-SNAPSHOTS (same auditor block) · **Implements:** Decision #2 + Trevor structured-tags · **Ask-First:** `database-migrator`

### W2-REGEN · Regenerate types after Wave-2 migration — **S**
- **Depends-on:** W2-AUDITOR

---

## Wave 3 — UI Surfacing (presentation; data already present)

### W3-DIMBARS · DimensionBars on every Funnel Map card — **S**
Reuse the existing `DimensionBars` component (verified FunnelTracker ~L45-60) on each map grid card (map shows only `overall_score` today; bars render only in the rows tab). **Templating reuse, not a new component.**
- **Files:** `FunnelTracker.tsx` · **Depends-on:** W0-TYPES · **Implements:** Trevor-item

### W3-COVSEG · Segment the coverage bar by status — **S**
Single gradient fill (~L196) → segmented bar (aligned/stale/misaligned/missing); counts already exist as stat cards.
- **Files:** `FunnelTracker.tsx` · **Depends-on:** W0-TYPES · **Implements:** Trevor-item + P2 default

### W3-STATSTAMP · "Last audited" timestamp in the stat strip — **S**
- **Files:** `FunnelTracker.tsx`, `SupabaseBrandFunnelService.ts` · **Depends-on:** W1-SNAPSHOTS · **Implements:** Trevor-item

### W3-DTBADGE · Surface `decision_trigger_flag` on cards / FixDialog — **S**
- **Files:** `FunnelTracker.tsx`, `FixDialog.tsx` · **Depends-on:** W2-AUDITOR · **Implements:** Decision #2 (UI)

---

## Wave 4 — ROI rollup + Audit trail (capstone)

### W4-ROI · Cumulative lift rollup — **M**
Portfolio-level cumulative lift on top of the per-test Testing & Lift tab (`recordTest()`/`closeTest()` already built). **Rebase the aggregation onto `TestingLiftTab.tsx`** (split out on competitor-agents post-merge — the old `FunnelTracker ~L276-304` target is stale). Net-new = the rollup calc + trend join on `brand_asset_snapshots`.
- **Files:** `TestingLiftTab.tsx`, `SupabaseBrandFunnelService.ts` (aggregate `brand_tests.lift` for won tests + snapshot trend) · **Depends-on:** W1-SNAPSHOTS, W0-MERGE (file moved) · **Implements:** Decision #3

### W4-AUDIT · Wire Approve → IV-OS append-only ledger — **L**
Route funnel Approve/status-change through `update_asset_status` + `record_assessment` (record the structured verdict from W2); history view via `get_asset_history`. **Reuse the existing ledger — no new `asset_events` table.**
- **Files:** `SupabaseBrandFunnelService.ts`, `src/mcp/` ledger tools, `FunnelTracker.tsx` (history view) · **Depends-on:** W1-BRANDID, W2-AUDITOR · **Implements:** Default B · **Ask-First:** touches MCP / identity-gated writes — confirm before wiring

---

## Cross-cutting gate (parallel; blocks paywall, not the build)

### XG-GUARDRAILS · Per-user rate-limit + usage alerts + server-side quotas — **M**
Hard gate before any **paid** rollout of the auditor (every `audit-asset` run is LLM spend). Reuse the deployed diagnostic-interpretation abuse-control pattern (IP rate-limit + body cap, secrets-overridable). **Build from W0-TYPES in parallel — NOT gated on W2** (it meters the entry point, which exists today).
- **Files:** `audit-asset/index.ts` (entry rate-limit/quota) · **Depends-on:** W0-TYPES · **Implements:** Default C

---

## Cross-cutting: tests (AGENTS.md mandates ≥85% on new code)
Not optional and currently unowned in any single task — add per wave: keep `FunnelTracker.competitor.test.tsx` green through W0; new tests for the auditor output schema (W2) and the ROI rollup math (W4); `npm test` + `tsc --noEmit` green before each handoff.

---

## One-screen summary

| Wave | Tasks | Effort | Gate cleared |
|------|-------|--------|--------------|
| **0 — Unblock** | W0-MERGE (L), W0-TIMESTAMPS (S), W0-TYPES (S) | ~L+2S | Branches integrated, migrations ordered, build green |
| **1 — Foundations** | W1-BACKFILL (M), W1-BRANDID (L), W1-CONFIG (M), W1-SNAPSHOTS (M), W1-REGEN (S) | ~L+3M+S (~2–3wk) | Config-driven scoring, brand_id + RLS, snapshots substrate (Decisions #1, #4) |
| **2 — Scoring/Diagnosis** | W2-AUDITOR (M), W2-REGEN (S) | ~M+S (~1wk) | Structured DT flag + diagnosis tags, composite still clean (Decision #2) |
| **3 — UI Surfacing** | W3-DIMBARS, W3-COVSEG, W3-STATSTAMP, W3-DTBADGE (all S) | ~4S (~3–4d) | DimBars everywhere, segmented coverage, audit timestamp, DT badge (Trevor items) |
| **4 — ROI/Audit** | W4-ROI (M), W4-AUDIT (L) | ~M+L (~2wk) | Cumulative rollup + ledger-backed approval trail (Decision #3, Default B) |
| **XG — Guardrails** | XG-GUARDRAILS (M) | ~M | Rate-limit/quota/alerts → **blocks paywall, not the build** (Default C) |

**Sequencing rules enforced:** merge-target decision → W0; `avatars.brand_id` backfill **before** W1-BRANDID; W1-CONFIG + W1-SNAPSHOTS + W2-AUDITOR all edit `audit-asset` → one coordinated change, not colliding edits; W1-SNAPSHOTS before W3-STATSTAMP / W4-ROI / coverage-trend; W2-AUDITOR before W3-DTBADGE; types regen after every migration wave; XG parallel from W0 (decoupled from W2). **Reuse-over-rebuild:** DimensionBars, Testing & Lift tab, IV-OS ledger, `DecisionTrigger` type, abuse-control pattern.

**Riskiest items:** (1) **W0-MERGE** — full-file divergence on 4 shared files; (2) the **`avatars.brand_id` backfill** (nullable, unpopulated, named source required). Both are addressed above; neither is hand-waved.
