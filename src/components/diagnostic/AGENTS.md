# Diagnostic Results — Agent & Testing Context

Feature-local instructions for the diagnostic results experience. Root `AGENTS.md` applies; this adds
only what's specific here. Two capabilities live side by side on this page:

1. **Trust Gap™ scorecard → journey bridge → /v2/coach Positioning Statement** hand-off (F-059).
2. The **product-import CTA** that grounds the scorecard's interpretation in a seller's real Amazon listing.
3. The **forensic analysis panel** — the SIGNED-IN, review-grounded deep read (post-signup value).

For the shared QA account and browser-QA setup, see `docs/TEST_ACCOUNT.md` (pointed to from the
top-level `CLAUDE.md`).

## What this feature is

After the 6-question diagnostic, `DiagnosticResults` renders a Trust Gap™ scorecard: an overall
score (/100) plus the four IDEA pillars (insight, distinctive, empathetic, authentic — each /25),
each paired with a Trevor-voice interpretation. It names the user's **primary gap** and routes
"Let's go deeper" to the **journey bridge**, which hands off to the Layer 1 coach to build the
Positioning Statement that closes that gap. Scorecard geometry is deterministic; only the interpretation is LLM.

`ProductImportCta` lets the seller import one or more Amazon listings by ASIN; the imported listing
copy and ~8 embedded reviews are turned into `TrustGapEvidence` and fed back into the interpretation
so the read cites the seller's real customers instead of generic advice. When evidence is present, a
small **"Grounded in your listing"** badge shows near the four-pillar grid.

## Forensic analysis panel (signed-in, post-signup value)

