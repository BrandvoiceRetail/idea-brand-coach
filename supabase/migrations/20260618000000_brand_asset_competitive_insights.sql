-- ============================================
-- Brand Asset Competitive Insights + Competitor Assets Library
-- Per-touchpoint, IDEA Trust-Gap-scored competitor reads for the Brand Funnel
-- (Competitor-Agents feature, plan: docs/brand-funnel-builder/COMPETITOR_AGENTS_PLAN.md).
--   * brand_asset_competitive_insights — IDEA scores per competitor for one brand asset.
--   * competitor_assets — per-touchpoint uploaded competitor evidence library.
-- Both are avatar-scoped; RLS via the avatars.user_id = auth.uid() join.
-- ============================================

-- ============================================
-- brand_asset_competitive_insights
-- ============================================
-- asset_id FKs the funnel base table public.brand_assets, which now exists
-- (20260616120000_brand_funnel_tracker.sql runs first). avatar_id is the RLS
-- anchor; asset_id is nullable so an insight can be drafted before its brand
-- asset row is created.
CREATE TABLE IF NOT EXISTS public.brand_asset_competitive_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_id UUID NOT NULL REFERENCES public.avatars(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.brand_assets(id) ON DELETE CASCADE,
  modality TEXT NOT NULL,
  -- competitors: array of
  --   { name, url, idea_scores:{i,d,e,a}, rationale, gap_to_our_avatar, evidence_refs }
  competitors JSONB NOT NULL DEFAULT '[]'::jsonb,
  strategic_angle TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  analyzed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on brand_asset_competitive_insights
ALTER TABLE public.brand_asset_competitive_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies for brand_asset_competitive_insights (access via avatar ownership)
CREATE POLICY "Users can view insights of their own avatars"
ON public.brand_asset_competitive_insights FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.avatars
    WHERE avatars.id = brand_asset_competitive_insights.avatar_id
    AND avatars.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert insights for their own avatars"
ON public.brand_asset_competitive_insights FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.avatars
    WHERE avatars.id = brand_asset_competitive_insights.avatar_id
    AND avatars.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update insights of their own avatars"
ON public.brand_asset_competitive_insights FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.avatars
    WHERE avatars.id = brand_asset_competitive_insights.avatar_id
    AND avatars.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete insights of their own avatars"
ON public.brand_asset_competitive_insights FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.avatars
    WHERE avatars.id = brand_asset_competitive_insights.avatar_id
    AND avatars.user_id = auth.uid()
  )
);

-- Indexes for brand_asset_competitive_insights (FK lookups)
CREATE INDEX IF NOT EXISTS idx_brand_asset_competitive_insights_avatar_id
ON public.brand_asset_competitive_insights(avatar_id);

CREATE INDEX IF NOT EXISTS idx_brand_asset_competitive_insights_asset_id
ON public.brand_asset_competitive_insights(asset_id);

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_brand_asset_competitive_insights_updated_at
  ON public.brand_asset_competitive_insights;
CREATE TRIGGER update_brand_asset_competitive_insights_updated_at
  BEFORE UPDATE ON public.brand_asset_competitive_insights
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.brand_asset_competitive_insights TO authenticated;

-- ============================================
-- competitor_assets
-- Per-touchpoint uploaded competitor evidence library
-- ============================================
CREATE TABLE IF NOT EXISTS public.competitor_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_id UUID NOT NULL REFERENCES public.avatars(id) ON DELETE CASCADE,
  touchpoint_id TEXT NOT NULL,
  source_url TEXT,
  storage_path TEXT,
  content_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on competitor_assets
ALTER TABLE public.competitor_assets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for competitor_assets (access via avatar ownership)
CREATE POLICY "Users can view competitor assets of their own avatars"
ON public.competitor_assets FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.avatars
    WHERE avatars.id = competitor_assets.avatar_id
    AND avatars.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert competitor assets for their own avatars"
ON public.competitor_assets FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.avatars
    WHERE avatars.id = competitor_assets.avatar_id
    AND avatars.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update competitor assets of their own avatars"
ON public.competitor_assets FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.avatars
    WHERE avatars.id = competitor_assets.avatar_id
    AND avatars.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete competitor assets of their own avatars"
ON public.competitor_assets FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.avatars
    WHERE avatars.id = competitor_assets.avatar_id
    AND avatars.user_id = auth.uid()
  )
);

-- Indexes for competitor_assets (FK + per-touchpoint lookups)
CREATE INDEX IF NOT EXISTS idx_competitor_assets_avatar_id
ON public.competitor_assets(avatar_id);

CREATE INDEX IF NOT EXISTS idx_competitor_assets_avatar_id_touchpoint_id
ON public.competitor_assets(avatar_id, touchpoint_id);

-- Grant permissions
GRANT ALL ON public.competitor_assets TO authenticated;
