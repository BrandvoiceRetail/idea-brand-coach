-- ============================================
-- Phase 2: Migrate RAG from OpenAI Vector Stores to pgvector
--
-- Adds category and source_document_id columns to user_knowledge_chunks
-- to support the full range of data previously stored across 5 OpenAI
-- vector stores (diagnostic, avatar, canvas, capture, core).
--
-- Also creates a new match_document_chunks RPC optimized for category-
-- scoped similarity search, used by the updated edge functions.
-- ============================================

-- Ensure pgvector extension is enabled (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Add columns to user_knowledge_chunks ───────────────────────────────────

-- Category aligns with the old OpenAI vector store domains
ALTER TABLE public.user_knowledge_chunks
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'core';

-- Track which uploaded_document this chunk came from (for document re-indexing / deletion)
ALTER TABLE public.user_knowledge_chunks
ADD COLUMN IF NOT EXISTS source_document_id UUID REFERENCES public.uploaded_documents(id) ON DELETE CASCADE;

-- Track the field_identifier for KB entry chunks (for dedup on re-sync)
ALTER TABLE public.user_knowledge_chunks
ADD COLUMN IF NOT EXISTS field_identifier TEXT;

-- Chunk index within a document (useful for ordering context)
ALTER TABLE public.user_knowledge_chunks
ADD COLUMN IF NOT EXISTS chunk_index INTEGER DEFAULT 0;

-- ─── Indexes ────────────────────────────────────────────────────────────────

-- Category-scoped lookups
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_category
ON public.user_knowledge_chunks(user_id, category);

-- Document chunk lookups (for re-indexing / cleanup)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source_doc
ON public.user_knowledge_chunks(source_document_id)
WHERE source_document_id IS NOT NULL;

-- Field identifier lookups (for KB entry dedup)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_field
ON public.user_knowledge_chunks(user_id, field_identifier)
WHERE field_identifier IS NOT NULL;

-- ─── match_document_chunks RPC ──────────────────────────────────────────────
-- Replaces OpenAI file_search across all vector stores.
-- Supports optional category filtering for scoped retrieval.

CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding vector(1536),
  match_user_id UUID,
  match_count INT DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.5,
  filter_categories TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  category TEXT,
  source_type TEXT,
  field_identifier TEXT,
  chunk_index INTEGER,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ukc.id,
    ukc.content,
    ukc.metadata,
    ukc.category,
    ukc.source_type,
    ukc.field_identifier,
    ukc.chunk_index,
    1 - (ukc.embedding <=> query_embedding) AS similarity
  FROM user_knowledge_chunks ukc
  WHERE ukc.user_id = match_user_id
    AND ukc.embedding IS NOT NULL
    AND 1 - (ukc.embedding <=> query_embedding) > match_threshold
    AND (filter_categories IS NULL OR ukc.category = ANY(filter_categories))
  ORDER BY ukc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.match_document_chunks TO authenticated;

-- ─── Add pgvector_synced_at to user_knowledge_base ──────────────────────────
-- Track when a KB entry was last synced to pgvector (replacing openai_synced_at)
ALTER TABLE public.user_knowledge_base
ADD COLUMN IF NOT EXISTS pgvector_synced_at TIMESTAMP WITH TIME ZONE;

-- ─── Add pgvector_indexed to uploaded_documents ─────────────────────────────
-- Track whether a document has been indexed into pgvector
ALTER TABLE public.uploaded_documents
ADD COLUMN IF NOT EXISTS pgvector_indexed BOOLEAN DEFAULT false;

-- ─── Comments ───────────────────────────────────────────────────────────────
COMMENT ON COLUMN public.user_knowledge_chunks.category IS 'Domain category: diagnostic, avatar, canvas, capture, core, insights, copy';
COMMENT ON COLUMN public.user_knowledge_chunks.source_document_id IS 'FK to uploaded_documents when source_type is document';
COMMENT ON COLUMN public.user_knowledge_chunks.field_identifier IS 'KB field identifier when source_type is kb_entry';
COMMENT ON COLUMN public.user_knowledge_chunks.chunk_index IS 'Position of chunk within its source (for ordering)';
COMMENT ON FUNCTION public.match_document_chunks IS 'Semantic similarity search across user knowledge chunks with optional category filtering. Replaces OpenAI vector store file_search.';
