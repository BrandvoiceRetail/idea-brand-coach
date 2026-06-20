# Competitor Data — Launch 1-Pager (short-term)

_2026-06-18. The initial-launch deliverable + next steps. Full analysis: [`COMPETITOR_DATA_SOURCING_DESIGN.md`](./COMPETITOR_DATA_SOURCING_DESIGN.md)._

## Decision
Launch on **DataForSEO** (Amazon listings, discovery, sellers) + **Firecrawl** (DTC/web pages + thin reviews) — both already built, deployed, and behind the `COMPETITOR_AGENTS` flag. They are **two of only two** Amazon-data sources that are cleanly embeddable in a paid multi-tenant app without first negotiating an enterprise agreement. Defer Keepa, SP-API, and the scraper tier to the design-doc roadmap.

## What v1 delivers (already live in prod)
- Per-touchpoint competitor agent on `/v2/funnel`, **IDEA Trust-Gap scored** (parity with `audit-asset`), grounded — never fabricates.
- **Listings + competitor discovery + sellers** via DataForSEO (`competitor-analysis-asset` edge fn, deployed).
- **DTC/web pages + thin review sample** via Firecrawl (keys already set).
- Edge fns + schema live; grounding gate verified (returns `needs_input`, not invented data, when a source is unconfigured).

## The 2 things to turn it fully on
1. **DataForSEO account** → `$50` one-time top-up → set `DATAFORSEO_USERNAME` / `DATAFORSEO_PASSWORD` secrets. Cost is **~$0.01–0.05 per analysis**; $50 lasts months at launch volume.
2. **Set review expectations.** DataForSEO's reviews endpoint is **temporarily disabled**, and industry-wide (post-Amazon-May-2026) *no* source returns more than ~8–13 reviews. v1 uses Firecrawl's on-listing sample; the feature must read as "signal from recent reviews," not "full review mining."

## Add now (the one cost lever)
- **`competitor_asin_cache`** table — `(asin, marketplace)` keyed, cross-tenant, TTL: listings 24h / reviews 7d / Buy-Box none. So when many users analyze the same competitor, we pay **one** fetch. Small migration; flattens the cost curve before scale. (Mirrors the fulfillment-logistics `competitor_asin_metadata_cache` pattern.)

## Explicitly deferred (not in v1 — see design doc)
- **Keepa** — price/rank/Buy-Box **history** (clean terms) → powers longitudinal drift + Brand Defense. Add when monitoring goes real.
- **SP-API (per-tenant)** — brand owner's own Buy-Box / unauthorized-seller defense.
- **Rainforest / Oxylabs / Apify** — richer listings/reviews, **only under a written enterprise agreement** (self-serve ToS forbid embedding).

## Next steps
- [ ] Create DataForSEO account, top up $50, set the two secrets (then I deploy is already done — it lights up immediately).
- [ ] Add the `competitor_asin_cache` migration + wire the cache check into `competitor-analysis-asset`.
- [ ] **Counsel review** (gating for real launch): Amazon ToS + GDPR/CCPA on reviewer PII; get written embed-confirmation from DataForSEO (and Keepa before that's added) for our multi-tenant architecture.
- [ ] Tighten the review-modality copy to set the "thin sample" expectation.
- [ ] Confirm Titan `get_alerts` coverage before Brand Defense alerts move off the stub (Trevor's open question).

## Done = launched
DataForSEO secrets set → the per-touchpoint competitor agent runs end-to-end in prod (listings + discovery + thin reviews, IDEA-scored, cached), behind the flag, for sprint/tester use — with the legal review cleared before customer GA.
