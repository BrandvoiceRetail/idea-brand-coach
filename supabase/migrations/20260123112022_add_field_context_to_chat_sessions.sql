-- ============================================
-- Add Field Context to Chat Sessions
-- Enables field-level chat conversations that can be filtered/viewed separately
-- ============================================

-- Add field context columns to chat_sessions
ALTER TABLE public.chat_sessions
ADD COLUMN IF NOT EXISTS conversation_type TEXT NOT NULL DEFAULT 'general' CHECK (conversation_type IN ('general', 'field'));

ALTER TABLE public.chat_sessions
ADD COLUMN IF NOT EXISTS field_id TEXT; -- e.g., 'avatar.demographics', 'canvas.brand_promise'

ALTER TABLE public.chat_sessions
ADD COLUMN IF NOT EXISTS field_label TEXT; -- Human-readable label e.g., 'Demographics', 'Brand Promise'

ALTER TABLE public.chat_sessions
ADD COLUMN IF NOT EXISTS page_context TEXT; -- e.g., '/avatar', '/canvas'

-- Index for filtering field conversations
CREATE INDEX IF NOT EXISTS idx_chat_sessions_conversation_type
ON public.chat_sessions(user_id, conversation_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_field_id
ON public.chat_sessions(user_id, field_id, updated_at DESC);

-- Comment for documentation
COMMENT ON COLUMN public.chat_sessions.conversation_type IS 'Type of conversation: general (Brand Coach) or field (inline field chat)';
COMMENT ON COLUMN public.chat_sessions.field_id IS 'Identifier for the specific field, e.g., avatar.demographics, canvas.brand_promise';
COMMENT ON COLUMN public.chat_sessions.field_label IS 'Human-readable label for the field';
COMMENT ON COLUMN public.chat_sessions.page_context IS 'Page path where the conversation was started';
