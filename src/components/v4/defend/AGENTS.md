# AGENTS.md — `src/components/v4/defend/` (Loop-5, S-17)

Root + `src/components/AGENTS.md` apply; this adds only what's specific to Defend.

## What this is

The "hold the gains" terminal leg of the /v4 spine (Diagnose → Analyse → Fix → Re-measure → **Defend**).
Four presentational cards, driven by `useDefendRun` (→ `src/services/v4/defendService.ts`):

| Component | Shows | Source of truth |
|-----------|-------|-----------------|
| `DriftWatchCard` | Whether any aligned asset drifted from the current Positioning Statement; all-clear at zero | **real** Loop-3 `getDrift` read (`fixService`) |
| `DefendChecklist` | "Are my gains safe?" status rows (done / attention / pending / coming) | **deterministic** `buildChecklist(driftCount, liftConfirmed)` from real reads |
| `CompetitorTeaserCard` | Honest "coming" teaser for competitive monitoring | nothing — competitor reads are **deferred in Alpha** (no fabricated feed) |
| `WorkbookExportCard` | One-tap full-loop workbook export | the live `export_workbook` engine via `export-workbook` edge invoke |

Page shell: `src/pages/v4/V4Defend.tsx`. Route: `/v4/defend` (wired in `src/App.tsx`).

## Hard rules (the production bar)

- **No fabrication.** Drift is the real `getDrift` count (zero → an honest all-clear, NOT a hidden gap).
  Checklist `state` is computed from real signals; the competitor row is always `coming` — never `done`/
  `attention` against invented competitor data. The workbook download link is shown ONLY when the engine
  returns a real URL; on success-without-link the engine `note` shows instead. A link is never invented.
- **`liftConfirmed`** is `true` only when `getTrustGapLift` returns `ok` (a second real diagnostic run
  exists). Any degradation folds to `false` (an honest "not yet"), never a false green.
- **Tier-A vocabulary only.** No Safety-brain / S1–S4 / CAPTURE / raw buyer-state names. The
  `findTierViolations` assertions in the tests guard the checklist copy.
- **Tokens, not hex.** Defend tints with `idea-d` (the spine tone for this stage); accents use
  `gold-warm`; success uses `idea-e`, errors `destructive`.
- **Mobile.** 0 horizontal overflow at 375px (`break-words`, fixed/stacking layouts, tap targets ≥40px).
- **Observability.** Cards fire one view/result event each (`v4_defend_drift_watch_viewed`,
  `v4_defend_checklist_viewed`, `v4_defend_competitor_teaser_viewed`, `v4_defend_workbook_result`); the
  page fires `v4_defend_stage_viewed` / `_gate_blocked` / `_workbook_requested` / `_loop_restarted`. Cast
  to `AlphaEventName` at the single call site (canonical registry untouched).

## How to test

- Service: `src/services/v4/__tests__/defendService.test.ts` — drives `buildChecklist` (deterministic),
  `getStatus` degradation (no avatar / real drift / needs-input lift / drift read error), and
  `exportWorkbook` (no avatar / real link / null link / engine needs_input / edge error), all with
  **injected readers + invoker** (no network).
- Components: `__tests__/WorkbookExportCard.test.tsx` — export click / link-only-when-real / no-link /
  error / disabled-while-exporting, plus `DefendChecklist` derived-state + Tier-C leak.
- `npx tsc --noEmit && npm test` from the worktree root.

## Backend dependency

The full-loop workbook goes live end-to-end once the `export_workbook` engine is reachable from this app
(an `export-workbook` edge invoke); until then the export degrades to an honest error. Competitor
monitoring is a separate deferred backend (the teaser stays "coming" until it lands).
