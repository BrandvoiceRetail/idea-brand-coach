# Diagnostic Results — Agent & Testing Context

Feature-local instructions for the **Trust Gap™ scorecard → journey bridge → /v2/coach Signature**
hand-off (F-059). Root `AGENTS.md` applies; this adds only what's specific here. For the shared QA
account and browser-QA setup, see `docs/TEST_ACCOUNT.md`.

## What this feature is

After the 6-question diagnostic, `DiagnosticResults` renders a Trust Gap™ scorecard: an overall
score (/100) plus the four IDEA pillars (insight, distinctive, empathetic, authentic — each /25),
each paired with a Trevor-voice interpretation. It names the user's **primary gap** and routes
"Let's go deeper" to the **journey bridge**, which hands off to the Layer 1 coach to build the
Signature that closes that gap. Scorecard geometry is deterministic; only the interpretation is LLM.

## The pieces

| Layer | Path | Notes |
|-------|------|-------|
| Scorecard UI | `src/components/diagnostic/TrustGapScorecard.tsx` | Renders overall + 4 pillar cards; degrades gracefully if interpretation fails. Fires `scorecard_viewed` (once/mount) + `scorecard_interpretation_shown`. |
| Bridge UI | `src/components/diagnostic/JourneyBridge.tsx` | Sign-up gate (arch.md D3): guests invited to create a free account vs. bounced to `/auth`. Reads primary gap from `?gap=`. Route `/v1/diagnostic/bridge`. |
| Page / mount | `src/pages/DiagnosticResults.tsx` | Loads scores from `localStorage` (guest) or DB (authed, via `useDiagnostic`); route `/v1/diagnostic/results`. |
| Interpretation hook | `src/hooks/useTrustGapInterpretation.ts` | Calls `diagnostic-interpretation` edge fn with scores in the body (no DB read → guest-safe). |
| Deterministic model | `src/lib/trustGap.ts` | `buildTrustGap`, bands, dimension meta, `trustGapSignature`. |
| Routing helpers | `src/lib/journeyBridge.ts` | `buildBridgePath`, `parseGapParam`, `buildDeepDiveDestination` (authed → coach; guest → `/auth?redirect=`). Framework-free, unit-tested. |
| Analytics | `src/lib/posthogClient.ts` | `captureAlphaEvent`; no-ops without `VITE_POSTHOG_KEY`. Scores/IDs only — never free text. |

## Key seams / rules

- **Interpretation cache (sessionStorage).** The hook caches by score signature under key
  `trustGapInterpretation:<signature>` so returning to results with identical scores does NOT re-bill
  the model. Cache is bypassed on `retry`. sessionStorage failures (private mode / quota) are non-fatal.
- **No templated fallback (Trevor Decision 5).** On failure the hook surfaces an honest error + retry —
  it never invents a fallback interpretation. UI shows "Personalised read unavailable right now."
- **Gap carried via `?gap=`** (arch.md D1): guest-safe, survives reload and the `/auth` round-trip.
  Always validate untrusted values with `parseGapParam`.
- **Don't touch `trustGap.ts` frozen `route` metadata** when changing routing (arch.md D6) — routing
  lives in `journeyBridge.ts`.

## How to test manually

1. Sign in with the QA account (`docs/TEST_ACCOUNT.md`); restore Supabase if it auto-paused.
2. Complete `/diagnostic`, or seed `localStorage.diagnosticData`, then open `/v1/diagnostic/results`.
3. Confirm overall + four pillar scores render and each pillar shows a Trevor-voice interpretation
   (skeletons while loading); reload — interpretation should return from cache, no second edge call.
4. Force a failure (block `diagnostic-interpretation`): expect the error line + "Try again", no fake copy.
5. Click "Let's go deeper" → lands on `/v1/diagnostic/bridge?gap=<dim>`; "Build my Signature" routes
   authed users to `/v2/coach?gap=<dim>`, guests to `/auth?redirect=...`.

## Scope guardrails

- This branch contains ONLY `TrustGapScorecard.tsx` + `JourneyBridge.tsx`. There is no product-import CTA.
- Keep analytics props to scores/bands/IDs — never put interpretation or answer text in event properties.
- Interpretation copy is owned by the edge fn (`supabase/functions/`), not these components.
