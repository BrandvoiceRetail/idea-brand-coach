-- ============================================
-- Brand Funnel Tracker — core schema
-- brand_assets (asset-across-funnel ledger), brand_tests (lift records),
-- and an optional funnel-stage extension to performance_metrics.
-- RLS scopes via avatars.user_id = auth.uid() (live `avatars` has no brand_id).
-- ============================================

-- ---------- brand_assets ----------
CREATE TABLE IF NOT EXISTS public.brand_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_id UUID NOT NULL REFERENCES public.avatars(id) ON DELETE CASCADE,
  touchpoint_id TEXT NOT NULL,                 -- key into touchpoint-taxonomy.v0.json
  stage TEXT NOT NULL,                         -- awareness | consideration | purchase_decision | retention | advocacy
  -- REQUIRED short description the user enters so the audit has context for the screenshot.
  context_description TEXT NOT NULL CHECK (length(btrim(context_description)) >= 8),
  storage_path TEXT,                           -- path in the private 'brand-assets' bucket
  signature_version TEXT,                      -- signatures.artifact_id in force when deployed (drives "stale")
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','aligned','stale','misaligned','missing')),
  overall_score INT CHECK (overall_score BETWEEN 0 AND 100),
  audit_result JSONB,                          -- { scores:{i,d,e,a}, rationale, fix }
  superseded_by UUID REFERENCES public.brand_assets(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own brand_assets" ON public.brand_assets FOR SELECT
USING (EXISTS (SELECT 1 FROM public.avatars
  WHERE avatars.id = brand_assets.avatar_id AND avatars.user_id = auth.uid()));
CREATE POLICY "insert own brand_assets" ON public.brand_assets FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.avatars
  WHERE avatars.id = brand_assets.avatar_id AND avatars.user_id = auth.uid()));
CREATE POLICY "update own brand_assets" ON public.brand_assets FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.avatars
  WHERE avatars.id = brand_assets.avatar_id AND avatars.user_id = auth.uid()));
CREATE POLICY "delete own brand_assets" ON public.brand_assets FOR DELETE
USING (EXISTS (SELECT 1 FROM public.avatars
  WHERE avatars.id = brand_assets.avatar_id AND avatars.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_brand_assets_avatar_id ON public.brand_assets(avatar_id);
CREATE INDEX IF NOT EXISTS idx_brand_assets_avatar_touchpoint ON public.brand_assets(avatar_id, touchpoint_id);
CREATE INDEX IF NOT EXISTS idx_brand_assets_status ON public.brand_assets(status);

GRANT ALL ON public.brand_assets TO authenticated;

-- ---------- brand_tests ----------
CREATE TABLE IF NOT EXISTS public.brand_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.brand_assets(id) ON DELETE CASCADE,
  hypothesis TEXT,
  messaging_version_before TEXT,
  messaging_version_after TEXT,
  metric_type TEXT,
  baseline_value NUMERIC,
  result_value NUMERIC,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','won','no_lift')),
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','warehouse')),
  deployed_at TIMESTAMP WITH TIME ZONE,
  measured_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_tests ENABLE ROW LEVEL SECURITY;

-- Scope through brand_assets -> avatars -> user
CREATE POLICY "view own brand_tests" ON public.brand_tests FOR SELECT
USING (EXISTS (SELECT 1 FROM public.brand_assets ba
  JOIN public.avatars a ON a.id = ba.avatar_id
  WHERE ba.id = brand_tests.asset_id AND a.user_id = auth.uid()));
CREATE POLICY "insert own brand_tests" ON public.brand_tests FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.brand_assets ba
  JOIN public.avatars a ON a.id = ba.avatar_id
  WHERE ba.id = brand_tests.asset_id AND a.user_id = auth.uid()));
CREATE POLICY "update own brand_tests" ON public.brand_tests FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.brand_assets ba
  JOIN public.avatars a ON a.id = ba.avatar_id
  WHERE ba.id = brand_tests.asset_id AND a.user_id = auth.uid()));
CREATE POLICY "delete own brand_tests" ON public.brand_tests FOR DELETE
USING (EXISTS (SELECT 1 FROM public.brand_assets ba
  JOIN public.avatars a ON a.id = ba.avatar_id
  WHERE ba.id = brand_tests.asset_id AND a.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_brand_tests_asset_id ON public.brand_tests(asset_id);
CREATE INDEX IF NOT EXISTS idx_brand_tests_status ON public.brand_tests(status);

GRANT ALL ON public.brand_tests TO authenticated;

-- ---------- performance_metrics: attribute a metric to a funnel touchpoint/asset ----------
-- Guarded: performance_metrics may not exist in this database yet.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'performance_metrics'
  ) THEN
    ALTER TABLE public.performance_metrics
      ADD COLUMN IF NOT EXISTS funnel_stage TEXT,
      ADD COLUMN IF NOT EXISTS touchpoint_id TEXT,
      ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES public.brand_assets(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS deployed_at TIMESTAMP WITH TIME ZONE;
    CREATE INDEX IF NOT EXISTS idx_performance_metrics_asset_id ON public.performance_metrics(asset_id);
  END IF;
END $$;
