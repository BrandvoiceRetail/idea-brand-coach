# import-product-data — Agent & Testing Context

Feature-local instructions for the **Amazon listing importer**. For the shared
test account and browser-QA setup, see `docs/TEST_ACCOUNT.md` (pointed to from the
top-level `CLAUDE.md`).

## Purpose

Sellers import one or more Amazon listings by ASIN. For each ASIN this function
scrapes `https://www.amazon.com/dp/{asin}` ONCE via Firecrawl v2, parses the
listing fields AND the embedded reviews, and persists them to `user_products` +
`user_product_reviews` under the caller's own (RLS-scoped) session. Since
2026-07-12 the scrape click-expands the ratings widget before capture (see
"Firecrawl requirement" below), so the review count is no longer capped at the
historical ~8-review preview.

Downstream, the imported data feeds: (a) Trust Gap interpretation evidence,
(b) Positioning Statement reveal preloaded reviews, (c) coach chat product context.

## Contract

```
req:  { asins: string[] }              // cap 5; each must match /^[A-Z0-9]{10}$/i
200:  { status: "ok", results: [{ asin, ok, productId?, title?, rating?,
                                   reviewCount?, reviewsSaved?, error? }] }
401:  { error }                        // unauthenticated (no/invalid Bearer token)
400:  { error }                        // bad input (not an array, empty, >5, bad ASIN)
```

- Each ASIN is processed **sequentially** with a 2000ms delay between ASINs.
- Per-ASIN failures are caught and reported in that ASIN's `result.error`; one bad
  ASIN never fails the whole batch (the response is still 200).
- Persistence: `user_products` is **upserted** on `(user_id, asin)`;
  `user_product_reviews` is **snapshot-replaced** (delete all rows for the product,
  then insert the freshly-parsed set). `review_count` is set from the parsed count.

## The pieces

| Layer | Path | Notes |
|-------|------|-------|
| Edge function | `index.ts` | Self-authenticates via the caller's `Authorization` header (anon-key client + `getUser`). `verify_jwt = false` in `config.toml` to match repo convention; the user-scoped client does all writes so RLS applies. |
| Parser (twin) | `parse-amazon.ts` | Verbatim duplicate of `src/lib/parseAmazonProduct.ts`. Deno bundles only this folder + `_shared`, so the frontend module cannot be imported — **keep the two in sync.** The frontend twin carries the vitest coverage. |

## Firecrawl requirement

Needs the `FIRECRAWL_API_KEY` secret (`Deno.env.get("FIRECRAWL_API_KEY")`). Without
it the function returns 500. The Firecrawl v2 call is:

```
POST https://api.firecrawl.dev/v2/scrape
{ url: "https://www.amazon.com/dp/<asin>",
  formats: ["markdown","html", { type: "json", ... }],  // structured review extraction
  actions: [
    { type: "wait", milliseconds: 3000 },
    { type: "click", selector: "#acrCustomerReviewLink", all: true },  // expand reviews
    { type: "wait", milliseconds: 2000 },
  ],
  onlyMainContent: false, timeout: 30000 }
```

Shared with `review-scraper` via `supabase/functions/_shared/amazonReviews.ts`
(`scrapeAmazonPage`) — do not edit the request shape here without checking that
module. The click's `all: true` is load-bearing: it makes a missing selector
(e.g. a zero-review listing) a no-op instead of a fatal `SCRAPE_ACTION_ERROR`
that would lose the entire scrape, not just the reviews.

ONE scrape per ASIN — the /dp/ page yields both the listing fields and the
(now click-expanded) embedded reviews.

## Gotchas (verified 2026-06-04)

- **Modern review hooks.** Embedded reviews on /dp/ use the MODERN hooks, NOT the
  legacy `review-body`:
  - block: `<div|li data-hook="review">`
  - body: `data-hook="reviewText"` (bodies < 10 chars are skipped)
  - title: `data-hook="reviewTitle"`
  - rating: `"{n} out of 5 stars"` inside the block
  - reviewer: `<span class="a-profile-name">`
  - date: `data-hook="review-date"`
  - verified: presence of `data-hook="avp-badge"`
  Amazon wraps each body in collapsed/expanded "Brief/Full content visible, double
  tap…" teaser helper text; the parser strips those sentinels so they don't leak
  into bodies.
- **`/product-reviews/` is login-walled (dead).** The dedicated review pages require
  auth — do NOT fetch them. The /dp/ page is the single source of truth. Confirmed
  live 2026-07-12: a direct fetch of `/product-reviews/{asin}` returns Amazon's
  actual sign-in page, even via Firecrawl.
- **Review count is no longer capped at ~8 (2026-07-12).** A plain /dp/ page load
  only embeds a small preview. `scrapeAmazonPage` (`_shared/amazonReviews.ts`)
  clicks the ratings link (`#acrCustomerReviewLink`, `all: true`) before capture,
  which expands more reviews into the DOM without navigating to the login-walled
  `/product-reviews/` page — confirmed live: no sign-in content, review count
  materially higher than a plain load. `all: true` is required so a missing
  selector (zero-review listings, layout variants) degrades to a no-op instead of
  failing the whole scrape. Actual count still varies by listing and is bounded by
  whatever Amazon's own review widget renders on /dp/, not the full
  `/product-reviews/` catalog.

## How to test it

### Unit (parser) — fast, no network

```
npx vitest run src/lib/__tests__/parseAmazonProduct.test.ts
```

Fixtures are trimmed slices of a REAL Firecrawl response for `B0CJBQ7F5C`, captured
BEFORE the 2026-07-12 click-expansion change — they still exercise the parser
correctly (asserts title, rating 4.6, price 21.99, review count 143, 1–10 bullets,
≥5 reviews with non-empty bodies, teaser boilerplate never leaks) but don't reflect
a click-expanded page. Regenerate against a live capture to test that path.

### End-to-end (deployed) — curl with a user JWT

1. Grab a Bearer token for the test account (`docs/TEST_ACCOUNT.md`).
2. Call the function with a known-good ASIN (`B0CJBQ7F5C`):

```bash
curl -i -X POST \
  "$SUPABASE_URL/functions/v1/import-product-data" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"asins":["B0CJBQ7F5C"]}'
```

Expect `200 { status: "ok", results: [{ asin: "B0CJBQ7F5C", ok: true, productId,
title, rating: 4.6, reviewCount, reviewsSaved }] }`. Then confirm the rows exist in
`user_products` (one) and `user_product_reviews` for your user — `reviewsSaved`
should be well above the historical ~8-review ceiling now that the scrape
click-expands the ratings widget before capture (2026-07-12).

3. No `Authorization` header → expect `401 { error }`.
4. `{"asins":["nope"]}` or more than 5 ASINs → expect `400 { error }`.
