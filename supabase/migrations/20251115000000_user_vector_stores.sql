-- ============================================
-- User Vector Stores Table
-- Track OpenAI vector store IDs for each user
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_vector_stores (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  diagnostic_store_id TEXT NOT NULL,
  avatar_store_id TEXT NOT NULL,
  canvas_store_id TEXT NOT NULL,
  capture_store_id TEXT NOT NULL,
  core_store_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_vector_stores ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own vector stores"
ON public.user_vector_stores FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own vector stores"
ON public.user_vector_stores FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vector stores"
ON public.user_vector_stores FOR UPDATE
USING (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_user_vector_stores_user_id
ON public.user_vector_stores(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_vector_stores_updated_at
BEFORE UPDATE ON public.user_vector_stores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.user_vector_stores TO authenticated;
