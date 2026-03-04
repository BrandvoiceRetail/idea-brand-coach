-- Add chapter tracking columns to chat_sessions
ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS chapter_id TEXT,
  ADD COLUMN IF NOT EXISTS chapter_metadata JSONB;
