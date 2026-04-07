-- ============================================
-- Phase 4A: Drop OpenAI-specific columns and tables
--
-- Removes tracking columns that were used for OpenAI Vector Store sync
-- and the user_vector_stores table that tracked per-user VS IDs.
-- Embedding dimensions are NOT changed (staying at 1536 with ada-002).
-- ============================================

-- ─── Drop OpenAI tracking columns ─────────────────────────────────────────
ALTER TABLE public.chat_sessions DROP COLUMN IF EXISTS openai_response_id;
ALTER TABLE public.user_knowledge_base DROP COLUMN IF EXISTS openai_file_id;
ALTER TABLE public.user_knowledge_base DROP COLUMN IF EXISTS openai_synced_at;
ALTER TABLE public.uploaded_documents DROP COLUMN IF EXISTS openai_file_id;

-- ─── Drop OpenAI vector stores table ──────────────────────────────────────
DROP TABLE IF EXISTS public.user_vector_stores CASCADE;

-- ─── Drop orphaned indexes ────────────────────────────────────────────────
DROP INDEX IF EXISTS idx_user_kb_needs_openai_sync;
DROP INDEX IF EXISTS idx_uploaded_documents_openai_file_id;
