-- ============================================
-- Brands Table
-- Manages brand entities owned by users
-- ============================================

-- Create brands table
CREATE TABLE IF NOT EXISTS public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on brands
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- RLS Policies for brands
CREATE POLICY "Users can view their own brands"
ON public.brands FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own brands"
ON public.brands FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own brands"
ON public.brands FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own brands"
ON public.brands FOR DELETE
USING (auth.uid() = user_id);

-- Indexes for brands
CREATE INDEX IF NOT EXISTS idx_brands_user_id_updated_at
ON public.brands(user_id, updated_at DESC);

-- Trigger to auto-update brands.updated_at
DROP TRIGGER IF EXISTS update_brands_updated_at ON public.brands;
CREATE TRIGGER update_brands_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.brands TO authenticated;
