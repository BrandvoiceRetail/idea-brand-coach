# Competitor Data Sourcing — Design Doc (long-term)

_2026-06-18. Decision-grade comparison of Amazon/competitor data-acquisition APIs for embedding in the IDEA Brand Coach (multi-tenant SaaS, hundreds→thousands of users/month), plus the downstream processing + caching architecture. Findings adversarially verified against official pricing/docs/ToS (sources cited in the workflow transcript). Pairs with the short-term [`COMPETITOR_DATA_1PAGER.md`](./COMPETITOR_DATA_1PAGER.md)._

## 0. The question
The competitor agents (one per funnel touchpoint, IDEA Trust-Gap scored) need, per analysis: **competitor listings**, **reviews**, **competitor discovery**, and — for Brand Defense — **price/rank history** and **Buy-Box/seller** signals. Which data source(s) do we acquire from, can we **legally embed them in a paid multi-tenant app**, and how do we process + cache so cost stays flat at scale?

## 1. Comparison matrix (verified)

| Source | Type | Real API? | Listings | Reviews (text) | Discovery | Price/Rank history | Buy-Box/Sellers | Pricing (real) | Min | Free trial | **Embeddable in a SaaS?** | Fit /5 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **DataForSEO** (Merchant Amazon + Labs) | Structured Amazon API | Yes, self-serve; Merchant = **async queue (POST→GET), no inline Live** | ✅ products SERP + ASIN detail | ⛔ **endpoint disabled today** ("temporarily unavailable") | ✅ keyword + Labs ranked/bestsellers | ✗ native (DIY snapshots) | ◑ sellers/offers list, Buy-Box inferred | PAYG $0.001 products/sellers, $0.0015 ASIN; Labs $0.01+$0.0001/item | **$50** one-time | $1 + synthetic sandbox | ✅ **favorable** (Amazon data unrestricted; SERP-only clause; resale contemplated) | **3.5** |
| **Keepa** | Structured Amazon API | Yes, mature REST + SDKs, token-bucket | ✅ full metadata + history | ◑ rating/count **history only, no text** | ✅ Product Finder/Best Sellers | ✅ **strongest — deep time-series** | ✅ Buy-Box + seller history | Subscription by throughput: €49 (20 tok/min) → €4,499 (4,000); 8 tiers | monthly, cancel anytime | ⛔ no free API trial | ✅ **green-light, in writing** (sharing with own users ≠ resale, §2(2)/§6.1(1)) | **4** |
| **Rainforest** (Traject Data) | Structured Amazon API | Yes, single endpoint | ✅ full | ✅ dedicated endpoint (thin sample) | ✅ | ◑ DIY via Collections (sequential) | ✅ dedicated Offers/Seller, explicit Buy-Box | Sub+credits: $23/500 → $375/250k (~$0.003) → $9k/20M | none | 100 req | ⛔ **dealbreaker on self-serve** ("personal use"; "no apps interacting w/o written consent") → needs enterprise agreement | **2.5** |
| **Firecrawl** | General web scraper | Yes (already wired into our MCP) | ◑ DIY schema | ⛔ ~8 on-listing only | ✅ generic web | ✗ | ✗ | Credits: $16/5k → $599/1M; Amazon ≈ **9 cr/page**, no rollover, no PAYG | monthly | 1k credits | ⚠️ ambiguous — no output-redistribution grant; get Enterprise/DPA | **2.5** |
| **Jungle Scout API** | Structured Amazon API | Yes | ◑ catalog/estimates | ⛔ count/rating only | ✅ estimates | ◑ | ◑ count + Buy-Box owner | add-on $29/1k…$199/10k + paid JS plan | sub | 100 free | ⛔ **DEALBREAKER** (MSA bars redistribution, key-sharing, caching to KB) | **1** |
| **Helium 10** | Seller SaaS (UI-first) | Enterprise-only, sales-gated, undocumented | in-product | in-product | in-product | in-product | weak | "from $1,499/mo annual" floor | annual contract | none | ⛔ **DEALBREAKER** (internal-use only; no resale/derivative/caching) | **1** |
| **Amazon SP-API / PA-API** | Official Amazon | Yes (first-party, OAuth/affiliate) | ✅ Catalog | ⛔ none usable | ◑ | ✗ | ✅ **SP-API strong** (Featured Offer = Buy-Box) | **free to call**; SP-API needs Pro seller $39.99/mo + vetting | gates | sandbox | ⛔ **per-tenant only** — AUP forbids cross-tenant aggregation; PA-API bars 3rd-party-benefit + LLM | **1.5** |
| **Scraper infra** (Bright Data / Oxylabs / Apify) | Scraper infra | Yes | ✅ strongest | ◑ ~8–13 (industry-wide) | ✅ | ✗ native | ✅ Oxylabs `amazon_pricing` etc. | usage: **Oxylabs $0.40–0.50/1k (no-JS)**, BD $1.50/1k, Apify $29+ | none | trials | ⚠️ mixed — **Apify cleanest** (you own outputs); BD most restrictive; all push Amazon-ToS onto you | **2.5** |

