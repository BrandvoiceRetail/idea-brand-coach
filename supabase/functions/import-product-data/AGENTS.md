# import-product-data — Agent & Testing Context

Feature-local instructions for the **Amazon listing importer**. For the shared
test account and browser-QA setup, see `docs/TEST_ACCOUNT.md` (pointed to from the
top-level `CLAUDE.md`).

## Purpose

Sellers import one or more Amazon listings by ASIN. For each ASIN this function
scrapes `https://www.amazon.com/dp/{asin}` ONCE via Firecrawl v2, parses the
listing fields AND the ~8 embedded reviews, and persists them to `user_products` +
`user_product_reviews` under the caller's own (RLS-scoped) session.

Downstream, the imported data feeds: (a) Trust Gap interpretation evidence,
(b) Signature reveal preloaded reviews, (c) coach chat product context.

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
  formats: ["markdown","html"],
  actions: [{ type: "wait", milliseconds: 3000 }],
  onlyMainContent: false, timeout: 30000 }
```

ONE scrape per ASIN — the /dp/ page yields both the listing fields and the embedded
reviews.

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
  into bodies. Expect ~8 reviews per page.
- **`/product-reviews/` is login-walled (dead).** The dedicated review pages require
  auth — do NOT fetch them. The /dp/ page is the single source of truth.

## How to test it

### Unit (parser) — fast, no network

```
npx vitest run src/lib/__tests__/parseAmazonProduct.test.ts
```

Fixtures are trimmed slices of a REAL Firecrawl response for `B0CJBQ7F5C`. Asserts
title, rating 4.6, price 21.99, review count 143, 1–10 bullets, ≥5 reviews with
non-empty bodies, and that teaser boilerplate never leaks.

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
`user_products` (one) and `user_product_reviews` (~8) for your user.

3. No `Authorization` header → expect `401 { error }`.
4. `{"asins":["nope"]}` or more than 5 ASINs → expect `400 { error }`.
