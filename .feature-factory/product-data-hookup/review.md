# review.md — product-data-hookup

## Reviewer checklist
- [ ] Contract consistency: `{asins[]}` / `results[]` shape identical in `import-product-data/index.ts`, `SupabaseProductDataService.importProducts`, `ProductImportCta` rendering.
- [ ] `TrustGapEvidence` shape identical in `IProductDataService.ts` (source of truth), `useTrustGapInterpretation` request body, `diagnostic-interpretation` `normaliseEvidence`.
- [ ] `productContext` field name identical in `ChatEdgeFunctionService.buildRequestBody`, `SupabaseChatService.prepareMessageContext`, consultant fn destructure.
- [ ] RLS: all `user_products`/`user_product_reviews` access via user-scoped client; no service-role writes.
- [ ] Prompt-cache safety: `diagnostic-interpretation` system prompt byte-identical with/without evidence (evidence in user message only).
- [ ] Legacy: zero refs to `competitiveInsights`, `ReviewAnalyzerModal`, `ChatToolsMenu`, `review-scraper-deep` in `src/` (verified by grep, 2026-06-04).
- [ ] Parser twin files (`src/lib/parseAmazonProduct.ts` ↔ `import-product-data/parse-amazon.ts`) stay in sync when edited.

## Verification done (2026-06-04)
- `npx tsc --noEmit` clean · vitest **798/798** (60 files) · eslint clean on all feature-changed files (repo-wide pre-existing issues untouched).
- 6 of the 9 `DiagnosticResults.test.tsx` failures encountered were **pre-existing at HEAD** (stale pre-scorecard assertions + unmocked invoke); fixed as part of handoff hygiene.
- Live-fire spike fixture from a real scrape backs the parser tests.

## Known gaps / follow-ups
- Per-user scrape rate-limiting (cooldown table) deferred post-alpha; current guard = auth + 5/call cap.
- `review_date` stored as raw Amazon free-text.
- Images persisted but unused by any surface yet.
- `competitive_analyses`/`competitor_reviews` tables exist in repo migrations but NOT in the live DB (pre-existing drift, unrelated to this feature — the orchestrator pipeline would fail on save today).
- Live deletion of the deployed `review-scraper-deep` function (repo folder removed; live fn deleted at deploy step — confirm in deploy log).