> **The dealbreaker column is the real story.** Of eight sources, **only Keepa and DataForSEO** are cleanly embeddable in a paid multi-tenant app without first negotiating an enterprise agreement. That single fact narrows the field more than price or features do.

## 2. Recommendation — a deliberate multi-source core

No single vendor cleanly covers **listings + review text + price/rank history + Buy-Box** with embeddable terms. So:

**Best source per data type:**

| Data type | Use | Why |
|---|---|---|
| **Amazon listings + discovery** | **DataForSEO** (built) | Self-serve, cheapest PAYG, $50 min, **embeddable**, already wired + deployed. |
| **Price / rank / Buy-Box history** | **Keepa** (long-term add) | Uncontested deep time-series; the *only* source that **contractually green-lights** showing data to our own users. Everyone else = DIY snapshots. |
| **Amazon review text** | **Firecrawl now (thin), then Rainforest/Oxylabs under enterprise agreement** | Accept reality: since Amazon's **May 2026** change, *no* source returns a full review corpus — all cap at ~8–13. Design the feature to degrade gracefully; never let a roadmap depend on deep review data. Use Keepa for rating/count *trend* only. |
| **DTC / brand websites / general web** | **Firecrawl** (built, wired) | Purpose-built general scraper — right tool for non-Amazon competitor/brand pages. |
| **Buy-Box / unauthorized-seller (Brand Defense, brand's OWN ASINs)** | **Amazon SP-API, per-tenant** (each owner authorizes their own account) | First-party, accurate, no scraping risk. **Strict per-tenant** — AUP forbids pooling Buy-Box signals across tenants. Competitor-side Buy-Box → **Keepa history**. |

**Avoid:** **Jungle Scout API** (redistribution + caching bars, no review text), **Helium 10** (internal-use only, $1,499/mo annual, no real public API — study as a competitor, don't embed), **PA-API** (bars third-party-benefit + LLM use), **Bright Data as the embed backend** (most restrictive license; prefer Oxylabs/Apify if we ever need the scraper tier).

**Net:** keep **DataForSEO** as the launch primary (it's built, embeddable, cheap); add **Keepa** as the history/Buy-Box anchor (clean terms) when Brand Defense/longitudinal drift goes real; use **Firecrawl** for web/DTC + thin reviews; reserve **SP-API per-tenant** for the brand owner's own Buy-Box defense.

## 3. Downstream processing + caching architecture

The acquisition source is interchangeable behind an interface; the value + the cost control live downstream.

**3.1 Pipeline (per analysis)** — `acquire → normalize → cache → IDEA-score → persist`:
1. **Acquire** via a `CompetitorDataSource` interface (impls: `DataForSeoSource` [built, `_shared/dataforseo.ts`], `FirecrawlSource` [built], future `KeepaSource`, `SpApiTenantSource`). Modality routing already exists (`routeModality` in `competitor-analysis-asset/lib.ts`).
2. **Normalize** to our grounded shapes (`AmazonProduct`, `AmazonReview`) — done in `dataforseo.ts`; every source maps into the same shape so the analyzer is source-agnostic.
3. **Cache** (see 3.2) — check before every paid call.
4. **IDEA-score** — Claude Sonnet 4.6 on the `audit-asset` rubric; grounding gate drops anything not anchored to fetched evidence.
5. **Persist** the insight to `brand_asset_competitive_insights` (built).

**3.2 Caching — the single biggest cost lever** (both Keepa §11 and DataForSEO permit storing/displaying retrieved data):
- **New table `competitor_asin_cache`** (shared cross-tenant — competitor *public* data isn't tenant-private): `(asin, marketplace)` PK, `source`, `payload jsonb`, `data_kind`, `fetched_at`, `expires_at`. Mirrors the `competitor_asin_metadata_cache` pattern already used on the fulfillment-logistics side (Keepa/Jungle Scout cache, ADR-031).
- **TTLs by volatility:** listings **24h**, review samples **7d**, discovery **24h**, **Buy-Box real-time (no cache / 5-min)**, price/rank history = a **shared history store** built once (scheduled Keepa pulls), served to all tenants.
- **Effect:** when 500 users analyze the same popular competitor ASIN, we pay **one** fetch, not 500. A 40–60% hit rate ~halves DataForSEO marginal cost and, critically, **smooths Keepa's token-burst** so we can hold a cheaper tier.

**3.3 Throughput / latency:** DataForSEO Merchant is **queue-only (POST→GET, up to 45 min Standard / ~1 min Priority)** — so the analyzer must be **async + queued, never inline-blocking** on the user's "Analyze" click (it already runs fire-and-forget with status polling). Keepa is a **token-bucket** — size the tier to **peak concurrency**, not monthly volume, and let the cache absorb bursts.

**3.4 Cost controls:** per-user rate limit (built, mirrors `audit-asset`); a per-tenant monthly analysis cap; `needs_input` instead of fabricating when a source is unconfigured (built — grounding gate); spend alerting on the DataForSEO/Keepa balance.

## 4. Scale economics
~3 analyses/user/mo × ~12 calls = **36 calls/user/mo**.

| Users | Calls/mo | DataForSEO raw data | Keepa (by throughput tier) |
|---|---|---|---|
| 100 | 3,600 | **~$5–7** ($50 top-up lasts ~7 mo) | ~€49 Basic |
| 1,000 | 36,000 | **~$55–70** | ~€129–459 (size to peak concurrency) |
| 5,000 | 180,000 | **~$270–360** | ~€459–1,499 (offer-heavy pulls push higher) |

**Read:** raw data cost is **not** the constraint at any of these scales (5,000 users ≈ sub-$400/mo DataForSEO, ≤€1,499/mo Keepa). The real costs are (a) Keepa burst-tier sizing, (b) engineering the history + cache layer, (c) the legal review. Caching is what keeps (a) and the curve flat.

## 5. Risks / caveats
- **ToS / redistribution (the gating risk).** Clean-to-embed: **Keepa** (written) + **DataForSEO** (Amazon data unrestricted; correction: its s7.2 indemnity is SERP-scoped, does *not* contractually saddle us with Amazon-ToS liability). Needs an enterprise agreement first: **Rainforest, Oxylabs, Bright Data, Firecrawl** (output-redistribution unaddressed). Hard dealbreakers: **Jungle Scout, Helium 10, PA-API**. **Cross-cutting:** every scraping path collides with **Amazon's own anti-scraping ToS** and **GDPR/CCPA on reviewer PII (author names)** — vendors push this liability onto us. **→ counsel review before launch**, independent of any vendor's terms; get written embed-confirmation from DataForSEO + Keepa for our exact architecture.
- **Single-vendor dependency.** The two-source design (DataForSEO/Keepa + a web source) is deliberate; DataForSEO already demonstrated it can take an endpoint offline (reviews).
- **Reviews are structurally fragile industry-wide** (post-May-2026 ~8–13 cap). Product expectation + graceful degrade; never roadmap on deep review corpora.
- **SP-API is strictly per-tenant** for Brand Defense — each brand owner connects their own account, sees only their own data, **no cross-tenant pooling** (AUP).

## 6. Roadmap (reconciled with what's built)
- **Shipped (DataForSEO + Firecrawl, behind `COMPETITOR_AGENTS`):** listings/discovery/sellers (DataForSEO), DTC/web + thin reviews (Firecrawl), IDEA scoring, grounding gate.
- **Near-term:** add `competitor_asin_cache` (§3.2); settle reviews expectation; counsel review + written embed-confirmations; configure DataForSEO secrets ($50).
- **Mid-term:** add **`KeepaSource`** for price/rank/Buy-Box **history** (clean terms) → powers longitudinal Trust-Gap drift + competitor-side Brand Defense; build the shared history store.
- **Long-term:** **SP-API per-tenant** for the brand owner's own Buy-Box/unauthorized-seller defense; brand-level rollup into the gold workbooks; MCP exposure (post-D5). Evaluate Oxylabs/Apify under enterprise agreement only if richer listing content is needed.
