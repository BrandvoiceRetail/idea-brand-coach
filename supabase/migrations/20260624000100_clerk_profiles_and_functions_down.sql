-- =====================================================================
-- 20260624000100_clerk_profiles_and_functions_down.sql
-- ROLLBACK of the OPTIONAL Clerk profiles+functions completion migration
-- =====================================================================
-- Reverses 20260624000100_clerk_profiles_and_functions.sql:
--   * restores the 9 functions (12 overloads) to their ORIGINAL definitions
--     (auth.uid() bodies + uuid user-id params), dropping the text-param
--     overloads created by the forward migration first;
--   * converts profiles.id text -> uuid, restores the auth.users FK and the
--     original profiles/beta_testers policies (auth.uid() bodies).
--
-- WARNING: profiles.id::uuid FAILS if any row holds a non-uuid Clerk id.
-- Restoring profiles_id_fkey FAILS unless every profiles.id has a matching
-- auth.users row. Run this only after re-keying/removing Clerk-era rows.
-- This DOWN should run BEFORE 20260624000000_clerk_native_swap_down.sql.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- STEP 1 (down): restore the 9 functions to their original definitions.
--   Drop the text-param overloads created forward, then recreate originals.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.match_document_chunks(query_embedding vector, match_user_id text, match_count integer, match_threshold double precision, filter_categories text[]);
DROP FUNCTION IF EXISTS public.match_document_chunks(query_embedding vector, match_user_id text, match_count integer, match_threshold double precision, filter_categories text[], match_brand_id uuid, match_avatar_id uuid);
DROP FUNCTION IF EXISTS public.match_document_chunks(query_embedding vector, match_user_id text, match_count integer, match_threshold double precision, filter_categories text[], match_brand_id uuid, match_avatar_ids uuid[]);
DROP FUNCTION IF EXISTS public.match_user_documents(query_embedding vector, match_user_id text, match_count integer, filter jsonb);
DROP FUNCTION IF EXISTS public.match_user_knowledge(query_embedding vector, match_threshold double precision, match_count integer, p_user_id text, p_categories text[]);
DROP FUNCTION IF EXISTS public.save_artifact_atomic(p_user_id text, p_avatar_id uuid, p_kind text, p_content jsonb, p_grounding text, p_evidence_refs jsonb);
DROP FUNCTION IF EXISTS public.save_artifact_atomic(p_user_id text, p_brand_id uuid, p_avatar_id uuid, p_kind text, p_content jsonb, p_grounding text, p_evidence_refs jsonb);
DROP FUNCTION IF EXISTS public.update_knowledge_entry(p_user_id text, p_field_identifier text, p_category text, p_new_content text, p_new_structured_data jsonb, p_new_metadata jsonb);

