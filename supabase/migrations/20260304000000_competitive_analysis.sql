-- ============================================
-- Competitive Analysis Tables
-- Stores competitive analysis data and competitor reviews
-- ============================================

-- Create competitive_analyses table
CREATE TABLE IF NOT EXISTS public.competitive_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_category TEXT NOT NULL,
  analysis_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  competitors JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_reviews_analyzed INTEGER NOT NULL DEFAULT 0,
  market_insights JSONB,
  customer_segments JSONB,
  competitive_positioning JSONB,
  opportunity_gaps JSONB,
  idea_insights JSONB,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on competitive_analyses
ALTER TABLE public.competitive_analyses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for competitive_analyses
CREATE POLICY "Users can view their own competitive analyses"
ON public.competitive_analyses FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own competitive analyses"
ON public.competitive_analyses FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own competitive analyses"
ON public.competitive_analyses FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own competitive analyses"
ON public.competitive_analyses FOR DELETE
USING (auth.uid() = user_id);

-- Indexes for competitive_analyses
CREATE INDEX IF NOT EXISTS idx_competitive_analyses_user_id
ON public.competitive_analyses(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_competitive_analyses_status
ON public.competitive_analyses(status)
WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_competitive_analyses_market_category
ON public.competitive_analyses(user_id, market_category);

-- Trigger to auto-update competitive_analyses.updated_at
DROP TRIGGER IF EXISTS update_competitive_analyses_updated_at ON public.competitive_analyses;
CREATE TRIGGER update_competitive_analyses_updated_at
  BEFORE UPDATE ON public.competitive_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.competitive_analyses TO authenticated;

-- ============================================
-- Competitor Reviews Table
-- Stores individual reviews for each analysis
-- ============================================

-- Create competitor_reviews table
CREATE TABLE IF NOT EXISTS public.competitor_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES public.competitive_analyses(id) ON DELETE CASCADE,
  competitor_name TEXT NOT NULL,
  source TEXT NOT NULL,
  review_text TEXT NOT NULL,
  rating NUMERIC(2, 1) CHECK (rating >= 0 AND rating <= 5),
  review_date TIMESTAMP WITH TIME ZONE,
  verified_purchase BOOLEAN NOT NULL DEFAULT false,
  sentiment_score NUMERIC(4, 3) CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
  key_themes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on competitor_reviews
ALTER TABLE public.competitor_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies for competitor_reviews (access via analysis ownership)
CREATE POLICY "Users can view reviews for their analyses"
ON public.competitor_reviews FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.competitive_analyses
    WHERE id = competitor_reviews.analysis_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert reviews for their analyses"
ON public.competitor_reviews FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.competitive_analyses
    WHERE id = competitor_reviews.analysis_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete reviews for their analyses"
ON public.competitor_reviews FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.competitive_analyses
    WHERE id = competitor_reviews.analysis_id
    AND user_id = auth.uid()
  )
);

-- Indexes for competitor_reviews
CREATE INDEX IF NOT EXISTS idx_competitor_reviews_analysis_id
ON public.competitor_reviews(analysis_id);

CREATE INDEX IF NOT EXISTS idx_competitor_reviews_competitor_name
ON public.competitor_reviews(analysis_id, competitor_name);

CREATE INDEX IF NOT EXISTS idx_competitor_reviews_sentiment
ON public.competitor_reviews(analysis_id, sentiment_score)
WHERE sentiment_score IS NOT NULL;

-- Grant permissions
GRANT ALL ON public.competitor_reviews TO authenticated;
