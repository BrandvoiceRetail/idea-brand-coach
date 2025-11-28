-- ============================================
-- Chat Sessions Table
-- Manages conversation sessions like ChatGPT/Claude.ai
-- ============================================

-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chatbot_type TEXT NOT NULL DEFAULT 'idea-framework-consultant',
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add session_id to chat_messages (nullable for backward compatibility)
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE;

-- Add updated_at column to chat_messages if it doesn't exist
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Enable RLS on chat_sessions
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_sessions
CREATE POLICY "Users can view their own chat sessions"
ON public.chat_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat sessions"
ON public.chat_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat sessions"
ON public.chat_sessions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat sessions"
ON public.chat_sessions FOR DELETE
USING (auth.uid() = user_id);

-- Indexes for chat_sessions
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id_updated_at
ON public.chat_sessions(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_chatbot_updated_at
ON public.chat_sessions(user_id, chatbot_type, updated_at DESC);

-- Index for chat_messages session_id
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id
ON public.chat_messages(session_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update chat_sessions.updated_at
DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON public.chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.chat_sessions TO authenticated;
