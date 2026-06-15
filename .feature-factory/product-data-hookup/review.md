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

## Live E2E findings (2026-06-05, QA account, deployed fns)
- ✅ Function smoke: unauth 401; tombstone 410; import of B0CJBQ7F5C+B0CJBN849W → full listings + 8 reviews each persisted under RLS.
- ✅ Browser: scorecard + "Grounded in your listing" badge; interpretations quote real review phrases per pillar (`evidencePresent: true`); import CTA lists products + Re-import; Signature dialog prefills 2,643 chars (16 reviews) → 3 grounded options → pick → gold + surprise prompt; consultant request carries `productContext` and Trevor references the product unprompted; mobile 375px clean; zero console errors on fresh load.
- 🐛→✅ Two async-arrival races found live and fixed (`fb55c98`): evidence-keyed interpretation caching a no-evidence response; signature textarea empty under the "16 imported reviews" banner.
- ⚠️ Pre-existing flaky test (untouched since 2026-02-28): `ImageUpload.compression.test.tsx` "heavy compression >5MB" — timing-sensitive, fails intermittently incl. in isolation; unrelated to this feature.

## Known gaps / follow-ups
- Per-user scrape rate-limiting (cooldown table) deferred post-alpha; current guard = auth + 5/call cap.
- `review_date` stored as raw Amazon free-text.
- Images persisted but unused by any surface yet.
- `competitive_analyses`/`competitor_reviews` tables exist in repo migrations but NOT in the live DB (pre-existing drift, unrelated to this feature — the orchestrator pipeline would fail on save today).
- `review-scraper-deep` live deployment replaced with a 410 tombstone (no external calls, neutralises the public Firecrawl-burn vector); delete outright via `supabase functions delete review-scraper-deep` once the CLI is authenticated.
- Variant ASINs of one parent share Amazon's review corpus → multi-ASIN import of variants stores duplicate reviews (visible in the Signature prefill). Follow-up: dedupe by normalised body at insert or in `getAllReviews*`.
- Only 1 feature bullet extracted per listing (the `feature-bullets` regex stops at the first nested `</div>`). Evidence still works via title+bullet; widen the capture for full bullet sets.