`ForensicAnalysisPanel` is the authed counterpart to the anon `DiagnosticLeadCapture` — the
"long-running free analysis" a user gets after signup. It is an inline card (NOT a modal), gated on
`user` in `DiagnosticResults`, sitting after the scorecard as the deeper-analysis step. Given one ASIN
(`parseAsinInput`, F1 = first ASIN), it calls the `run-forensic-analysis` edge function with
`{ asin, self_report_scores }` (the page's self-report `fallbackScores`). That single server call is
synchronous (~30-60s) and returns `forensic_scores` (0-25 pillars / 0-100 overall, DERIVED from the
review corpus, **not** the self-report), `interpretation` (per-dimension evidence reads from
`diagnostic-interpretation-evidence`), `decision_trigger`, `reviews_analyzed`, and `thin_corpus`.

| Concern | How |
|---------|-----|
| Progress | A stepped 6-stage checklist (mirrors the server tools) advances on an 8s timer during the single await — a perceived-progress animation, honestly labelled "Analysing… this takes about a minute." NOT a real per-step stream. |
| Forensic scores | Rendered by a **compact pillar grid in the panel**, NOT `TrustGapScorecard` — so the forensic read (already in the response) is authoritative and the interpretation model is not re-billed. Pillars convert /25 → 0-100 (`×4`) before `buildTrustGap` so its `rescaleDimension` shows them back as /25. |
| Decision trigger | Reuses `DecisionTriggerPanel` via its additive `result` prop: when `result` is passed, the panel renders it directly and skips its own `identify-decision-trigger` call. `mapDecisionTrigger` maps the response's **snake_case** `decision_trigger` (`dominant_type`, `brand_anchor`, `evidence_phrases`, `placement_instruction`, `why_this_trigger`) → the camelCase `DecisionTriggerResult` (tolerates camelCase too); unusable shapes are omitted, never rendered as junk. No confidence leaks (the type carries none). |
| Grounded badge | "Grounded in your N real reviews" using `reviews_analyzed`. |
| Thin corpus | `thin_corpus` (reviews < 5, normal at the ~8-review /dp cap) shows an amber caveat: "Based on N reviews — a thin sample; treat as directional." |
| Errors | 422 (`ok:false`) and any failure → `sonner` toast + an inline retry (back to the input form). |
| Analytics | `forensic_analysis_started` ({has_asin}) on run start; `forensic_analysis_completed` ({ok, reviews_analyzed, thin_corpus, primary_gap, overall_score, has_decision_trigger}) on finish. Scores/booleans/IDs only — never the ASIN value, review text, or PII. |

Tests: `__tests__/ForensicAnalysisPanel.test.tsx` (run → grounded report + exact payload, thin-corpus
caveat, 422 toast + error state, disabled-until-valid-ASIN). The `run-forensic-analysis` edge function
itself is built separately (Task A) — this panel is the surface to its shared contract.

## Diagnostic BOTH — brand baseline vs per-avatar overlay (locked #5)

A diagnostic submission is now **avatar-scoped**: `diagnostic_submissions.avatar_id`
**NULL = brand baseline**, a set `avatar_id` = a **per-avatar overlay**. `brand_id` is
resolved **server-side** in `SupabaseDiagnosticService.saveDiagnostic` (one brand per user)
and never accepted from the caller. `getLatestDiagnostic(avatarId?)` scopes the read:
`undefined` = any scope (back-compat), `null` = baseline only, `'<uuid>'` = that overlay only.

**How an overlay row gets created (the authored write path).** `syncFromLocalStorage(avatarId?)`
is the single write entry point for a newly-taken diagnostic. The first-signup sync (`Auth.tsx`)
passes no avatar, so it establishes the **baseline**. On the results page, once a baseline
already exists AND an avatar is current, the sync passes `selectedAvatarId`, so a re-take lands
as that avatar's **overlay** — this is what makes compare-mode (`compareEnabled = overlay && baseline`)
render. Both `useDiagnostic` mutations invalidate the avatar-scoped `'diagnostic'` keys (not just
`['diagnostic']`) so a fresh overlay shows up in compare-mode immediately.

`useAvatarDiagnosticCompare(avatarId)` reads baseline + the current avatar's overlay in
parallel under the avatar-scoped query namespace (`avatarDiagnosticKey` in `src/lib/queryKeys.ts`
— the bleed firewall, so an avatar switch invalidates them). `DiagnosticResults` prefers the
**overlay** when present and passes the **baseline** as `baselineScores` to the scorecard;
`TrustGapScorecard` then renders **compare-mode** — a "Comparing <avatar> against your brand
baseline" banner, an overall `±N vs baseline` line, and a per-pillar `DeltaBadge`
(`scorecard_compared` analytics, scores/delta only). With no overlay it falls back to the
baseline / page scores (single-scope, legacy render). The `run_trust_gap` MCP tool is **pure
compute** — it accepts an optional `avatar_id` echoed in its text output for attribution but
**never persists**; its `structuredContent` stays byte-identical to the engine (Calculation Parity).

## The pieces

| Layer | Path | Notes |
|-------|------|-------|
| Scorecard UI | `src/components/diagnostic/TrustGapScorecard.tsx` | Renders overall + 4 pillar cards; degrades gracefully if interpretation fails. Accepts optional `evidence`/`evidenceKey` and renders the grounded badge when `evidencePresent`. Fires `scorecard_viewed` (once/mount) + `scorecard_interpretation_shown`. |
| Bridge UI | `src/components/diagnostic/JourneyBridge.tsx` | Sign-up gate (arch.md D3): guests invited to create a free account vs. bounced to `/auth`. Reads primary gap from `?gap=`. Route `/v1/diagnostic/bridge`. |
| Import CTA | `src/components/diagnostic/ProductImportCta.tsx` | Inline card (NOT a modal). States: idle → importing → done → error. Multi-ASIN textarea parsed via `parseAsinInput`. |
| Page / wiring | `src/pages/DiagnosticResults.tsx` | Loads scores from `localStorage` (guest) or DB (authed, via `useDiagnostic`); holds `importedProducts` + `evidence`; loads products on mount (authed), rebuilds evidence on import, passes `evidence` + `evidenceKey` into the scorecard. Route `/v1/diagnostic/results`. |
| Interpretation hook | `src/hooks/useTrustGapInterpretation.ts` | Calls `diagnostic-interpretation` edge fn with scores in the body (no DB read → guest-safe). Folds `evidenceKey` into the cache positioning statement; sends `evidence` in the body; exposes `evidencePresent`. |
| Deterministic model | `src/lib/trustGap.ts` | `buildTrustGap`, bands, dimension meta, `trustGapPositioningStatement`. |
| Routing helpers | `src/lib/journeyBridge.ts` | `buildBridgePath`, `parseGapParam`, `buildDeepDiveDestination` (authed → coach; guest → `/auth?redirect=`). Framework-free, unit-tested. |
| Product-data service | `useServices().productDataService` (Lane D) | `importProducts`, `getProducts`, `buildTrustGapEvidence` — see `src/services/interfaces/IProductDataService.ts`. |
| Analytics | `src/lib/posthogClient.ts` | `captureAlphaEvent`; no-ops without `VITE_POSTHOG_KEY`. Scores/IDs only — never free text. |

## Evidence contract (the seam to keep stable)

`TrustGapEvidence` is **owned by `src/services/interfaces/IProductDataService.ts`** —
import the type from there, never redefine it. Shape:

```
{ listings: [{ asin, title, bullets: string[], description? }], topReviews: string[] }
```

`topReviews` entries are `"★{rating} — {body}"`, max 12, body ≤300 chars (enforced by
the service's `buildTrustGapEvidence`). The hook sends `evidence` in the
`diagnostic-interpretation` request body; the edge function returns
`evidencePresent: boolean`, which drives the grounded badge.

## Key seams / rules

- **Interpretation cache (sessionStorage).** The hook caches by score positioning statement under key
  `trustGapInterpretation:<positioning statement>` so returning to results with identical scores does NOT re-bill
  the model. `evidenceKey` (the joined imported-product ids) is folded into that positioning statement, so:
  - No evidence → stable positioning statement → cache stays valid (no re-bill on revisit).
  - Import happens → new `evidenceKey` → distinct positioning statement → exactly ONE fresh call.
  Cache is bypassed on `retry`. sessionStorage failures (private mode / quota) are non-fatal.
  Covered by `src/hooks/__tests__/useTrustGapInterpretation.test.ts`.
- **No templated fallback (Trevor Decision 5).** On failure the hook surfaces an honest error + retry —
  it never invents a fallback interpretation. UI shows "Personalised read unavailable right now."
- **Gap carried via `?gap=`** (arch.md D1): guest-safe, survives reload and the `/auth` round-trip.
  Always validate untrusted values with `parseGapParam`.
- **Don't touch `trustGap.ts` frozen `route` metadata** when changing routing (arch.md D6) — routing
  lives in `journeyBridge.ts`.

## Guest behavior

Guests (no `useAuth().user`) see the full CTA copy, but the import / re-import button
routes to `/auth?redirect=/diagnostic/results` instead of importing — matching the
auth-prompt pattern already used elsewhere on the results page. Product loading and
evidence building only run for authenticated users.

## How to test manually (browser, end-to-end)

1. Sign in with the QA account (`docs/TEST_ACCOUNT.md`); restore Supabase if it auto-paused.
2. Complete `/diagnostic`, or seed `localStorage.diagnosticData`, then open `/v1/diagnostic/results`.
3. Confirm overall + four pillar scores render and each pillar shows a Trevor-voice interpretation
   (skeletons while loading); reload — interpretation should return from cache, no second edge call.
4. Force a failure (block `diagnostic-interpretation`): expect the error line + "Try again", no fake copy.
5. Click "Let's go deeper" → lands on `/v1/diagnostic/bridge?gap=<dim>`; "Build my Positioning Statement" routes
   authed users to `/v2/coach?gap=<dim>`, guests to `/auth?redirect=...`.
6. **Import flow:** in the **"Import your Amazon listing"** card, paste a known ASIN — e.g.
   `B0CJBQ7F5C` (one ASIN or Amazon URL per line; multi-ASIN supported, cap 5). Confirm the
   **"N listings detected"** line updates as you type. Click **Import listing** → importing spinner,
   then a per-ASIN result row + summary line. The scorecard re-fetches its interpretation once and the
   **"Grounded in your listing"** badge appears. Reload: imported listings render with a **Re-import**
   affordance; the badge persists (evidence rebuilt on mount).
7. Confirm **no console errors**.

**Guest path:** open `/diagnostic/results` while logged out → the import button reads
"Sign in to import" and navigates to `/auth?redirect=/diagnostic/results`.

## Scope guardrails

- Keep analytics props to scores/bands/IDs — never put interpretation or answer text in event properties.
- Interpretation copy is owned by the edge fn (`supabase/functions/`), not these components.
- `/product-reviews/` pages are login-walled (verified dead 2026-06-04) — the import relies on the
  `/dp/{asin}` scrape only; do not add a reviews-page fetch path.
- Keep the `TrustGapEvidence` type single-sourced from the service interface. The CTA is an inline
  card, not a modal — do not convert it.
