-- ============================================
-- Add OpenAI response ID for Conversations API chaining
-- Stores the last Responses API response ID per session,
-- enabling server-managed conversation history via previous_response_id.
-- ============================================

ALTER TABLE public.chat_sessions
ADD COLUMN IF NOT EXISTS openai_response_id TEXT;

COMMENT ON COLUMN public.chat_sessions.openai_response_id IS
  'Last OpenAI Responses API response ID — used as previous_response_id for conversation chaining';
