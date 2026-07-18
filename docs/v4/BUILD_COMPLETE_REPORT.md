# /v4 Surface — Build-Complete Report

**Worktree:** `feat/v4-alpha-surface` · **Date:** 2026-06-27 · **Status:** all 5 loops built + green; review blocker/high fixes applied; gated deploy = **GO-WITH-GATES** (see §8).

This report is the build-out part-2 close: it states the full /v4 spine status (Diagnose → Analyse → Fix → Re-measure → Defend) mapped to the S-03..S-21 backlog, what is green, the blocker/high fixes applied this run, the remaining MEDIUM/LOW punch-list, the observability event catalogue, mobile/E2E coverage, and a deploy GO/NO-GO. Runbook for the actual flip lives in [`PHASE1_REPORT.md`](./PHASE1_REPORT.md).

---

## 1. Spine status by loop (S-03..S-21)

| Loop | Screen(s) | Stories | State |
|------|-----------|---------|-------|
| **1 — Onboarding** | `V4Onboarding` + `OnboardingReflectionRun` / `ContextCard` | S-03..S-06 | ✅ Built + green. Read-it-back build-theatre, honest needs_input/error, "I won't ask twice" Context Card persisted to `V4ContextStore`. |
| **2 — Analyse** | `V4Analyse` + `AnalyseRun` / `AvatarProfile` / `GapDecisionTriggerPanel` / `DecisionBoard` / `MoveBriefClaimGate` | S-07..S-11 | ✅ Built + green. Avatar 2.0, Trust Gap + Decision Trigger, Decision Board, claim-gated brief. **S-10 Decision Board depends on the undeployed `generate_positioning_moves`** → honest no-moves + CTA pass-through (see §3). |
| **3 — Fix** | `V4Fix` + `DriftBanner` / `FunnelMap` / `WhatNeedsWork` / `AssetDetailTabs` | S-12..S-15 | ✅ Built + green. Five-stage map, impact list, per-asset tabs (prompt / brief / check), Positioning Statement drift. Lift ranking honest-degrades to coverage until S-20 analytics land. |
| **4 — Re-measure** | `V4Remeasure` + `TrustGapLiftCard` / `BusinessMetricsCard` | S-16 | ✅ Built + green. Deterministic Trust Gap before/after (mirrors `compute_trust_gap_lift`); business metrics honest no-data until S-20. |
| **5 — Defend** | `V4Defend` + `DriftWatchCard` / `DefendChecklist` / `CompetitorTeaserCard` / `WorkbookExportCard` | S-17 | ✅ Built + green. Drift watch, derived checklist, honest competitor teaser, live `export_workbook`. |
| Cross-cutting | shell / routing / flag | S-18 | ✅ `V4_SPINE` / `V4_ROUTES`, `isV4Forced` FAIL-SAFE default OFF; routes wired in `App.tsx`. |
| Coach transparency | server narration + two-surface check | **S-19** | ⚠️ Open — not in this FE worktree (see §4). |
| Backend analytics | campaign/analytics migration + `get_campaign_metrics` | **S-20** | ⚠️ Unapplied — FE renders honest no-data (by design). |
| E2E + mobile QA | Playwright + 375px | S-21 | 🟡 Partial — mocked specs green, live-backend blocks `test.fixme`; unit coverage now complete (see §6–7). |

`/v4/diagnose` reuses the existing diagnostic surface; Re-measure/Defend are now full screens (the prior `V4Stage` placeholders are superseded).

---

## 2. What's green

- `npx tsc --noEmit` — clean.
- `npx eslint src/components/v4 src/pages/v4` (+ all changed files) — clean.
- `npx vitest run src/components/v4 src/pages/v4` — **15 files / 92 tests passing**, including the 3 net-new suites added this run.
- Every screen renders explicit loading / empty / error+retry states; no fabrication — honest no-data wherever a backend (S-20) or net-new engine (S-10) is absent.

---

## 3. Blocker / High fixes applied this run

All changes are surgical and scoped to `/v4` files (+ the shared PostHog registry, which is the SSOT being repaired).

