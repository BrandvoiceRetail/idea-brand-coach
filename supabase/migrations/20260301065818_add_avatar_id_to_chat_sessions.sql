-- ============================================
-- Add Avatar ID to Chat Sessions
-- Links chat sessions to specific avatars for multi-avatar support
-- ============================================

-- Add avatar_id column to chat_sessions
ALTER TABLE public.chat_sessions
ADD COLUMN IF NOT EXISTS avatar_id UUID REFERENCES public.avatars(id) ON DELETE SET NULL;

-- Index for filtering chat sessions by avatar
CREATE INDEX IF NOT EXISTS idx_chat_sessions_avatar_id
ON public.chat_sessions(user_id, avatar_id, updated_at DESC);

-- Comment for documentation
COMMENT ON COLUMN public.chat_sessions.avatar_id IS 'Links chat session to specific avatar. Nullable for backward compatibility with existing sessions.';
