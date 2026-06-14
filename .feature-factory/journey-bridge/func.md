# Journey Bridge — Implementation (func bucket)

TDD wiring. New deterministic module fully unit-tested (RED → GREEN); component
edits are thin and additive.

## Changes

| File | Type | What |
|------|------|------|
| `src/lib/journeyBridge.ts` | NEW | Pure routing helpers: `parseGapParam`, `buildBridgePath`, `buildCoachPath`, `buildDeepDiveDestination` (authed vs guest-auth-gate), `gapOpenerPrompt`. Imports trustGap types/meta read-only. |
| `src/lib/__tests__/journeyBridge.test.ts` | NEW | 9 tests: param validation, path builders, guest auth-gate round-trip, distinct openers. |
| `src/components/diagnostic/TrustGapScorecard.tsx` | EDIT | CTA `navigate(gap.route)` → `navigate(buildBridgePath(gap.key))`. (trustGap.ts untouched.) |
| `src/components/diagnostic/JourneyBridge.tsx` | NEW | F-059 bridge screen. Reads `?gap=`, names the gap, frames "build the Signature that closes it". Authed → coach; guest → contextual sign-up gate. Bare/guest route. |
| `src/App.tsx` | EDIT | Routes `/v1/diagnostic/bridge` (+ `/diagnostic/bridge` redirect), import. |
| `src/pages/v2/BrandCoachV2.tsx` | EDIT | Reads `?gap=`; renders gap banner + one-click opener (sends `gapOpenerPrompt` via existing `handleSendMessage`) only when chat is empty. No state-hook logic change. |
| `src/hooks/v2/useBrandCoachV2State.ts` | EDIT (minimal) | Guest redirect now preserves destination: `/auth?redirect=<encoded pathname+search>` (D4). Added `useLocation`. The ONLY edit — no rebuild (RF-04 owns extraction). |

## TDD
- RED: `journeyBridge.test.ts` failed (module absent).
- GREEN: implemented `journeyBridge.ts` → 9/9 pass.
- Regression: `trustGap` 13/13; targeted `src/hooks/__tests__` + `src/services/__tests__` 160/160 at `--maxWorkers=2`.
- tsc `--noEmit` clean; eslint clean on all touched files (1 pre-existing warning at useBrandCoachV2State:464, unrelated to the gate edit).

## Test-infra note
`vitest run` over the full 246-file suite fails with `Timeout starting forks
runner` (fork-storm under full concurrency, worsened by a running dev server) —
environmental, reproduces independent of this change. Run with `--maxWorkers=2`
(or per-dir) for a green result. Flagged, not owned here.

## No-regression guarantees
- Coach with no `?gap=` renders exactly as before (banner gated on valid gap +
  empty chat).
- `/v1/diagnostic/results` unchanged except the CTA target.
- Authed coach redirect behaviour preserved (only the guest branch enriched).
