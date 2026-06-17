-- ============================================
-- trust_gap_snapshots — Brand Defense & retention track (Competitor-Agents P6)
-- (plan: docs/brand-funnel-builder/COMPETITOR_AGENTS_PLAN.md — Track B / LT-2,
--  manifest: docs/brand-funnel-builder/_BUILD_MANIFEST.md §3 P6)
--
-- A periodic, avatar-scoped snapshot of brand-defense health rolled up from three
-- feeds:
--   * avatar_drift            — avatar-accuracy drift signal (best-effort; the
--                               drift detector is unbuilt on this branch, so this
--                               starts as a clearly-marked stub — see the service).
--   * decision_trigger_health — Decision-Trigger health derived from the asset
--                               ledger's pass/needs-work/fail history.
--   * competitive_pressure    — competitor pressure derived from
--                               brand_asset_competitive_insights.
--   * composite_score         — a 0-100 roll-up across the three feeds.
--
-- Timestamp 20260618000300 sorts AFTER the P5 voc-signals migration
-- (20260618000200). avatar_id is the RLS anchor (avatars.user_id = auth.uid(),
-- matching the P1 brand_asset_competitive_insights + P4 brand_tests migrations).
-- ============================================

CREATE TABLE IF NOT EXISTS public.trust_gap_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_id UUID NOT NULL REFERENCES public.avatars(id) ON DELETE CASCADE,
  captured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- avatar-accuracy drift signal:
  --   { score, signal:'stub'|'measured', detail, drifted_fields:[...] }
  avatar_drift JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Decision-Trigger health from the asset-ledger pass/needs-work/fail history:
  --   { score, pass, needs_work, fail, total, source:'asset-ledger'|'unavailable' }
  decision_trigger_health JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- competitor pressure from brand_asset_competitive_insights:
  --   { score, competitor_count, insight_count, avg_competitor_strength, top_gap }
  competitive_pressure JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 0-100 roll-up across the three feeds (higher = healthier defense posture).
  composite_score INTEGER NOT NULL DEFAULT 0
    CHECK (composite_score >= 0 AND composite_score <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on trust_gap_snapshots
ALTER TABLE public.trust_gap_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trust_gap_snapshots (access via avatar ownership)
CREATE POLICY "Users can view snapshots of their own avatars"
ON public.trust_gap_snapshots FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.avatars
    WHERE avatars.id = trust_gap_snapshots.avatar_id
    AND avatars.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert snapshots for their own avatars"
ON public.trust_gap_snapshots FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.avatars
    WHERE avatars.id = trust_gap_snapshots.avatar_id
    AND avatars.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update snapshots of their own avatars"
ON public.trust_gap_snapshots FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.avatars
    WHERE avatars.id = trust_gap_snapshots.avatar_id
    AND avatars.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete snapshots of their own avatars"
ON public.trust_gap_snapshots FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.avatars
    WHERE avatars.id = trust_gap_snapshots.avatar_id
    AND avatars.user_id = auth.uid()
  )
);

-- Indexes for trust_gap_snapshots (avatar lookups + latest-first reads)
CREATE INDEX IF NOT EXISTS idx_trust_gap_snapshots_avatar_id
ON public.trust_gap_snapshots(avatar_id);

CREATE INDEX IF NOT EXISTS idx_trust_gap_snapshots_avatar_id_captured_at
ON public.trust_gap_snapshots(avatar_id, captured_at DESC);

-- Grant permissions
GRANT ALL ON public.trust_gap_snapshots TO authenticated;
