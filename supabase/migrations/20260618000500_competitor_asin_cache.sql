-- ============================================
-- competitor_asin_cache — shared cross-tenant cache of fetched competitor data
-- (Competitor-Agents cost lever; design: docs/brand-funnel-builder/COMPETITOR_DATA_SOURCING_DESIGN.md §3.2)
--
-- Competitor PUBLIC data (listings / reviews / discovery) is NOT tenant-private,
-- so one fetch per (source, data_kind, cache_key, marketplace) can serve EVERY
-- tenant. When 500 users analyze the same popular ASIN, we pay one upstream
-- fetch, not 500. TTL by volatility (enforced by the caller via expires_at):
-- listings ~24h, reviews ~7d, discovery ~24h; Buy-Box is NOT cached (real-time).
-- Mirrors the fulfillment-logistics competitor_asin_metadata_cache pattern.
--
-- ACCESS MODEL: written + read ONLY by the competitor edge functions via the
-- SERVICE ROLE (which bypasses RLS). It is NOT user-scoped and is never read by
-- the browser/anon client, so RLS is enabled with NO policies (service-role-only,
-- same posture as figma_connections). The security advisor INFO "rls_enabled_no_policy"
-- on this table is intentional.
-- ============================================

CREATE TABLE IF NOT EXISTS public.competitor_asin_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,                 -- 'dataforseo' | 'firecrawl' | 'keepa' | ...
  data_kind TEXT NOT NULL,              -- 'listing' | 'product' | 'reviews' | 'discovery'
  cache_key TEXT NOT NULL,              -- ASIN, or a normalized keyword/category/url key
  marketplace TEXT NOT NULL DEFAULT 'amazon.com',
  payload JSONB NOT NULL,               -- normalized fetched data (AmazonProduct / AmazonReview[] / ...)
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- One current row per logical key; the caller upserts via ON CONFLICT.
CREATE UNIQUE INDEX IF NOT EXISTS uq_competitor_asin_cache_key
  ON public.competitor_asin_cache (source, data_kind, cache_key, marketplace);

-- Freshness lookups + TTL cleanup.
CREATE INDEX IF NOT EXISTS idx_competitor_asin_cache_expires_at
  ON public.competitor_asin_cache (expires_at);

-- Service-role-only: enable RLS, define no policies (anon/authenticated get no access).
ALTER TABLE public.competitor_asin_cache ENABLE ROW LEVEL SECURITY;
