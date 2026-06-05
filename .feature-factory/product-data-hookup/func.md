# func.md — product-data-hookup

What was built, by lane. All tsc/lint(changed files)/vitest green: 798/798 tests, 60 files.

## Lane A — Schema
- `supabase/migrations/20260604120000_user_products.sql` — `user_products` (UNIQUE(user_id,asin), RLS ×4, idx (user_id, scraped_at DESC), updated_at trigger) + `user_product_reviews` (FK CASCADE, ownership-EXISTS RLS, idx product_id). **Applied to the live project**; types regenerated (`src/integrations/supabase/types.ts` — also picked up `feedback_events`).

## Lane B — Import edge fn
- `supabase/functions/import-product-data/index.ts` (282) — getUser auth (401), `{asins[]}` ≤5, per-ASIN sequential Firecrawl /dp/ scrape (2s gaps, per-ASIN try/catch), parse, upsert + snapshot-replace reviews, contract response.
- `supabase/functions/import-product-data/parse-amazon.ts` (440) + twin `src/lib/parseAmazonProduct.ts` (439) — ported proven listing parser + modern-hook review extraction.
- `src/lib/__tests__/parseAmazonProduct.test.ts` + `fixtures/` (trimmed real scrape of B0CJBQ7F5C).
- `supabase/config.toml`: `[functions.import-product-data] verify_jwt = false` (self-auths).
- `supabase/functions/import-product-data/AGENTS.md`.

## Lane C — Edge fn mods
- `diagnostic-interpretation/index.ts` — optional `evidence` (defensively normalised, never 400s), `<evidence>` XML in the user message only, per-pillar "where it shows up" citations, `evidencePresent` in response.
- `idea-framework-consultant-claude/index.ts` — destructures `productContext`, injects "THE FOUNDER'S OWN PRODUCT" into stable context parts. (Fixes the prior silent no-op where review context never reached the model.)
- `review-scraper/index.ts` — getUser, 401 unauth'd; orchestrator compatibility preserved (forwards caller auth header).

## Lane D — Client service
- `src/services/interfaces/IProductDataService.ts` (exports `TrustGapEvidence` for UI imports), `src/services/SupabaseProductDataService.ts` (importProducts batching ≤5/call, getProducts, getAllReviews(AsString), buildCoachContext, buildTrustGapEvidence), registered in `ServiceProvider.tsx`; tests in `src/services/__tests__/SupabaseProductDataService.test.ts`; `src/services/AGENTS.md` extended.

## Lane E — Diagnostic intake UI
- `src/components/diagnostic/ProductImportCta.tsx` (248) — inline card, multi-ASIN textarea (`parseAsinInput`), idle→importing→done→error, per-ASIN result rows, re-import affordance, guest → `/auth?redirect=`.
- `DiagnosticResults.tsx` — mounts CTA after scorecard, loads products, builds evidence, passes `evidence`/`evidenceKey` (joined product ids) down.
- `useTrustGapInterpretation.ts` — evidence + evidenceKey params; evidenceKey folded into the sessionStorage cache signature (one fresh call per import, no re-billing of identical no-evidence calls). `TrustGapScorecard.tsx` forwards + shows "Grounded in your listing" badge via `evidencePresent`.
- `src/hooks/__tests__/useTrustGapInterpretation.test.ts`; `src/components/diagnostic/AGENTS.md`.

## Lane F+G — Chat-layer refactor + legacy disposal
- `useSignatureReveal({initialReviews})`; `SignatureReveal` `preloadedReviews`/`preloadedReviewCount` + banner; `BrandCoachV2` fetches + passes.
- `SupabaseChatService.setProductContext` (+ `IChatService`), `ChatEdgeFunctionService.buildRequestBody` carries `productContext`; `useBrandCoachV2State` auto-loads product context at session init (fire-and-forget).
- **Deleted:** `ReviewAnalyzerModal.tsx`, `ChatToolsMenu.tsx`, tools-button in `ChatInputBar`, review-context state in `useChatOrchestration`/`useBrandCoachV2State`, `competitiveInsights` plumbing end-to-end (incl. `src/mcp/tools/generateConcepts.ts`), `supabase/functions/review-scraper-deep/`. Zero `competitiveInsights|ReviewAnalyzerModal|ChatToolsMenu|review-scraper-deep` refs left in `src/`.

## Post-workflow integration fixes (inline)
- `DiagnosticResults.test.tsx`: mocked `useServices` + `useTrustGapInterpretation` at page level; replaced stale pre-scorecard assertions ("73%", "Excellent"/"Good"/"Fair") with scorecard reality (bands: Building trust/Developing/Trust gap). 6 of the failures were pre-existing at HEAD.
