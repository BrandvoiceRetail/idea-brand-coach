-- Multi-select avatar context set (thread-anchored + profile default + union retrieval).
-- Additive + idempotent. Supersedes single-active set_current_avatar in the app layer
-- (kept for single-target/seed callers). See docs/v2/architecture/MULTI_AVATAR_DESIGN.md.
-- Applied to live 2026-06-18 (ledger: avatar_context_set).

-- 1. Per-thread context set (the retrieval anchor for a SPA chat thread).
ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS context_avatar_ids uuid[];

UPDATE public.chat_sessions
  SET context_avatar_ids = ARRAY[avatar_id]
  WHERE avatar_id IS NOT NULL AND context_avatar_ids IS NULL;

-- 2. Profile-level default set (seed for new threads + edge-fn fallback).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS context_avatar_ids uuid[];

UPDATE public.profiles
  SET context_avatar_ids = ARRAY[current_avatar_id]
  WHERE current_avatar_id IS NOT NULL AND context_avatar_ids IS NULL;

-- 3. Single canonical write path for the active set (SPA + MCP). SECURITY INVOKER,
--    ownership-checks every member (mirrors set_current_avatar's owned-or-deny pattern).
CREATE OR REPLACE FUNCTION public.set_context_avatars(p_avatar_ids uuid[])
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_avatar_ids IS NULL OR array_length(p_avatar_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'empty_avatar_set' USING ERRCODE = '22023';
  END IF;
  -- Every avatar in the set must belong to the caller, else deny the whole write.
  IF EXISTS (
    SELECT 1 FROM unnest(p_avatar_ids) AS s(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.avatars a WHERE a.id = s.id AND a.user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'avatar_not_owned' USING ERRCODE = '42501';
  END IF;
  UPDATE public.profiles
    SET context_avatar_ids = p_avatar_ids,
        current_avatar_id  = p_avatar_ids[1]
    WHERE id = auth.uid();
END; $function$;

-- 4. Union retrieval overload: brand-shared ∪ chunks for any avatar in the set.
--    Distinct param name (match_avatar_ids) from the live single overload (match_avatar_id)
--    → PostgREST resolves by name; no DEFAULTs → no arity ambiguity with the 5-arg.
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding vector,
  match_user_id uuid,
  match_count integer,
  match_threshold double precision,
  filter_categories text[],
  match_brand_id uuid,
  match_avatar_ids uuid[]
)
  RETURNS TABLE(
    id uuid, content text, metadata jsonb, category text, source_type text,
    field_identifier text, chunk_index integer, similarity double precision
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM match_user_id THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT c.id, c.content, c.metadata, c.category, c.source_type,
         c.field_identifier, c.chunk_index,
         (1 - (c.embedding <=> query_embedding)) AS similarity
  FROM public.user_knowledge_chunks c
  WHERE c.user_id = match_user_id
    AND (filter_categories IS NULL OR c.category = ANY(filter_categories))
    AND (match_brand_id IS NULL OR c.brand_id = match_brand_id)
    AND (c.scope = 'brand' OR match_avatar_ids IS NULL OR c.avatar_id = ANY(match_avatar_ids))
    AND (1 - (c.embedding <=> query_embedding)) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END; $function$;
