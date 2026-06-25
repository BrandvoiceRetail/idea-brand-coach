# ADR-review-scrape-scaling: Bursty bulk review-scraping (20–100 users × 100+ ASINs)

## Status
Proposed — 2026-06-25

## Context
The coach can now pull Amazon reviews via `ingest_evidence(asin)` → `review-scraper` edge fn
(Firecrawl). The question: do we survive a burst of 20–100 users, each scraping >100 ASINs
(their whole catalog)? That's **2,000–10,000 scrapes arriving in a short window.** The current
path was built and reviewed for "a few users, a handful of ASINs" — the per-user rate limit was
explicitly DEFERRED (review.md TICKET-1). This ADR decides what must change before that burst.

## Current architecture (relevant parts)
- **Synchronous, inline, unbounded.** `ingest_evidence(asin)` calls `review-scraper` and blocks
  until the scrape returns (~8–30s: 3s wait action + Firecrawl LLM JSON extraction). One ASIN per
  call → **no bulk path**: 100 ASINs = 100 serial tool calls (~17 min wall-clock per user).
- **No backpressure / no quota.** No queue, no per-user cap, no global Firecrawl concurrency ceiling.
- **Firecrawl** is hit on EVERY call (~5 credits/scrape). `review-scraper` does NOT cache.
- **Supabase Free tier** (per infra inventory): auto-pauses when idle; tight edge-fn concurrency
  and connection limits. `review-scraper` holds one edge invocation open for the whole scrape.
- **MCP gateway**: single Node container on the shared mango Lightsail box (no horizontal scale).
- **Already present but UNUSED here:** `_shared/asinCache.ts` + `competitor_asin_cache`
  (service-role, cross-tenant, `reviews` TTL 7d) — used by `competitor-analysis-asset`, not by
  `review-scraper`.

## Decision
**Yes, the current design will fail under that burst.** Ranked bottlenecks (binding first):

