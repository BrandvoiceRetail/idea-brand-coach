# AGENTS.md — `src/components/v4/analyse/`

Loop-2 (Analyse) screens for the /v4 surface. Root + `src/components/AGENTS.md` apply; this adds only what's specific to the Analyse leg of the Diagnose→Analyse→Fix spine.

## Shared contract

All screens import their domain types from `@/types/v4Analyse.ts` (single source of truth). Never redefine `TrustGapView`, `DecisionTriggerView`, `PositioningMove`, `BriefSlots` locally — extend the contract there.

## No-fabrication invariant (hard)

Every screen must render explicit **loading / empty / error** states and NEVER invent a score, trigger, move, or claim. When the engines have not run or returned nothing, show an honest "not enough evidence yet" state — mirror Loop-1's read-it-back theatre. The new campaign/analytics tables are unapplied in prod, so direct reads return empty; render the empty state, do not synthesise.

## Telemetry pattern

Emit funnel events through the canonical PostHog client (`@/lib/posthogClient` `captureAlphaEvent`). For v4-specific event names, use a local `captureV4`/`emit` wrapper that casts the name to `AlphaEventName` (keeps the shared union untouched). Carry IDs/booleans only — never user-facing copy. Example: `GapDecisionTriggerPanel` fires `v4_decision_trigger_viewed` once per resolved view. When event-name constants must be **exported** (e.g. imported by tests), put them in a sibling `*Events.ts` module (see `moveBriefEvents.ts`) — a component file that also exports a non-component trips `react-refresh/only-export-components`.

## Terminology guardrail

Render only Trevor-voice public vocabulary. No Tier-C internals (no "Safety brain", S1–S4 stage names, CAPTURE, raw buyer-state names). Tests assert `findTierViolations` is empty for every rendered string.

## Components

| File | Story | Purpose |
|------|-------|---------|
| `AvatarProfile.tsx` | S-08 | Editable four-field customer portrait. |
| `GapDecisionTriggerPanel.tsx` | S-09 | Trust Gap score + named Decision Trigger + evidence. |
| `DecisionBoard.tsx` | S-10 | Scored positioning moves to test. |
| `MoveBriefClaimGate.tsx` | S-11 | 7-slot brief + claim fabrication gate. |
| `AnalyseRun.tsx` | S-07 | Build-theatre timeline of the auto-run Analyse chain. |

## Orchestration (these screens are presentational only)

`src/pages/v4/V4Analyse.tsx` is the thin wiring shell; `src/hooks/useAnalyseRun.ts`
owns ALL data-fetching through the `src/services/v4/analyseService.ts` seam + the
confirmed `V4ContextStore`, and exposes the per-section data + handlers the
screens render. Never call the service/edge fns from a screen — take props.

Flow: auto-run on entry (only when the confirmed context has a customer + a
problem; else an honest gate links back to onboarding) → avatar (deterministic
restatement of context) → gap/trigger (needs_input → empty panel while the
diagnostic pillar scores are not wired into v4 context) → confirm avatar triggers
`generateMoves` → choose a move expands the brief + seeds the claim gate. The
spine-advancing CTA ("Continue to Fix") unlocks once a move is chosen. Page-level
funnel events: `v4_analyse_stage_viewed`, `v4_analyse_gate_blocked`,
`v4_analyse_advanced_to_fix`.

## Testing

Vitest + @testing-library/react. Mock the PostHog client (`vi.mock('@/lib/posthogClient')`). Cover the four states (data/loading/empty/error) and the Tier-C leak assertion. Run a single file with `npx vitest run <path> --pool=threads`.
