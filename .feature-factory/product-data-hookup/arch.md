# arch.md — product-data-hookup

**Feature:** ASIN → Firecrawl → app ingestion of the seller's own Amazon listing(s): persisted copy, Trust Gap evidence, Signature preloaded reviews, coach product context. Kills the paste-your-reviews friction point.
**Date:** 2026-06-04 · **Branch:** `feat/product-data-hookup` (= `feat/brand-coach-mcp-host` + `origin/main` merged)

## Decisions

| # | Decision | Why |
|---|----------|-----|
| D1 | **Scrape `/dp/{asin}` ONLY — one Firecrawl call per ASIN.** Reviews come from the ~8 embedded in the listing page. | Live-fire spike 2026-06-04: every `/product-reviews/` variant (star-filtered, paginated, unfiltered) returns Amazon's sign-in page across 3 real ASINs. `/dp/` yields full listing + 8 parseable reviews for 1 credit. `review-scraper-deep` (star-filtered strategy) deleted. |
| D2 | **Modern review hooks**: body=`data-hook="reviewText"` (NOT the legacy `review-body`), title=`reviewTitle`, reviewer=`a-profile-name`, date=`review-date`, verified=`avp-badge`. | Verified against live scrape; legacy regexes return 0 bodies on /dp/ pages. |
| D3 | **Port the production-proven listing parser** from `infinityvault/core-os/lib/firecrawl-amazon.ts` (7 live ASINs synced in production) into `src/lib/parseAmazonProduct.ts` + a twin `supabase/functions/import-product-data/parse-amazon.ts`. | De-risks parsing; edge fns can only bundle their own folder + `_shared`, hence the twin. |
| D4 | **New tables `user_products` + `user_product_reviews`** (UNIQUE(user_id,asin), RLS `auth.uid()=user_id`, child via ownership EXISTS) — NOT a reuse of `competitor_reviews`. | Own-product vs competitor semantics differ; competitor tables are tied to analysis runs. Snapshot policy: upsert + delete/insert reviews on re-import; no scheduler at alpha. |
| D5 | **Persistence under the caller's RLS session** (anon-key client + user JWT), not service-role. | Same trust model the app already uses; no blast-radius widening. |
| D6 | **Multi-ASIN** (user decision): intake accepts multiple ASINs/URLs; edge fn caps 5/call, client batches; reviews aggregate across products. | 8 reviews/ASIN is the per-listing ceiling; IV has 7 variant ASINs → ~50-review corpus. |
| D7 | **Evidence passed client→fn in the request body**; `diagnostic-interpretation` stays stateless/public (guest diagnostic path preserved). Evidence is appended to the USER message only — the system prompt stays byte-identical for prompt caching. | No auth/DB read forced onto the guest path; cache intact. |
| D8 | **Legacy disposal** (user directive, 0 users): deleted `ReviewAnalyzerModal`, `ChatToolsMenu`, `review-scraper-deep`, and the whole `competitiveInsights` chat plumbing (which was a **silent no-op** — the consultant fn never destructured it). Replaced by `productContext`. `review-scraper` kept + getUser-hardened (the competitive-analysis orchestrator calls it forwarding the user's auth header). |
| D9 | Intake placement (user decision): **DiagnosticResults post-scorecard CTA**; guest CTA routes to `/auth?redirect=`. Import is authed-only (writes user-owned rows). |

## Data flow

```
ProductImportCta (DiagnosticResults) ──ASINs──► import-product-data (edge fn, getUser 401)
  └─ per ASIN: Firecrawl /dp/ scrape → parse-amazon → upsert user_products + snapshot reviews
DiagnosticResults ──getProducts/buildTrustGapEvidence──► TrustGapScorecard(evidence, evidenceKey)
  └─ useTrustGapInterpretation: evidenceKey in sessionStorage cache signature → one fresh call per import
BrandCoachV2 ──getAllReviewsAsString──► SignatureReveal(preloadedReviews)
useBrandCoachV2State ──getProducts→buildCoachContext──► chatService.setProductContext → consultant fn ("THE FOUNDER'S OWN PRODUCT")
```