CREATE OR REPLACE FUNCTION public.match_document_chunks(query_embedding vector, match_user_id uuid, match_count integer DEFAULT 5, match_threshold double precision DEFAULT 0.5, filter_categories text[] DEFAULT NULL::text[])
 RETURNS TABLE(id uuid, content text, metadata jsonb, category text, source_type text, field_identifier text, chunk_index integer, similarity double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
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
$function$

CREATE OR REPLACE FUNCTION public.match_document_chunks(query_embedding vector, match_user_id uuid, match_count integer, match_threshold double precision, filter_categories text[], match_brand_id uuid, match_avatar_id uuid)
 RETURNS TABLE(id uuid, content text, metadata jsonb, category text, source_type text, field_identifier text, chunk_index integer, similarity double precision)
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
    AND (c.scope = 'brand' OR match_avatar_id IS NULL OR c.avatar_id = match_avatar_id)
    AND (1 - (c.embedding <=> query_embedding)) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END; $function$

CREATE OR REPLACE FUNCTION public.match_document_chunks(query_embedding vector, match_user_id uuid, match_count integer, match_threshold double precision, filter_categories text[], match_brand_id uuid, match_avatar_ids uuid[])
 RETURNS TABLE(id uuid, content text, metadata jsonb, category text, source_type text, field_identifier text, chunk_index integer, similarity double precision)
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
END; $function$

CREATE OR REPLACE FUNCTION public.match_user_documents(query_embedding vector, match_user_id uuid, match_count integer DEFAULT 5, filter jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(id uuid, content text, metadata jsonb, similarity double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
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
$function$

CREATE OR REPLACE FUNCTION public.match_user_knowledge(query_embedding vector, match_threshold double precision DEFAULT 0.7, match_count integer DEFAULT 10, p_user_id uuid DEFAULT NULL::uuid, p_categories text[] DEFAULT NULL::text[])
 RETURNS TABLE(id uuid, content text, category text, field_identifier text, similarity double precision, metadata jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
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
$function$

CREATE OR REPLACE FUNCTION public.save_artifact_atomic(p_user_id uuid, p_avatar_id uuid, p_kind text, p_content jsonb, p_grounding text, p_evidence_refs jsonb)
 RETURNS artifacts
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    v_new public.artifacts;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
        RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
    END IF;

    UPDATE public.artifacts
       SET superseded_by = id
     WHERE user_id = p_user_id
       AND kind = p_kind
       AND COALESCE(avatar_id, '00000000-0000-0000-0000-000000000000'::uuid)
           = COALESCE(p_avatar_id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND superseded_by IS NULL;

    INSERT INTO public.artifacts (user_id, avatar_id, kind, content, grounding, evidence_refs)
    VALUES (p_user_id, p_avatar_id, p_kind, p_content, p_grounding, p_evidence_refs)
    RETURNING * INTO v_new;

    UPDATE public.artifacts
       SET superseded_by = v_new.id
     WHERE user_id = p_user_id
       AND kind = p_kind
       AND COALESCE(avatar_id, '00000000-0000-0000-0000-000000000000'::uuid)
           = COALESCE(p_avatar_id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND superseded_by = id;

    RETURN v_new;
END;
$function$

CREATE OR REPLACE FUNCTION public.save_artifact_atomic(p_user_id uuid, p_brand_id uuid, p_avatar_id uuid, p_kind text, p_content jsonb, p_grounding text, p_evidence_refs jsonb)
 RETURNS artifacts
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_new public.artifacts; v_lock_ids uuid[];
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_brand_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.brands b WHERE b.id = p_brand_id AND b.user_id = p_user_id) THEN
    RAISE EXCEPTION 'brand_not_owned' USING ERRCODE = '42501';
  END IF;
  SELECT array_agg(id) INTO v_lock_ids FROM (
    SELECT id FROM public.artifacts
     WHERE user_id = p_user_id AND kind = p_kind
       AND COALESCE(avatar_id, '00000000-0000-0000-0000-000000000000'::uuid)
           = COALESCE(p_avatar_id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND superseded_by IS NULL FOR UPDATE
  ) locked;
  UPDATE public.artifacts SET superseded_by = id
   WHERE user_id = p_user_id AND kind = p_kind
     AND COALESCE(avatar_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = COALESCE(p_avatar_id, '00000000-0000-0000-0000-000000000000'::uuid)
     AND superseded_by IS NULL;
  INSERT INTO public.artifacts (user_id, brand_id, avatar_id, kind, content, grounding, evidence_refs)
  VALUES (p_user_id, p_brand_id, p_avatar_id, p_kind, p_content, p_grounding, p_evidence_refs)
  RETURNING * INTO v_new;
  UPDATE public.artifacts SET superseded_by = v_new.id
   WHERE user_id = p_user_id AND kind = p_kind
     AND COALESCE(avatar_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = COALESCE(p_avatar_id, '00000000-0000-0000-0000-000000000000'::uuid)
     AND superseded_by = id;
  RETURN v_new;
END; $function$

CREATE OR REPLACE FUNCTION public.save_asset_audit_atomic(p_brand_asset_id uuid, p_avatar_id uuid, p_overall_score integer, p_audit_result jsonb, p_grounding text, p_evidence_refs jsonb)
 RETURNS brand_asset_audits
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_brand uuid; v_abrand uuid; v_new public.brand_asset_audits;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT ba.brand_id INTO v_brand FROM public.brand_assets ba
    JOIN public.brands b ON b.id = ba.brand_id AND b.user_id = v_uid WHERE ba.id = p_brand_asset_id;
  IF v_brand IS NULL THEN RAISE EXCEPTION 'asset_not_owned' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.avatars a WHERE a.id = p_avatar_id AND a.user_id = v_uid) THEN
    RAISE EXCEPTION 'avatar_not_owned' USING ERRCODE = '42501';
  END IF;
  SELECT a.brand_id INTO v_abrand FROM public.avatars a WHERE a.id = p_avatar_id;
  IF v_abrand IS NULL THEN RAISE EXCEPTION 'avatar_has_no_brand' USING ERRCODE = '22023'; END IF;
  IF v_abrand IS DISTINCT FROM v_brand THEN RAISE EXCEPTION 'brand_mismatch' USING ERRCODE = '22023'; END IF;
  PERFORM 1 FROM public.brand_asset_audits
    WHERE brand_asset_id = p_brand_asset_id AND avatar_id = p_avatar_id AND superseded_by IS NULL FOR UPDATE;
  UPDATE public.brand_asset_audits SET superseded_by = id
   WHERE brand_asset_id = p_brand_asset_id AND avatar_id = p_avatar_id AND superseded_by IS NULL;
  INSERT INTO public.brand_asset_audits
    (brand_asset_id, avatar_id, brand_id, user_id, overall_score, audit_result, grounding, evidence_refs)
  VALUES (p_brand_asset_id, p_avatar_id, v_brand, v_uid, p_overall_score, p_audit_result,
     COALESCE(p_grounding, 'inference'), COALESCE(p_evidence_refs, '[]'::jsonb))
  RETURNING * INTO v_new;
  UPDATE public.brand_asset_audits SET superseded_by = v_new.id
   WHERE brand_asset_id = p_brand_asset_id AND avatar_id = p_avatar_id AND superseded_by = id;
  RETURN v_new;
END; $function$

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
END; $function$

CREATE OR REPLACE FUNCTION public.set_current_avatar(p_avatar_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF p_avatar_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.avatars a WHERE a.id = p_avatar_id AND a.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'avatar_not_owned' USING ERRCODE = '42501';
  END IF;
  UPDATE public.profiles SET current_avatar_id = p_avatar_id WHERE id = auth.uid();
END; $function$

CREATE OR REPLACE FUNCTION public.set_primary_avatar(p_avatar_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_brand uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.avatars a WHERE a.id = p_avatar_id AND a.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'avatar_not_owned' USING ERRCODE = '42501';
  END IF;
  SELECT a.brand_id INTO v_brand FROM public.avatars a WHERE a.id = p_avatar_id;
  IF v_brand IS NULL THEN RAISE EXCEPTION 'avatar_has_no_brand' USING ERRCODE = '22023'; END IF;
  UPDATE public.avatars SET is_primary = false WHERE brand_id = v_brand AND is_primary;
  UPDATE public.avatars SET is_primary = true  WHERE id = p_avatar_id;
  UPDATE public.brands  SET primary_avatar_id = p_avatar_id WHERE id = v_brand;
END; $function$

CREATE OR REPLACE FUNCTION public.update_knowledge_entry(p_user_id uuid, p_field_identifier text, p_category text, p_new_content text, p_new_structured_data jsonb DEFAULT NULL::jsonb, p_new_metadata jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_new_id UUID;
    v_current_version INTEGER;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
        RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(MAX(version), 0) INTO v_current_version
    FROM public.user_knowledge_base
    WHERE user_id = p_user_id
        AND field_identifier = p_field_identifier;

    UPDATE public.user_knowledge_base
    SET is_current = false
    WHERE user_id = p_user_id
        AND field_identifier = p_field_identifier
        AND is_current = true;

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
$function$


-- ---------------------------------------------------------------------
-- STEP 2 (down): profiles.id text -> uuid + restore FK + restore policies.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own beta tester records" ON public.beta_testers;

-- (If STEP 1d default was enabled forward, drop it before the type change.)
ALTER TABLE public.profiles ALTER COLUMN id DROP DEFAULT;

ALTER TABLE public.profiles ALTER COLUMN id TYPE uuid USING id::uuid;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE POLICY "Users can view own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = id));
CREATE POLICY "Users can insert own profile" ON public.profiles AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = id));
CREATE POLICY "Users can update own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = id));
CREATE POLICY "Users can view their own beta tester records" ON public.beta_testers AS PERMISSIVE FOR SELECT TO public
  USING (((email IS NOT NULL) AND (email = ( SELECT profiles.email
   FROM profiles
  WHERE (profiles.id = auth.uid())))));

COMMIT;