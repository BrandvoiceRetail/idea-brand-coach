-- ============================================
-- Performance Metrics Table
-- Tracks ROI and performance metrics for avatars
-- ============================================

-- Create performance_metrics table
CREATE TABLE IF NOT EXISTS public.performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_id UUID NOT NULL REFERENCES public.avatars(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on performance_metrics
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for performance_metrics
-- Users can view metrics for avatars belonging to their brands
CREATE POLICY "Users can view metrics of their own avatars"
ON public.performance_metrics FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.avatars
    JOIN public.brands ON brands.id = avatars.brand_id
    WHERE avatars.id = performance_metrics.avatar_id
    AND brands.user_id = auth.uid()
  )
);

-- Users can insert metrics for avatars belonging to their brands
CREATE POLICY "Users can insert metrics for their own avatars"
ON public.performance_metrics FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.avatars
    JOIN public.brands ON brands.id = avatars.brand_id
    WHERE avatars.id = performance_metrics.avatar_id
    AND brands.user_id = auth.uid()
  )
);

-- Users can update metrics for avatars belonging to their brands
CREATE POLICY "Users can update metrics of their own avatars"
ON public.performance_metrics FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.avatars
    JOIN public.brands ON brands.id = avatars.brand_id
    WHERE avatars.id = performance_metrics.avatar_id
    AND brands.user_id = auth.uid()
  )
);

-- Users can delete metrics for avatars belonging to their brands
CREATE POLICY "Users can delete metrics of their own avatars"
ON public.performance_metrics FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.avatars
    JOIN public.brands ON brands.id = avatars.brand_id
    WHERE avatars.id = performance_metrics.avatar_id
    AND brands.user_id = auth.uid()
  )
);

-- Indexes for performance_metrics
CREATE INDEX IF NOT EXISTS idx_performance_metrics_avatar_id_recorded_at
ON public.performance_metrics(avatar_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_avatar_id
ON public.performance_metrics(avatar_id);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_metric_type
ON public.performance_metrics(metric_type);

-- Grant permissions
GRANT ALL ON public.performance_metrics TO authenticated;