1. **Firecrawl — hard external wall + real $.** ~5 credits/scrape × up to 10,000 = ~50,000 credits
   in one burst (a Standard plan's *monthly* allotment is ~100k; Free/Hobby is 500–3,000). Plus a
   per-account concurrency cap (typically 2–20 off-enterprise) serializes the burst → 30–90 min to
   drain. This is the wall.
2. **Synchronous + unbounded design.** 100 concurrent users = thundering herd straight at Firecrawl
   and the edge runtime, with no queue/backpressure/quota and no bulk path.
3. **Supabase Free tier.** (a) auto-pause → a cold project greets the burst with NXDOMAIN/timeouts;
   (b) edge-fn concurrency → 100+ long-held (8–30s) invocations exceed the free ceiling → 5xx;
   (c) a 10-URL batch (2s between + scrape ≈ 100s) risks the per-invocation wall-clock limit.
4. **Single-box MCP gateway.** 100+ concurrent 8–30s in-flight tool calls on one shared container;
   I/O-bound so survivable, but memory + shared-box contention with mango is a risk, no scale-out.

**The decision: do NOT scale the synchronous path. Cache first, then make ingest async + bounded.**
The order matters — the cache removes most of the load the other fixes would otherwise have to absorb.

## Rationale
- **Caching is the dominant lever and the change is small** — the primitive is built, proven, and
  schema-ready. Review data is cross-tenant: ASIN `B0CJBN849W` reviews are identical for every user.
  Wiring `review-scraper` through `asinCache` (`source:'firecrawl'`, `dataKind:'reviews'`, key=ASIN,
  marketplace; TTL 7d) collapses overlapping catalogs and makes re-runs/bursts **mostly cache hits** —
  10,000 raw scrapes → "unique ASINs scraped this week." This is the SRP-clean place for it: the
  edge fn owns "get reviews for a URL," and a cache is a transparent infrastructure detail behind that.
- **Async + bounded ingest** respects the dependency rule: the domain wants "reviews for my catalog";
  Firecrawl's plan limit is an infrastructure constraint that must be absorbed by a queue/worker with a
  global concurrency ceiling, not pushed onto the user-facing request (which today blocks for minutes).
- **Per-user + global rate limit** (TICKET-1, now load-bearing) is the abuse/cost guardrail; without it
  one user's 100-ASIN upload can starve the Firecrawl budget for everyone.
- **Supabase Pro** removes auto-pause (a launch-correctness issue, not just perf) and raises the
  concurrency/connection ceilings — the "$25 cliff at first real users" is now that moment.

## Alternatives considered
- **Just raise the Firecrawl plan + Supabase Pro, keep it synchronous.** Rejected: throws money at a
  design flaw. Without the cache, cost scales linearly with users×catalog and re-runs; without a queue,
  the thundering herd still spikes concurrency and the UX is "blocks for 17 minutes."
- **Batch many URLs per edge-fn call.** Rejected as the primary fix: a 10-URL call already nears the
  edge wall-clock limit; bigger batches make it worse and reduce per-item failure isolation. Queue
  individual jobs instead.
- **Scrape client-side / ask users to paste.** Rejected: defeats the feature's value (auto-pull) and
  the paste path already exists as the manual fallback.

## Consequences
- Enables 20–100-user bursts within a sized, predictable Firecrawl budget; re-scrapes are ~free for 7d.
- Introduces a queue + worker (new operational surface — needs observability: queue depth, Firecrawl
  429 rate, cache hit-rate, per-user spend) and a service-role cache dependency in `review-scraper`.
- Async ingest changes the UX contract: `ingest_evidence` returns "queued N ASINs" instead of inline
  results; the coach/UI must reflect "populating." Net-positive (no multi-minute blocking).
- Cache means a user can get another tenant's freshly-scraped reviews for the same ASIN — correct and
  desired (public data), but document it (no PII; reviews are public).

## Dependency graph
### Blocked by (must ship first)
- **Firecrawl plan confirmation** — external. Need the plan's concurrency cap + monthly credit budget
  to size the global limiter and the per-user quota. **#1 unknown to confirm.**
- **Supabase tier confirmation** — confirm still Free (auto-pause behavior) before relying on a burst.

### Blocks (waiting on this)
- Any "upload your catalog" / bulk-review onboarding flow — must be built async from day one.
- Tester onboarding at scale (the burst scenario itself).

### Critical path position
- **On the path to multi-user launch.** Not needed for a 1–5 tester pilot (current synchronous path is
  fine there). Becomes P0 the moment catalog-scale upload is offered to >~10 concurrent users.
- Next after this: the bulk-ingest tool + the queue UX surface.

### External dependencies
- Firecrawl (plan limits — confirm), Supabase (tier upgrade — provision), the cross-tenant cache table
  (exists: `competitor_asin_cache`, migration 20260618000500).

## Pre-implementation refactoring
- None blocking. `asinCache.ts` is import-ready. `review-scraper`'s auth uses the user JWT; the cache
  read/write uses a *separate* service-role client (the asinCache pattern) — additive, no refactor.

## Affected modules
- `supabase/functions/review-scraper/index.ts` — wrap the Firecrawl call in `getCached`/`upsertCached`
  (per-URL, keyed by ASIN+marketplace).
- `src/mcp/tools/ingestEvidence.ts` (+ a future `bulk_ingest_evidence`) — enqueue instead of inline
  scrape; add per-user quota check.
- New: queue + worker (Supabase pg cron / a queue table, or an external worker on the box) + a global
  Firecrawl concurrency limiter + rate-limit store (the diagnostic-interpretation IP rate-limit is a
  reusable pattern).
- Observability: queue depth, cache hit-rate, Firecrawl 429s, per-user credit spend.

## Long-term vision alignment
The cache + async-bounded-ingest is the same shape the competitor-agents cost model already chose
(cache is the cost lever). Converging review-scraping onto that pattern keeps one coherent
"public-data fetch → cross-tenant cache → bounded worker" capability rather than two divergent ones.

## Recommended phasing
- **P0 (before any catalog-scale burst):** (1) **✅ DONE 2026-06-25** — wired `review-scraper` →
  `asinCache` (`source:'firecrawl'`, `dataKind:'reviews'`, key=URL, TTL 7d; cache hits skip Firecrawl
  AND the 2s inter-fetch delay; only non-empty results cached). Live-verified: cold miss 15.3s vs warm
  hit 1.05s (~15×), 0 credits on hit, 7d cache row confirmed. (2) **✅ DONE 2026-06-25** — per-user +
  global rate limit / burst ceiling / budget kill-switch (TICKET-1): atomic `consume_scrape_quota` RPC
  + `scrape_rate_usage` table (migration 20260625000000); `review-scraper` gates each cache-MISS fetch
  (hits uncounted) via `_shared/scrapeRateLimit.ts`; env-tunable caps (`SCRAPE_USER_DAILY_MAX` 250 /
  `SCRAPE_GLOBAL_DAILY_MAX` 2000 / `SCRAPE_GLOBAL_WINDOW_MAX` 30 per 60s) + hard env kill-switch
  `REVIEW_SCRAPE_ENABLED`; fail-open if the limiter errors. Live-verified: cold fetch counts (user=1),
  cache hit doesn't; RPC denies at cap. **Tune `SCRAPE_GLOBAL_DAILY_MAX` once the Firecrawl plan
  (item 4) is confirmed.** (3) Supabase Pro (kills auto-pause); (4) confirm + size the Firecrawl plan.
- **P1 (for true 100-user bursts + bulk upload):** **✅ DONE 2026-06-25** — durable async queue
  (`scrape_jobs` + `scrape_job_items`, migrations 20260625000100/000200) + worker edge fn
  `process-scrape-jobs` (claims via SKIP-LOCKED `claim_scrape_items` RPC; scrapes through
  `review-scraper`'s new SERVICE-ROLE mode so cache + rate-limit are reused; freezes evidence via
  service-role + explicit user_id; self-re-triggers via `waitUntil`, backs off on rate-limit).
  MCP tools `bulk_ingest_evidence(asins[],marketplace?,product_id?,avatar_id?)` (validates/dedups,
  enqueues, kicks, returns job_id immediately) + `get_ingest_job(job_id)` (progress + nudge).
  Live-verified: 2-URL job drained to done (5+6 reviews frozen) via cache hits. No service-role key
  on the box (work stays inside Supabase).
- **P1.5 (cron safety-net) ✅ DONE 2026-06-25** — `pg_cron` + `pg_net` + `kick_scrape_drain()`
  (migration 20260625000300) runs every 3 min and POSTs the worker ONLY when items are pending,
  using a drain-only secret from Vault (`drain_cron_secret`; the worker's `DRAIN_CRON_SECRET` env).
  process-scrape-jobs is `verify_jwt=false` (config.toml) so the hex secret reaches the fn's own auth
  gate (service-role | drain-secret | valid user) instead of the platform's JWT check. Recovers a drain
  stalled by rate-limit backoff with no user nudging. Live-verified: a seeded pending item drained to
  done (5 reviews) via the cron path (kick → pg_net → worker 202 → drain).
