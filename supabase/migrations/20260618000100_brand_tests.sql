-- ============================================
-- brand_tests — competitor-agents extension of the funnel base table
-- (plan: docs/brand-funnel-builder/COMPETITOR_AGENTS_PLAN.md, ST-4)
--
-- RECONCILED 2026-06-18: the Brand Funnel base now OWNS public.brand_tests
-- (20260616120000_brand_funnel_tracker.sql) as the canonical, asset-scoped lift
-- ledger. This migration NO LONGER creates the table (a CREATE TABLE IF NOT
-- EXISTS would silently skip against the richer funnel table, so the competitor
-- columns + FK would never land). Instead it ALTERs the funnel brand_tests to
-- add the competitor-agents surface idempotently:
--   * competitive_insight_id — FK -> brand_asset_competitive_insights (the P1
--     table this lift loop is informed by); ON DELETE SET NULL.
--   * competitor_insight_applied — the P4 flag: true when this test was informed
--     by a competitor insight (the LT-5 correlation substrate).
--   * avatar_id / touchpoint_id / name / channel / primary_metric / variants —
--     the columns the competitor lift loop's SupabaseCompetitorInsightsService
--     writes that the funnel base does not already carry.
--
-- The funnel base keeps its own RLS (scoped via brand_assets -> avatars -> user)
-- and its asset_id NOT NULL + status CHECK. We widen those minimally so the
-- competitor loop's avatar-scoped, draft-status, possibly asset-less tests fit:
--   * asset_id is dropped to nullable (competitor lift tests may be recorded
--     against an avatar before an asset row exists).
--   * the status CHECK is widened to also allow 'draft'/'completed'/'inconclusive'.
-- We do NOT redefine the funnel RLS policies (they already exist).
--
-- Timestamp 20260618000100 sorts AFTER the P1 insights migration (20260618000000)
-- so the FK target exists.
-- ============================================

-- ---------- competitor-agents columns (idempotent) ----------
ALTER TABLE public.brand_tests
  ADD COLUMN IF NOT EXISTS avatar_id UUID REFERENCES public.avatars(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS competitive_insight_id UUID
    REFERENCES public.brand_asset_competitive_insights(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS touchpoint_id TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS channel TEXT,
  ADD COLUMN IF NOT EXISTS primary_metric TEXT,
  ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS competitor_insight_applied BOOLEAN NOT NULL DEFAULT false;

-- The funnel base declares asset_id NOT NULL. Competitor lift tests are scoped to
-- an avatar and may be recorded before an asset row exists, so relax to nullable.
ALTER TABLE public.brand_tests ALTER COLUMN asset_id DROP NOT NULL;

-- Widen the status CHECK to cover both the funnel vocabulary
-- (running/won/no_lift) and the competitor lift-loop vocabulary
-- (draft/running/completed/inconclusive). Drop-and-recreate is idempotent.
ALTER TABLE public.brand_tests DROP CONSTRAINT IF EXISTS brand_tests_status_check;
ALTER TABLE public.brand_tests
  ADD CONSTRAINT brand_tests_status_check
  CHECK (status IN ('running','won','no_lift','draft','completed','inconclusive'));

-- ---------- indexes for the FK + correlation lookups ----------
CREATE INDEX IF NOT EXISTS idx_brand_tests_avatar_id
ON public.brand_tests(avatar_id);

CREATE INDEX IF NOT EXISTS idx_brand_tests_competitive_insight_id
ON public.brand_tests(competitive_insight_id);

-- For the LT-5 correlation: competitor-informed tests vs. the rest.
-- TODO(competitor-agents:LT-5): warehouse lift attribution. This (avatar_id,
-- competitor_insight_applied) index + the baseline/result columns are the
-- attribution substrate. LT-5 ships the analysis on top: export brand_tests to
-- the warehouse and prove competitor-informed assets (competitor_insight_applied
-- = true) outperform the rest. See docs/brand-funnel-builder/COMPETITOR_AGENTS_LONGTERM.md §LT-5.
CREATE INDEX IF NOT EXISTS idx_brand_tests_competitor_insight_applied
ON public.brand_tests(avatar_id, competitor_insight_applied);

-- ---------- updated_at trigger ----------
-- The funnel base did not attach the shared updated_at trigger to brand_tests;
-- add it here (idempotent) so competitor-loop updates bump updated_at.
DROP TRIGGER IF EXISTS update_brand_tests_updated_at ON public.brand_tests;
CREATE TRIGGER update_brand_tests_updated_at
  BEFORE UPDATE ON public.brand_tests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
