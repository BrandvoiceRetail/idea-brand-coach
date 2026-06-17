-- ============================================
-- brand_defense_alerts — in-app alert inbox (Competitor-Agents P6 — Track B)
-- (plan: docs/brand-funnel-builder/COMPETITOR_AGENTS_PLAN.md — Track B,
--  manifest: docs/brand-funnel-builder/_BUILD_MANIFEST.md §3 P6)
--
-- The in-app notification channel backing the unread-badge surface in the funnel
-- UI. The brand-defense-monitor edge function raises an alert here when an alert
-- source (Titan, STUBBED) reports a threat; the alert carries the IDEA-scored
-- interpretation, a drafted response, and a link to the logged ledger asset.
--
-- Timestamp 20260618000400 sorts AFTER the P6 trust_gap_snapshots migration
-- (20260618000300). avatar_id is the RLS anchor (avatars.user_id = auth.uid(),
-- matching the other P1/P4/P6 competitor-agents migrations).
-- ============================================

CREATE TABLE IF NOT EXISTS public.brand_defense_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_id UUID NOT NULL REFERENCES public.avatars(id) ON DELETE CASCADE,
  -- The threat category (trademark = phase 2, see edge fn TODO).
  category TEXT NOT NULL
    CHECK (category IN ('listing-integrity', 'buy-box', 'compliance', 'reputation')),
  -- The IDEA dimension this threat puts at risk (canonical enum).
  threatened_dimension TEXT
    CHECK (threatened_dimension IN ('insight', 'distinctive', 'empathetic', 'authentic')),
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  -- Human-readable interpretation (IDEA-scored read of the event).
  interpretation TEXT,
  -- The alert source's raw payload, clearly tagged (e.g. { source:'titan-stub',
  -- coverage:'unverified', event:{...} }).
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- The drafted response (chained concept -> draft -> publish-filter), as a shaped
  -- payload; the actual ledger asset is referenced by ledger_request_id.
  drafted_response JSONB,
  -- The IV-OS asset-ledger request_id the drafted response was logged under, if any.
  ledger_request_id TEXT,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on brand_defense_alerts
ALTER TABLE public.brand_defense_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for brand_defense_alerts (access via avatar ownership)
CREATE POLICY "Users can view alerts of their own avatars"
ON public.brand_defense_alerts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.avatars
    WHERE avatars.id = brand_defense_alerts.avatar_id
    AND avatars.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert alerts for their own avatars"
ON public.brand_defense_alerts FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.avatars
    WHERE avatars.id = brand_defense_alerts.avatar_id
    AND avatars.user_id = auth.uid()
  )
);

-- Users mark alerts read/unread (update) and dismiss (delete) on their own avatars.
CREATE POLICY "Users can update alerts of their own avatars"
ON public.brand_defense_alerts FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.avatars
    WHERE avatars.id = brand_defense_alerts.avatar_id
    AND avatars.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete alerts of their own avatars"
ON public.brand_defense_alerts FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.avatars
    WHERE avatars.id = brand_defense_alerts.avatar_id
    AND avatars.user_id = auth.uid()
  )
);

-- Indexes for brand_defense_alerts (avatar lookups + unread-badge query)
CREATE INDEX IF NOT EXISTS idx_brand_defense_alerts_avatar_id
ON public.brand_defense_alerts(avatar_id);

-- Powers the unread badge: count where read_at IS NULL per avatar.
CREATE INDEX IF NOT EXISTS idx_brand_defense_alerts_avatar_id_unread
ON public.brand_defense_alerts(avatar_id, created_at DESC)
WHERE read_at IS NULL;

-- Grant permissions
GRANT ALL ON public.brand_defense_alerts TO authenticated;
