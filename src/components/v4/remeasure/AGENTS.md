# AGENTS.md — `src/components/v4/remeasure/` (Loop-4, S-16)

Root + `src/components/AGENTS.md` apply; this adds only what's specific to Re-measure.

## What this is

The "prove the lift" leg of the /v4 spine (Diagnose → Analyse → Fix → **Re-measure** → Defend).
Two presentational cards, driven by `useRemeasureRun` (→ `src/services/v4/remeasureService.ts`):

| Component | Shows | Source of truth |
|-----------|-------|-----------------|
| `TrustGapLiftCard` | Trust Gap before→after: overall + per-IDEA-pillar deltas, biggest mover, weakest-now (next lever), summary | **deterministic** `remeasureService.computeLift` — a 1:1 mirror of the live `compute_trust_gap_lift` MCP tool (`src/mcp/tools/computeTrustGapLift.ts`), run on two real `diagnostic_results` rows |
| `BusinessMetricsCard` | CTR / CVR / AOV / revenue before→after, pivoted on the brand-change date | RLS read of `campaign_metrics` (long/narrow facts) |

Page shell: `src/pages/v4/V4Remeasure.tsx`. Route: `/v4/remeasure` (wired in `src/App.tsx`).

## Hard rules (the production bar)

- **No fabrication.** The Trust Gap delta is pure arithmetic on two REAL diagnostic runs. Fewer than
  two comparable runs → `TrustGapLiftCard` `needsRun` state (re-run the diagnostic), never a made-up
  before/after. `campaign_metrics` is an **unapplied** migration in prod → `BusinessMetricsView.hasData`
  is `false` and every cell reads "—": the honest no-data state is the CURRENT reality. Never invent a
  number to fill a cell. (This card replaces the old fabricated `58 → 71` StayAheadScreen lift.)
- **Tier-A vocabulary only.** No Safety-brain / S1–S4 / CAPTURE / raw buyer-state names. The
  `findTierViolations` assertion in the tests guards every rendered string.
- **Tokens, not hex.** IDEA pillars use `text-idea-{i,d,e,a}` / `bg-idea-{i,d,e,a}`; accents use
  `gold-warm` / `gold-light`; up/down use `text-idea-e` / `text-destructive`.
- **Mobile.** 0 horizontal overflow at 375px (`break-words`, `tabular-nums`, fixed grid cols, tap
  targets ≥40px).
- **Observability.** Each card fires one PostHog view event (`v4_trust_gap_lift_viewed`,
  `v4_business_metrics_viewed`); the page fires `v4_remeasure_stage_viewed` / `_gate_blocked` /
  `_advanced_to_defend`. Cast to `AlphaEventName` at the single call site (canonical registry untouched).

## How to test

- Service: `src/services/v4/__tests__/remeasureService.test.ts` — drives `computeLift` (deterministic),
  the run-reader degradation (no avatar / one run / non-comparable / reader throws), and the
  metrics no-data + before/after split, all with **injected readers** (no network).
- Components: `__tests__/TrustGapLiftCard.test.tsx` — render / needs-run / loading / error / event /
  Tier-C leak.
- `npx tsc --noEmit && npm test` from the worktree root.

## Backend dependency (for the lift to populate)

Re-measure goes live end-to-end once **S-20** (campaign/analytics migration) is applied so
`campaign_metrics` returns rows; until then the Trust Gap card works (from `diagnostic_results`) while
the business-metrics card honestly shows no-data.
