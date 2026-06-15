# Diagnostic Results — Agent & Testing Context

Feature-local instructions for the diagnostic results experience: the **Trust Gap™
scorecard** and the **product-import CTA** that grounds its interpretation in a
seller's real Amazon listing. For the shared test account and browser-QA setup, see
`docs/TEST_ACCOUNT.md` (pointed to from the top-level `CLAUDE.md`).

## What this feature is

After a seller completes the brand diagnostic, `DiagnosticResults` renders the Trust
Gap™ scorecard with a Trevor-voice interpretation per dimension. `ProductImportCta`
lets the seller import one or more Amazon listings by ASIN; the imported listing copy
and ~8 embedded reviews are turned into `TrustGapEvidence` and fed back into the
interpretation so the read cites the seller's real customers instead of generic
advice. When evidence is present, a small **"Grounded in your listing"** badge shows
near the four-pillar grid.

## The pieces

| Layer | Path | Notes |
|-------|------|-------|
| Page / wiring | `src/pages/DiagnosticResults.tsx` | Holds `importedProducts` + `evidence`; loads products on mount (authed), rebuilds evidence on import, passes `evidence` + `evidenceKey` into the scorecard. |
| Import CTA | `src/components/diagnostic/ProductImportCta.tsx` | Inline card (NOT a modal). States: idle → importing → done → error. Multi-ASIN textarea parsed via `parseAsinInput`. |
| Scorecard | `src/components/diagnostic/TrustGapScorecard.tsx` | Accepts optional `evidence`/`evidenceKey`, forwards to the interpretation hook, renders the grounded badge when `evidencePresent`. |
| Interpretation hook | `src/hooks/useTrustGapInterpretation.ts` | Folds `evidenceKey` into the cache signature; sends `evidence` in the body; exposes `evidencePresent`. |
| Service | `useServices().productDataService` (Lane D) | `importProducts`, `getProducts`, `buildTrustGapEvidence` — see `src/services/interfaces/IProductDataService.ts`. |

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

### Cache-key rule (why the badge appears exactly once)

The interpretation is cached in `sessionStorage` by a score signature. `evidenceKey`
(the joined imported-product ids) is folded into that signature, so:

- No evidence → stable signature → cache stays valid (no re-bill on revisit).
- Import happens → new `evidenceKey` → distinct signature → exactly ONE fresh call.

Covered by `src/hooks/__tests__/useTrustGapInterpretation.test.ts`. Run:
`npx vitest run src/hooks/__tests__/useTrustGapInterpretation.test.ts`.

## Guest behavior

Guests (no `useAuth().user`) see the full CTA copy, but the import / re-import button
routes to `/auth?redirect=/diagnostic/results` instead of importing — matching the
auth-prompt pattern already used elsewhere on the results page. Product loading and
evidence building only run for authenticated users.

## How to test the import flow manually (browser, end-to-end)

1. Log in with the test account (`docs/TEST_ACCOUNT.md`) and complete (or revisit) the
   diagnostic so `/diagnostic/results` renders the scorecard.
2. In the **"Import your Amazon listing"** card, paste a known ASIN — e.g.
   `B0CJBQ7F5C` — (one ASIN or Amazon URL per line; multi-ASIN supported, cap 5).
   Confirm the **"N listings detected"** line updates as you type.
3. Click **Import listing**. Expect the importing spinner, then a per-ASIN result row
   (title + reviews saved on success, error text on failure) and a summary line.
4. After a successful import the scorecard re-fetches its interpretation once and the
   **"Grounded in your listing"** badge appears near the four-pillar grid.
5. Reload the page: previously imported listings render with a **Re-import**
   affordance; the badge persists (evidence is rebuilt on mount).
6. Confirm **no console errors**.

**Guest path:** open `/diagnostic/results` while logged out → the import button reads
"Sign in to import" and navigates to `/auth?redirect=/diagnostic/results`.

## Scope guardrails

`/product-reviews/` pages are login-walled (verified dead 2026-06-04) — the import
relies on the `/dp/{asin}` scrape only; do not add a reviews-page fetch path. Keep the
`TrustGapEvidence` type single-sourced from the service interface. The CTA is an inline
card, not a modal — do not convert it.
