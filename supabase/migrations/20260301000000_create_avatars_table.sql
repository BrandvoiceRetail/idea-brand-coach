-- ============================================
-- Avatars Table
-- Manages customer avatars with demographics, psychographics, and buying behavior
-- ============================================

-- Create avatars table
CREATE TABLE IF NOT EXISTS public.avatars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  demographics JSONB DEFAULT '{}'::jsonb,
  psychographics JSONB DEFAULT '{}'::jsonb,
  buying_behavior JSONB DEFAULT '{}'::jsonb,
  voice_of_customer TEXT,
  is_template BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on avatars
ALTER TABLE public.avatars ENABLE ROW LEVEL SECURITY;

-- RLS Policies for avatars
CREATE POLICY "Users can view their own avatars"
ON public.avatars FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own avatars"
ON public.avatars FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own avatars"
ON public.avatars FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own avatars"
ON public.avatars FOR DELETE
USING (auth.uid() = user_id);

-- Indexes for avatars
CREATE INDEX IF NOT EXISTS idx_avatars_user_id_updated_at
ON public.avatars(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_avatars_user_id
ON public.avatars(user_id);

-- Trigger to auto-update avatars.updated_at
DROP TRIGGER IF EXISTS update_avatars_updated_at ON public.avatars;
CREATE TRIGGER update_avatars_updated_at
  BEFORE UPDATE ON public.avatars
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.avatars TO authenticated;
