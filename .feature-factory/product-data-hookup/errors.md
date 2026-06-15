# errors.md — product-data-hookup

| Failure mode | Behaviour | Where |
|---|---|---|
| Firecrawl down / non-200 / missing html | Per-ASIN `{ok:false, error:'Failed to scrape listing'}`; batch continues; CTA shows per-ASIN error row | `import-product-data/index.ts` `scrapeDpPage` |
| Amazon DOM change breaks parser | `parseAmazonProduct` returns `{success:false}` → per-ASIN error; parser unit test on a real fixture catches regressions at CI time | `parse-amazon.ts`, `src/lib/__tests__/` |
| `/dp/` page starts login-walling (regression of the spike finding) | Same per-ASIN failure path; revisit memory note `project-amazon-scrape-truths` before re-architecting | — |
| Unauthenticated import / scraper call | 401 `{error:'Unauthorized'}` (getUser on both `import-product-data` and `review-scraper`) | edge fns |
| Bad input (no asins, >5, malformed) | 400 with specific message; client pre-validates via `parseAsinInput` so users rarely see these | edge fn + CTA |
| Partial batch (some ASINs fail) | 200 with mixed `results[]`; CTA renders ok/error per row; successful ones are persisted | edge fn + `ProductImportCta` |
| Malformed `evidence` payload | `normaliseEvidence` → null → no-evidence happy path; never 400 | `diagnostic-interpretation` |
| Supabase project paused (free tier) | Imports/reads fail with network errors → toast + error state; see memory `project_supabase_pauses` | service layer |
| Product context fetch fails at session init | Fire-and-forget with console.warn; chat proceeds without product context | `useBrandCoachV2State` |
| Re-import same ASIN | Upsert (UNIQUE user_id,asin) + snapshot-replace reviews — no duplicates | `persistProduct` |
| Firecrawl credit abuse | getUser required on both scraping fns + 5-ASIN cap/call; per-user rate-limit deferred post-alpha | edge fns |
