-- ============================================
-- Avatars Table
-- Manages avatar personas associated with brands
-- ============================================

-- Create avatars table
CREATE TABLE IF NOT EXISTS public.avatars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  persona_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on avatars
ALTER TABLE public.avatars ENABLE ROW LEVEL SECURITY;

-- RLS Policies for avatars
-- Users can view avatars belonging to their brands
CREATE POLICY "Users can view avatars of their own brands"
ON public.avatars FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.brands
    WHERE brands.id = avatars.brand_id
    AND brands.user_id = auth.uid()
  )
);

-- Users can insert avatars into their own brands
CREATE POLICY "Users can insert avatars into their own brands"
ON public.avatars FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.brands
    WHERE brands.id = avatars.brand_id
    AND brands.user_id = auth.uid()
  )
);

-- Users can update avatars belonging to their brands
CREATE POLICY "Users can update avatars of their own brands"
ON public.avatars FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.brands
    WHERE brands.id = avatars.brand_id
    AND brands.user_id = auth.uid()
  )
);

-- Users can delete avatars belonging to their brands
CREATE POLICY "Users can delete avatars of their own brands"
ON public.avatars FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.brands
    WHERE brands.id = avatars.brand_id
    AND brands.user_id = auth.uid()
  )
);

-- Indexes for avatars
CREATE INDEX IF NOT EXISTS idx_avatars_brand_id_updated_at
ON public.avatars(brand_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_avatars_brand_id
ON public.avatars(brand_id);

-- Trigger to auto-update avatars.updated_at
DROP TRIGGER IF EXISTS update_avatars_updated_at ON public.avatars;
CREATE TRIGGER update_avatars_updated_at
  BEFORE UPDATE ON public.avatars
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.avatars TO authenticated;