**BLOCKERS**
1. **Analyse happy-path dead-end (S-10).** `generate_positioning_moves` is undeployed → `DecisionBoard` never yields a selectable move → `Continue to Fix` was permanently disabled, stranding every tester. Fixed in `V4Analyse.tsx`: added `moveEngineUnavailable` (avatar confirmed + board resolved with no moves + honest error) so `canAdvance = Boolean(selectedMoveId) || moveEngineUnavailable` — a move choice is still required when moves exist, but the tester is never trapped. CTA copy adapts.
2. **`DefendChecklist` empty list rendered a bare card.** `items=[]` fell through to an empty `<ul>`. Added an honest empty-state branch (`v4-defend-checklist-empty`).
3. **`V4Fix` verdict button silent no-op.** `onRecordVerdict` was never passed to `AssetDetailTabs` (optional-chained to `undefined`). Added `recordVerdict` to `useFixRun` (reflects on-brand/off-brand on the open asset; durable persistence is the S-20/ledger follow-up — never fabricated) and wired it in `V4Fix`.

**HIGH**
4. **`V4Fix` Export-brief silent no-op.** Wired `onExportBrief` to a real handler (honest sonner hand-off toast; no fake download). Telemetry already emitted by `MoveBriefClaimGate`.
5. **`AvatarProfile` / `GapDecisionTriggerPanel` never showed loading/error.** `V4Analyse` now derives per-step `isLoading`/`error` from the run timeline and passes them through.
6. **`OnboardingReflectionRun` error had no retry.** Added an `onRetry` prop + "Try again" button; `V4Onboarding` passes `handleReadItBack`.
7. **`V4Onboarding` stranded returning users.** `showContext` now seeds from the persisted store and reveals on hydration when `allFilled`.
8. **`V4Remeasure` CTA ungated.** Added `disabled={!canAdvance}` where `canAdvance = !liftLoading && (lift || liftNeedsRun)` — blocks during load / hard-error, allows advance on a real lift OR an honest needs-another-run (deliberately not a hard `!lift` gate, which would trap single-run Alpha testers at the terminal stage — the same anti-pattern as blocker #1).
9. **PostHog `AlphaEventName` bypassed by casts.** All 47 `/v4` event literals added to the `AlphaEventName` union; the `name as AlphaEventName` casts removed across all 21 v4 files (+ unused imports). Event-name typos are now compiler-caught; the registry is the single source of truth.
10. **Stale-avatar reads.** `V4Fix`/`V4Remeasure`/`V4Defend` keyed their one-shot load ref on a boolean, so switching avatars in-place kept stale data. Hooks now expose `avatarId`; the pages key the ref on it and reload on switch.

**Also fixed (low-cost, in the same files):** `V4Analyse` `onRetry` double `moves.find()` collapsed into one lookup.

**Tests added (S-21 coverage AC):** `BusinessMetricsCard.test.tsx`, `DriftWatchCard.test.tsx`, `DefendChecklist.test.tsx` — loading / empty / error+retry / data / telemetry / Tier-C conformance.

---

## 4. Remaining MEDIUM / LOW punch-list (documented, not fixed)

**MEDIUM**
- **S-13 ranking by lift not met** — `get_campaign_metrics` is 🔴 (S-20). `WhatNeedsWork` ranks by coverage severity + P0 (honest), not lift; the list is flat until the analytics migration lands.
- **S-19 coach transparency** — server-narration prompt change + two-surface conformance test are unshipped (not in this FE worktree). AC "coach announces each tool it runs; conformance test green" remains open.
- **`BusinessMetricsCard` no-data redundancy** — at `hasData=false` both the no-data banner and the all-`—` table render. Conditionally render the table only when `hasData`.
- **`AssetDetailTabs` a11y** — tab panels lack `role="tabpanel"` + `aria-labelledby`.
- **`V4Fix` Prompt tab dead-end** — `onGenerateImagePrompt` not wired (`generate_canvas`), so the Prompt tab shows an empty state with no CTA. Wire or hide until the capability is live.

**LOW**
- Stale code comments / AGENTS.md in v4 components still describe the now-removed "cast to `AlphaEventName`" pattern (registry is now the SSOT) — update on next docs pass.
- `OnboardingReflectionRun` step label lacks `min-w-0 break-words` (overflow risk at 375px with long tool names).
- `CompetitorTeaserCard` "coming soon" sits inline with real Defend cards — move to a collapsed Roadmap section.
- Avatar-gate "Go to Analyse" buttons in `V4Remeasure`/`V4Fix` lack `min-h-[40px]` (present on `V4Defend`).
- `useAnalyseRun` exports `isRunning`/`hasRun` unused by `V4Analyse` — wire or trim the interface.

---

## 5. Observability event catalogue (`AlphaEventName`, /v4 block)

All registered in `src/lib/posthogClient.ts`; properties carry IDs/booleans/counts only — never copy or PII.

- **Onboarding:** `v4_onboarding_stage_viewed`, `_read_back_started`, `_findings_confirmed`, `_findings_edited`, `_advanced_to_diagnose`; `v4_diagnose_run_diagnostic_clicked`.
- **Analyse:** `v4_analyse_stage_viewed`, `_gate_blocked`, `_advanced_to_fix`, `_run_started`, `_run_completed`, `_run_failed`, `_step_completed`; `v4_avatar_profile_field_edited`, `_confirmed`; `v4_decision_trigger_viewed`; `v4_decision_board_moves_shown`, `_move_selected`; `v4_brief_claim_gate_viewed`, `_claim_confirmed`, `v4_brief_exported`.
- **Fix:** `v4_fix_stage_viewed`, `_gate_blocked`, `_advanced_to_remeasure`, `_drift_banner_shown`; `v4_funnel_map_viewed`, `_retry`; `v4_funnel_asset_opened`; `v4_what_needs_work_viewed`; `v4_asset_detail_tab_viewed`, `v4_asset_check_run`, `v4_asset_verdict_recorded`.
- **Re-measure:** `v4_remeasure_stage_viewed`, `_gate_blocked`, `_advanced_to_defend`; `v4_trust_gap_lift_viewed`; `v4_business_metrics_viewed`.
- **Defend:** `v4_defend_stage_viewed`, `_gate_blocked`, `_workbook_requested`, `_workbook_result`, `_loop_restarted`, `_drift_watch_viewed`, `_checklist_viewed`, `_competitor_teaser_viewed`.

---

## 6. Mobile / E2E coverage

- **Unit:** 92 v4 tests pass; the 3 added suites complete the 85% AC for Loops 4–5 component states.
- **E2E (S-21):** `tests/e2e/v4-spine.spec.ts` + `v4-flow.spec.ts` cover 375px overflow + honest-empty states against a mocked backend. **Live-backend blocks are `test.fixme`** pending S-20 deploy.
- **Open:** the 375px overflow audit and full happy-path still require a human QA pass (or filled-in fixme blocks) before testers — the build does not assert live mobile correctness end-to-end.

---

## 7. Verification commands

```bash
npx tsc --noEmit
npx eslint src/components/v4 src/pages/v4
npx vitest run src/components/v4 src/pages/v4 --pool=threads
```

---

## 8. Deploy GO / NO-GO

**Verdict: GO-WITH-GATES for the *gated* /v4 deploy (ship behind `isV4Forced` OFF).**

- ✅ Ship-safe to deploy dark: shell + 5 loops green, fail-safe flag default OFF, no prod migration, honest degradation everywhere, no Tier-C leaks.
- ⛔ Do **not** flip `VITE_FORCE_V4` / expose to testers until the gates clear:
  1. **S-20** campaign/analytics migration + `generate_positioning_moves` (S-10) deployed — until then Analyse runs on the pass-through and Fix/Re-measure show honest no-data (functional, but not the full promised value).
  2. **S-19** coach-transparency conformance test green.
  3. **S-21** human 375px QA pass (or fill the `test.fixme` live blocks).
  4. MEDIUM a11y + no-data-table redundancy cleaned.

Follow [`PHASE1_REPORT.md`](./PHASE1_REPORT.md) for the flip runbook; do not deploy from this worktree without the gates above.

---

## 9. Executive summary

The /v4 spine is fully built and green across all five loops, with every screen honest under empty/loading/error and no fabricated data. This run cleared the review's three blockers (the Analyse dead-end that trapped every tester, the empty-checklist bare card, and the silent verdict button) and all highs (loading/error wiring, retry CTAs, returning-user persistence, the ungated Re-measure CTA, stale-avatar reads, and the PostHog cast escape — now a compiler-guarded registry), plus the missing Loop 4–5 unit tests. tsc, eslint, and 92 v4 tests pass. The surface is **GO to deploy dark behind the fail-safe flag**; the tester flip stays **gated** on the S-20 analytics backend, S-19 coach transparency, and a human mobile/E2E pass. Remaining items are MEDIUM/LOW polish, documented above.

---

## 10. Part 3 — desktop + read-back + affordances

A polish pass on the existing five loops (no new screens). Goal: make /v4 use desktop width to match the alpha-ux core-loops mockup (`_bmad-output/mockups/idea-brandcoach-APP-v1-2026-06-24.html`) and close two recovery/layout dead-ends found in review.

### What changed (HIGH fixes, surgical, /v4 only)

- **Read-back balance (Loop 1).** `OnboardingReflectionRun` rendered `AvatarPortraitCard` *inside* the left column of the `md:grid-cols-2` read-back grid. On desktop the 4-field, 2-up portrait towered over the right-hand timeline rail and collapsed the two-column balance. The portrait now renders **full-width beneath both columns** (`mt-6` row after the grid closes), so the restatement + timeline sit side-by-side and the portrait spreads across the content width — matching the mockup's wide avatar block. No behaviour change; the `findingCount > 0` gate is preserved.
- **Analyse error recovery (Loop 2).** `AnalyseRun`'s top-of-page `runError` banner was a dead-end — the only retry affordances lived several cards below in `AvatarProfile` / `GapDecisionTriggerPanel`. Added an optional `onRetry` prop and an inline **"Try again"** button (disabled while running) in the error banner; `V4Analyse` wires it to the existing `runAnalyse()`. Recovery is now where the error is.
- **Avatar editing caret bug (Loop 2).** `AvatarProfile`'s `useEffect(() => setDraft(portrait), [portrait])` re-seeded the draft on every parent re-render. Because each keystroke flows `setDraft → onEdit → parent state → new portrait ref → effect re-seed`, the textarea was replaced mid-keystroke and the caret jumped to the end. Replaced reference re-seeding with a **value-equality guard** (`portraitsEqual` over the four fields): a genuine coach-pushed portrait still re-seeds; the parent's echo of the user's own edit is skipped, so the caret stays put.

### What's green

- `npx tsc --noEmit` — clean.
- `npx vitest run src/components/v4 src/pages/v4` — **110 v4 tests pass** (16 files). No test changes were needed; the moves were structure-preserving (data-testids and props intact).

### Desktop-match status vs the mockup

The earlier-flagged sidebar regression is already resolved on this branch: `V4Sidebar` is `md:flex` and `V4BottomNav` is `md:hidden`, so laptops/half-screen get the rail (not the phone layout). With the read-back rework, the desktop loop now uses the two-column space the mockup specifies and the avatar block reads wide. **Desktop now substantially matches the mockup** for the read-back and Analyse legs. Two mockup-fidelity gaps remain on the MEDIUM punch-list below (the 5-up funnel strip breakpoint and the stepper/content max-width mismatch); neither is a recovery or layout dead-end.

### Punch-list (deferred — MEDIUM/LOW, not addressed this run)

- **[MEDIUM]** `FunnelMap.tsx` stage grid `md:grid-cols-2 xl:grid-cols-5` → the 5-up funnel strip only appears ≥1280px; change to `lg:grid-cols-5` to reach 13" laptops.
- **[MEDIUM]** `SpineStepper` inner list `max-w-5xl` vs `V4Layout` `<main>` `max-w-[1100px]` → align both so stepper circles line up with card edges.
- **[MEDIUM]** `AssetDetailTabs.tsx` `firstView.current` ref guard makes the `tab`/`asset.assetId` deps dead — won't fire mount for a swapped asset; reset on `asset.assetId`.
- **[MEDIUM]** `BusinessMetricsCard.tsx` `useEffect` keyed on the `view` object → re-emits on every new ref; key on `view?.hasData` + metric count.
- **[MEDIUM]** `V4Sidebar` / `V4BottomNav` duplicate `TONE_TEXT` verbatim → hoist to `src/config/v4.ts`.
- **[LOW]** `V4Onboarding.tsx:181` CTA wrapper `flex justify-end` at all widths → `flex-col sm:flex-row sm:justify-end` + `w-full sm:w-auto` for thumb reach at 375px.
- **[LOW]** `FunnelMap.tsx` stats row `grid-cols-3 sm:grid-cols-5` → ragged 3+2 at 375px; consider `grid-cols-5` throughout.
- **[LOW]** `ContextCard.tsx` inline inputs missing `aria-required="true"`.
- **[LOW]** `AssetDetailTabs.tsx` `aria-controls` points at conditionally-rendered panel IDs absent from the DOM.

### Gated-deploy posture (unchanged)

No deploy, no `VITE_FORCE_V4` flip, no prod migration, no edits to `src/integrations/supabase/types.ts`. `isV4Forced` remains fail-safe default OFF. The Section 8 GO-WITH-GATES verdict stands; this run only tightened desktop layout and error recovery within the already-dark surface.
