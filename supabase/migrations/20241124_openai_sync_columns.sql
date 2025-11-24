-- Migration: Add OpenAI sync tracking and fix category alignment
-- Created: 2024-11-24
-- Description: Adds columns to track OpenAI file sync status and aligns categories with vector stores

-- Add OpenAI sync tracking columns
ALTER TABLE public.user_knowledge_base
ADD COLUMN IF NOT EXISTS openai_file_id TEXT,
ADD COLUMN IF NOT EXISTS openai_synced_at TIMESTAMP WITH TIME ZONE;

-- Create index for finding unsynced entries
CREATE INDEX IF NOT EXISTS idx_user_kb_needs_openai_sync
ON public.user_knowledge_base(user_id, category)
WHERE openai_file_id IS NULL AND LENGTH(content) > 10;

-- Update category constraint to include all valid categories
-- Maps: insights → research/capture, copy → capture, core for general
ALTER TABLE public.user_knowledge_base
DROP CONSTRAINT IF EXISTS user_knowledge_base_category_check;

ALTER TABLE public.user_knowledge_base
ADD CONSTRAINT user_knowledge_base_category_check
CHECK (category IN ('diagnostic', 'avatar', 'insights', 'canvas', 'copy', 'capture', 'core'));

-- Comment explaining category mapping to OpenAI vector stores:
-- diagnostic → diagnostic_store_id
-- avatar → avatar_store_id
-- canvas → canvas_store_id
-- insights → capture_store_id (buyer intent research goes to capture)
-- copy → capture_store_id (copy generation content goes to capture)
-- capture → capture_store_id (direct mapping)
-- core → core_store_id (uploaded docs, conversation insights)
