-- ============================================
-- User Memories Table
-- Backing store for the Anthropic memory tool (memory_20250818) in the
-- idea-framework-consultant-claude edge function. Each row is one memory
-- "file" in the per-user /memories directory; directories are implicit
-- (path prefixes). App-standard taxonomy, instantiated per user:
--   /memories/index.md, founder.md, coaching.md, brand.md, sessions/*.md
-- Written ONLY via the memory tool handler (user-JWT client under RLS).
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path TEXT NOT NULL
    CHECK (path LIKE '/memories/%' AND path NOT LIKE '%..%'),
  content TEXT NOT NULL
    CHECK (char_length(content) <= 8192),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, path)
);

-- Enable RLS on user_memories
ALTER TABLE public.user_memories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_memories
CREATE POLICY "Users can view their own memories"
ON public.user_memories FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own memories"
ON public.user_memories FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memories"
ON public.user_memories FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memories"
ON public.user_memories FOR DELETE
USING (auth.uid() = user_id);

-- Index for user_memories (path lookups + prefix listings per user)
CREATE INDEX IF NOT EXISTS idx_user_memories_user_path
ON public.user_memories(user_id, path);

-- Trigger to auto-update user_memories.updated_at
DROP TRIGGER IF EXISTS update_user_memories_updated_at ON public.user_memories;
CREATE TRIGGER update_user_memories_updated_at
  BEFORE UPDATE ON public.user_memories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.user_memories TO authenticated;
