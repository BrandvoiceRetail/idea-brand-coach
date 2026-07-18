# AGENTS.md — `src/components/v4/fix/` (Loop-3 Fix)

The Fix leg of the Diagnose→Analyse→Fix spine. Screens map the funnel, rank what
to work on, work each asset, and flag Positioning Statement drift. Root + `src/components`
AGENTS.md apply; this adds Loop-3 specifics.

## Components

| File | Story | Role |
|------|-------|------|
| `FunnelMap.tsx` | S-12 | Five-stage funnel map with per-touchpoint status. |
| `WhatNeedsWork.tsx` | S-13 | Impact-ranked to-do list (lift basis: metrics or coverage). |
| `AssetDetailTabs.tsx` | S-14 | One asset's content + IDEA audit verdict. |
| `DriftBanner.tsx` | S-15 | Positioning Statement-drift alert; self-hides at zero drift. |
| `FixBreadcrumb.tsx` | sub-nav | Funnel drill-down trail (map → piece → Fix); the canonical "up" control. |

## Sub-navigation (the one stage with 2nd-level hierarchy)

Spec: [`_bmad-output/planning-artifacts/ux-design-fix-navigation.md`](../../../../_bmad-output/planning-artifacts/ux-design-fix-navigation.md).
Two nav types, never conflated: a **lateral switch** (the 2 top tabs Funnel ↔
Testing & Lift) and a **drill-down** (map → piece detail → fix), expressed as
`FixBreadcrumb`. The breadcrumb is the single multi-level "up" control — it
REPLACED the scattered single-step back buttons (`FunnelPieceDetail` is no longer
given `onBack` from V4Fix; the inline "Back to piece" in the fix view is gone).
Rules baked into `V4Fix.tsx`: switching the Funnel tab or clicking the "Funnel"
crumb resets to `map` AND `clearSelection()` (no stale piece); opening a test
stashes `lastWorkedPiece` so Testing & Lift shows a "← Back to {piece}" return
(no dead-end). Mobile: breadcrumb is a sticky header (`top-24` — below the mobile top bar
(`V4TopBar`, h-12) + spine stepper (`sticky top-12`), each h-12); zero horizontal
overflow at 375px (long piece names truncate, full text in `title`). Presentation
only — no `useFixRun`/`fixService` changes.

## Integration

These four screens are presentational; the page `src/pages/v4/V4Fix.tsx` is the
thin integrator. It owns NO fetching itself — all Loop-3 data-fetching lives in
the `useFixRun` hook (`src/hooks/useFixRun.ts`), which drives the `fixService`
seam (`src/services/v4/fixService.ts`) scoped to the active avatar
(`AvatarContext.selectedAvatarId`) + the `V4ContextStore`. V4Fix passes data +
handlers down, gates on a real avatar (honest "go to Analyse" card when none),
emits the page-level `v4_fix_stage_viewed` / `v4_fix_gate_blocked` /
`v4_fix_advanced_to_remeasure` events, and owns the spine CTA → Re-measure.
Image-prompt generation + `record_assessment` verdicts are not in `fixService`
yet, so those handlers stay unwired (their tabs show honest empty states).

## Contracts

- All Fix shapes live in `src/types/v4Fix.ts` (`DriftItem`, `WorkItem`, etc.). Import from there.
- `DriftBanner` takes `driftItems: DriftItem[]` + `onRecheck` — never a raw count.
- `AssetDetailTabs` is presentational (parent owns `generate_canvas` /
  `generate_brief` / `audit_asset` / `record_assessment` + retry). Its
  design-brief tab REUSES `analyse/MoveBriefClaimGate` for claim-gated copy — do
  not re-implement gating. It emits `v4_asset_detail_tab_viewed` per tab view,
  `v4_asset_check_run` on audit, `v4_asset_verdict_recorded` on verdict.

## Guardrails (hold the production bar)

- NEVER fabricate counts, scores, or lift. A lift number renders only when REAL
  campaign metrics back it; otherwise show honest no-data.
- Honest states: empty / loading / error+retry. Mirror DecisionBoard's pattern.
- Observability: emit a `v4_fix_*` PostHog event at each meaningful step via
  `captureAlphaEvent` (cast the v4 name through `AlphaEventName` — do not edit the
  shared client). `DriftBanner` emits `v4_fix_drift_banner_shown` once per appearance.
  Exported event-name constants live in a sibling `*Events.ts` module (see
  `assetDetailEvents.ts`) so the component file only exports components
  (`react-refresh/only-export-components`).
- Tokens: semantic + `gold-warm`/`gold-light` (NOT a bare `gold` — undefined). No hex.
- Mobile: stack actions vertically under `sm:`, tap targets ≥40px (`min-h-[40px]`).
- Terminology: Tier-A public vocabulary only — no internal stage names.

## Testing

Vitest + RTL, tests in `__tests__/`. Cover the honest states and the no-emit /
self-hide paths (e.g. `DriftBanner` renders null and emits nothing at 0 drift).
Sub-nav: `FixBreadcrumb.test.tsx` (per-view crumbs, leaf = `aria-current`, crumb
click → `onCrumb`, map shows no trail) + `src/pages/v4/__tests__/V4Fix.nav.test.tsx`
(drill map→detail→fix→crumb-up; tab-switch reset; Testing→piece return — heavy
funnel children stubbed, `FixBreadcrumb` kept real).
