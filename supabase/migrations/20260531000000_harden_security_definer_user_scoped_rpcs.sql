-- ============================================================================
-- SECURITY FIX (MF-1): close confused-deputy in user-scoped SECURITY DEFINER RPCs
--
-- Four SECURITY DEFINER functions were GRANTed to `authenticated` and trusted a
-- caller-supplied user-id parameter (`match_user_id` / `p_user_id`) WITHOUT
-- verifying the caller is that user. Because SECURITY DEFINER bypasses RLS, any
-- authenticated user could call these directly (PostgREST) with another user's id
-- and read — or, for update_knowledge_entry, WRITE — that user's private data.
--   - match_document_chunks   : cross-tenant read of user_knowledge_chunks
--   - match_user_documents    : cross-tenant read of user_knowledge_chunks
--   - match_user_knowledge    : cross-tenant read of user_knowledge_base
--                               (+ p_user_id DEFAULT NULL returned ALL users' rows)
--   - update_knowledge_entry  : cross-tenant WRITE to user_knowledge_base
--
-- Fix: enforce, INSIDE each function, that the caller IS the target user
-- (`auth.uid() = <user_param>`), fail-closed. This is independent of any
-- gateway/app-layer check, so the function is safe even when called directly.
--
-- Owner-only / fail-closed by design. A future delegation ("VA") model would
-- extend the guard deliberately (e.g. `... OR <active-grant-check>`); it is NOT
-- added here — there is no delegation model today, and default-deny is correct.
--
-- Legitimate callers are unaffected: every in-app caller passes its own
-- authenticated user id (verified across the consultant, brand-strategy
-- document/section, and brand-copy-generator edge functions). brand-copy-generator
-- additionally needed its Supabase client switched to forward the user JWT (see
-- the accompanying edge-function change) so auth.uid() resolves to the caller.
--
-- Also adds `SET search_path = public` to the two functions that lacked it
-- (search-path hardening for SECURITY DEFINER).
-- ============================================================================

-- ─── match_document_chunks (pgvector RAG; used by idea-framework-consultant) ──
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
  -- Authorization: caller must be the target user. Fail closed.
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM match_user_id THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

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

-- ─── match_user_documents (legacy LangChain RAG; fallback + brand-strategy/copy) ─
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
  -- Authorization: caller must be the target user. Fail closed.
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM match_user_id THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

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

-- ─── match_user_knowledge (user_knowledge_base RAG; brand-strategy doc/section) ─
-- Note: p_user_id keeps its DEFAULT NULL signature, but the guard now rejects a
-- NULL p_user_id outright — closing the prior "omit p_user_id => read EVERY
-- user's current KB entries" hole.
CREATE OR REPLACE FUNCTION public.match_user_knowledge(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10,
    p_user_id UUID DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    category TEXT,
    field_identifier TEXT,
    similarity FLOAT,
    metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Authorization: caller must be the target user (and p_user_id must be set). Fail closed.
    IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
        RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        ukb.id,
        ukb.content,
        ukb.category,
        ukb.field_identifier,
        1 - (ukb.embedding <=> query_embedding) AS similarity,
        ukb.metadata
    FROM public.user_knowledge_base ukb
    WHERE
        ukb.embedding IS NOT NULL
        AND ukb.is_current = true
        AND ukb.user_id = p_user_id
        AND (p_categories IS NULL OR ukb.category = ANY(p_categories))
        AND 1 - (ukb.embedding <=> query_embedding) > match_threshold
    ORDER BY ukb.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ─── update_knowledge_entry (versioned KB write; currently no in-app caller) ──
CREATE OR REPLACE FUNCTION public.update_knowledge_entry(
    p_user_id UUID,
    p_field_identifier TEXT,
    p_category TEXT,
    p_new_content TEXT,
    p_new_structured_data JSONB DEFAULT NULL,
    p_new_metadata JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_id UUID;
    v_current_version INTEGER;
BEGIN
    -- Authorization: caller must be the target user. Fail closed.
    IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
        RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
    END IF;

    -- Get current version number
    SELECT COALESCE(MAX(version), 0) INTO v_current_version
    FROM public.user_knowledge_base
    WHERE user_id = p_user_id
        AND field_identifier = p_field_identifier;

    -- Mark old versions as not current
    UPDATE public.user_knowledge_base
    SET is_current = false
    WHERE user_id = p_user_id
        AND field_identifier = p_field_identifier
        AND is_current = true;

    -- Insert new version
    INSERT INTO public.user_knowledge_base (
        user_id,
        field_identifier,
        category,
        content,
        structured_data,
        metadata,
        version,
        is_current
    ) VALUES (
        p_user_id,
        p_field_identifier,
        p_category,
        p_new_content,
        p_new_structured_data,
        p_new_metadata,
        v_current_version + 1,
        true
    ) RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$;

-- Re-affirm grants (CREATE OR REPLACE preserves them; explicit for clarity).
-- Note: none of these are or should be granted to `anon`.
GRANT EXECUTE ON FUNCTION public.match_document_chunks  TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_user_documents   TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_user_knowledge   TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_knowledge_entry TO authenticated;
