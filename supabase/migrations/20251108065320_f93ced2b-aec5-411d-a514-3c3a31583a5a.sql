-- ============================================
-- Day 2: Database Migrations for P0 Launch
-- Enable pgvector, create RAG tables, diagnostic tables, and chat tables
-- ============================================

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- Step 1: Add diagnostic fields to profiles table
-- ============================================
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS latest_diagnostic_data JSONB,
ADD COLUMN IF NOT EXISTS latest_diagnostic_score INTEGER,
ADD COLUMN IF NOT EXISTS diagnostic_completed_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster diagnostic lookups
CREATE INDEX IF NOT EXISTS idx_profiles_diagnostic_completed 
ON public.profiles(diagnostic_completed_at DESC NULLS LAST);

-- ============================================
-- Step 2: Create diagnostic_submissions table
-- ============================================
CREATE TABLE IF NOT EXISTS public.diagnostic_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  scores JSONB NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.diagnostic_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own diagnostic submissions"
ON public.diagnostic_submissions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own diagnostic submissions"
ON public.diagnostic_submissions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_diagnostic_submissions_user_id 
ON public.diagnostic_submissions(user_id);

CREATE INDEX IF NOT EXISTS idx_diagnostic_submissions_completed 
ON public.diagnostic_submissions(user_id, completed_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_diagnostic_submissions_updated_at
BEFORE UPDATE ON public.diagnostic_submissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Step 3: Create user_knowledge_chunks table for RAG
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB,
  source_type TEXT NOT NULL, -- 'diagnostic', 'document', 'profile'
  source_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own knowledge chunks"
ON public.user_knowledge_chunks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own knowledge chunks"
ON public.user_knowledge_chunks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own knowledge chunks"
ON public.user_knowledge_chunks FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own knowledge chunks"
ON public.user_knowledge_chunks FOR DELETE
USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_user_id 
ON public.user_knowledge_chunks(user_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source 
ON public.user_knowledge_chunks(user_id, source_type, source_id);

-- IVFFlat index for vector similarity search (cosine distance)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding 
ON public.user_knowledge_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Trigger for updated_at
CREATE TRIGGER update_knowledge_chunks_updated_at
BEFORE UPDATE ON public.user_knowledge_chunks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Step 4: Create match_user_documents function for RAG
-- Required by LangChain SupabaseVectorStore
-- ============================================
CREATE OR REPLACE FUNCTION public.match_user_documents(
  query_embedding vector(1536),
  match_user_id UUID,
  match_count INT DEFAULT 5,
  filter JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    user_knowledge_chunks.id,
    user_knowledge_chunks.content,
    user_knowledge_chunks.metadata,
    1 - (user_knowledge_chunks.embedding <=> query_embedding) AS similarity
  FROM user_knowledge_chunks
  WHERE user_knowledge_chunks.user_id = match_user_id
  ORDER BY user_knowledge_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================
-- Step 5: Create chat_messages table
-- ============================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own chat messages"
ON public.chat_messages FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat messages"
ON public.chat_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat messages"
ON public.chat_messages FOR DELETE
USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id 
ON public.chat_messages(user_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created 
ON public.chat_messages(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_role 
ON public.chat_messages(user_id, role, created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_chat_messages_updated_at
BEFORE UPDATE ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Grant necessary permissions
-- ============================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.diagnostic_submissions TO authenticated;
GRANT ALL ON public.user_knowledge_chunks TO authenticated;
GRANT ALL ON public.chat_messages TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_user_documents TO authenticated;