-- =============================================================================
-- Multi-Avatar Phase 1 — FILE 3/4: RPCs (additive; 6-arg save_artifact_atomic INTACT)
-- =============================================================================
-- LIVE FACTS baked in:
--   * save_artifact_atomic exists ONLY as 6-arg, SECURITY INVOKER, RETURNS artifacts,
--     supersede key = (user_id, COALESCE(avatar_id, zero-uuid), kind) WHERE superseded_by IS NULL.
--     We ADD a 7-arg overload (arity overload) and LEAVE the 6-arg untouched so the live
--     artifactStore.ts keeps working until its MCP redeploy. brand_id is WRITTEN, NOT
--     part of the match key -> 6-arg and 7-arg calls for the same (user,kind,avatar)
--     collapse to one supersede chain (no double-CURRENT vs uq_artifacts_current_per_kind).
--   * match_document_chunks exists as 5-arg SECURITY DEFINER. We ADD a scoped overload
--     (extra brand/avatar params) and leave the 5-arg intact.
--   * set_current_avatar / set_primary_avatar / save_asset_audit_atomic are all net-new.
--   * GRANT discipline: REVOKE FROM PUBLIC + GRANT EXECUTE TO authenticated in this file,
--     INCLUDING the pre-existing 5-arg/6-arg signatures (security M-4).
--
-- REVIEW FIXES applied in this file:
--   * security H-1: save_artifact_atomic (7-arg) takes a row lock (FOR UPDATE via an
--     advisory-style guarded SELECT) before superseding, closing the concurrent dual-CURRENT
--     race (it previously only failed loudly on the unique index).
--   * security H-2: match_document_chunks (SECURITY DEFINER) now gates auth.uid() == match_user_id,
--     so a caller cannot scan another user's chunks by passing a foreign UUID.
--   * security C-2: set_primary_avatar separates "not owned" from "owned but no brand" so the
--     error is accurate and the NULL-brand window is explicit.
--   * security M-1: save_asset_audit_atomic applies the same existence-then-brand separation.
--   * security M-4: REVOKE/GRANT now also cover the live 5-arg match_document_chunks and
--     6-arg save_artifact_atomic so anon cannot retain a default PUBLIC EXECUTE.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. save_artifact_atomic — ADDITIVE 7-arg overload (6-arg left intact)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_artifact_atomic(
  p_user_id      uuid,
  p_brand_id     uuid,
  p_avatar_id    uuid,
  p_kind         text,
  p_content      jsonb,
  p_grounding    text,
  p_evidence_refs jsonb
)
RETURNS public.artifacts
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_new public.artifacts;
  v_lock_ids uuid[];
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  -- Optional brand ownership check (brand_id may be NULL on legacy callers).
  IF p_brand_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.brands b WHERE b.id = p_brand_id AND b.user_id = p_user_id) THEN
    RAISE EXCEPTION 'brand_not_owned' USING ERRCODE = '42501';
  END IF;

  -- security H-1: lock the current row(s) for this (user, kind, avatar) slot FIRST so two
  -- concurrent calls serialize through this RPC instead of both passing the "superseded_by
  -- IS NULL" check and racing to a dual-CURRENT state. The lock is released at COMMIT.
  SELECT array_agg(id) INTO v_lock_ids
  FROM (
    SELECT id FROM public.artifacts
     WHERE user_id = p_user_id
       AND kind = p_kind
       AND COALESCE(avatar_id, '00000000-0000-0000-0000-000000000000'::uuid)
           = COALESCE(p_avatar_id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND superseded_by IS NULL
     FOR UPDATE
  ) locked;

  -- Supersede key IDENTICAL to the 6-arg path (brand_id is NOT matched). Two-phase marker:
  -- mark current rows with their own id, insert the new row, then repoint to the new id.
  UPDATE public.artifacts
     SET superseded_by = id
   WHERE user_id = p_user_id
     AND kind = p_kind
     AND COALESCE(avatar_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = COALESCE(p_avatar_id, '00000000-0000-0000-0000-000000000000'::uuid)
     AND superseded_by IS NULL;

  INSERT INTO public.artifacts (user_id, brand_id, avatar_id, kind, content, grounding, evidence_refs)
  VALUES (p_user_id, p_brand_id, p_avatar_id, p_kind, p_content, p_grounding, p_evidence_refs)
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
$function$;

-- -----------------------------------------------------------------------------
-- 2. set_current_avatar — SECURITY INVOKER, single write path for the coach pointer
-- -----------------------------------------------------------------------------
-- Both SPA and MCP MUST call this RPC; no direct UPDATE profiles SET current_avatar_id.
-- Ownership-checked: raises avatar_not_owned for an avatar the caller does not own.
CREATE OR REPLACE FUNCTION public.set_current_avatar(p_avatar_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_avatar_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.avatars a WHERE a.id = p_avatar_id AND a.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'avatar_not_owned' USING ERRCODE = '42501';
  END IF;
  UPDATE public.profiles SET current_avatar_id = p_avatar_id WHERE id = auth.uid();
END;
$function$;

-- -----------------------------------------------------------------------------
-- 3. set_primary_avatar — clear+set is_primary in one tx; mirror brands.primary_avatar_id
-- -----------------------------------------------------------------------------
-- security C-2: existence and brand-presence are checked SEPARATELY so the error is accurate
-- (avatar_not_owned vs avatar_has_no_brand) and the brand_id-NULL window (between FILE 1 and
-- FILE 4) is explicit rather than masquerading as an ownership failure.
CREATE OR REPLACE FUNCTION public.set_primary_avatar(p_avatar_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_brand uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.avatars a WHERE a.id = p_avatar_id AND a.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'avatar_not_owned' USING ERRCODE = '42501';
  END IF;
  SELECT a.brand_id INTO v_brand FROM public.avatars a WHERE a.id = p_avatar_id;
  IF v_brand IS NULL THEN
    RAISE EXCEPTION 'avatar_has_no_brand' USING ERRCODE = '22023';
  END IF;
  -- Clear the current primary before setting the new one (respects the partial unique idx).
  -- Each UPDATE is statement-atomic; the partial unique idx is checked at statement end, so
  -- clear-then-set cannot transiently collide (data-integrity review L confirmed safe).
  UPDATE public.avatars SET is_primary = false WHERE brand_id = v_brand AND is_primary;
  UPDATE public.avatars SET is_primary = true  WHERE id = p_avatar_id;
  UPDATE public.brands  SET primary_avatar_id = p_avatar_id WHERE id = v_brand;
END;
$function$;

-- -----------------------------------------------------------------------------
-- 4. save_asset_audit_atomic — self-supersede->insert->repoint per (brand_asset, avatar)
-- -----------------------------------------------------------------------------
-- security M-1: existence-then-brand separation (avatar_not_owned vs avatar_has_no_brand),
-- mirroring set_primary_avatar, so the NULL-brand window yields an accurate error.
CREATE OR REPLACE FUNCTION public.save_asset_audit_atomic(
  p_brand_asset_id uuid,
  p_avatar_id      uuid,
  p_overall_score  integer,
  p_audit_result   jsonb,
  p_grounding      text,
  p_evidence_refs  jsonb
)
RETURNS public.brand_asset_audits
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_brand  uuid;
  v_abrand uuid;
  v_new    public.brand_asset_audits;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Resolve + verify ownership of the inventory asset (via its brand).
  SELECT ba.brand_id INTO v_brand
  FROM public.brand_assets ba
  JOIN public.brands b ON b.id = ba.brand_id AND b.user_id = v_uid
  WHERE ba.id = p_brand_asset_id;
  IF v_brand IS NULL THEN
    RAISE EXCEPTION 'asset_not_owned' USING ERRCODE = '42501';
  END IF;

  -- Verify the avatar is owned; then verify it carries a brand; then verify same brand.
  IF NOT EXISTS (SELECT 1 FROM public.avatars a WHERE a.id = p_avatar_id AND a.user_id = v_uid) THEN
    RAISE EXCEPTION 'avatar_not_owned' USING ERRCODE = '42501';
  END IF;
  SELECT a.brand_id INTO v_abrand FROM public.avatars a WHERE a.id = p_avatar_id;
  IF v_abrand IS NULL THEN
    RAISE EXCEPTION 'avatar_has_no_brand' USING ERRCODE = '22023';
  END IF;
  IF v_abrand IS DISTINCT FROM v_brand THEN
    RAISE EXCEPTION 'brand_mismatch' USING ERRCODE = '22023';
  END IF;

  -- security H-1 parity: lock the current overlay row for this (asset, avatar) before superseding.
  PERFORM 1 FROM public.brand_asset_audits
    WHERE brand_asset_id = p_brand_asset_id AND avatar_id = p_avatar_id AND superseded_by IS NULL
    FOR UPDATE;

  UPDATE public.brand_asset_audits
     SET superseded_by = id
   WHERE brand_asset_id = p_brand_asset_id
     AND avatar_id = p_avatar_id
     AND superseded_by IS NULL;

  INSERT INTO public.brand_asset_audits
    (brand_asset_id, avatar_id, brand_id, user_id, overall_score, audit_result, grounding, evidence_refs)
  VALUES
    (p_brand_asset_id, p_avatar_id, v_brand, v_uid, p_overall_score, p_audit_result,
     COALESCE(p_grounding, 'inference'), COALESCE(p_evidence_refs, '[]'::jsonb))
  RETURNING * INTO v_new;

  UPDATE public.brand_asset_audits
     SET superseded_by = v_new.id
   WHERE brand_asset_id = p_brand_asset_id
     AND avatar_id = p_avatar_id
     AND superseded_by = id;

  RETURN v_new;
END;
$function$;

-- -----------------------------------------------------------------------------
-- 5. match_document_chunks — ADDITIVE scoped overload (5-arg left intact)
-- -----------------------------------------------------------------------------
-- New optional brand/avatar scope params (DEFAULT NULL). When NULL the scope predicate
-- is permissive, so the scoped overload is a superset of the existing 5-arg behavior.
-- SECURITY DEFINER mirrors the live function; security H-2 adds an explicit caller-identity
-- gate so the DEFINER privilege cannot be used to scan another user's chunks by passing a
-- foreign match_user_id.
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding   vector,
  match_user_id     uuid,
  match_count       integer,
  match_threshold   double precision,
  filter_categories text[],
  match_brand_id    uuid,
  match_avatar_id   uuid
)
RETURNS TABLE(
  id uuid, content text, metadata jsonb, category text,
  source_type text, field_identifier text, chunk_index integer, similarity double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- security H-2: a SECURITY DEFINER function must not trust a caller-supplied user id.
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
    -- brand-scoped chunks are always visible; avatar-scoped only when the avatar matches
    AND (c.scope = 'brand' OR match_avatar_id IS NULL OR c.avatar_id = match_avatar_id)
    AND (1 - (c.embedding <=> query_embedding)) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;

-- -----------------------------------------------------------------------------
-- 6. GRANT discipline (security M-4: cover the pre-existing 5-arg / 6-arg too)
-- -----------------------------------------------------------------------------
-- LIVE-VERIFIED: the existing match_document_chunks(5-arg) / save_artifact_atomic(6-arg)
-- already have EXECUTE = {authenticated, service_role, postgres} and NO PUBLIC/anon grant
-- (hardened by 20260531000002). So M-4's "PUBLIC may retain EXECUTE" premise is ALREADY
-- satisfied on live — the guarded block below is an idempotent confirmation/no-op there.
-- We grant the NEW overloads to BOTH authenticated AND service_role to match the existing
-- functions' grant shape (edge functions call some of these under the service role).
REVOKE ALL ON FUNCTION public.save_artifact_atomic(uuid,uuid,uuid,text,jsonb,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_artifact_atomic(uuid,uuid,uuid,text,jsonb,text,jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_current_avatar(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_current_avatar(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_primary_avatar(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_primary_avatar(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.save_asset_audit_atomic(uuid,uuid,integer,jsonb,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_asset_audit_atomic(uuid,uuid,integer,jsonb,text,jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.match_document_chunks(vector,uuid,integer,double precision,text[],uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_document_chunks(vector,uuid,integer,double precision,text[],uuid,uuid) TO authenticated, service_role;

-- Pre-existing live signatures (security M-4). Guarded so a missing/renamed signature on a
-- drifted environment does not abort the migration. On live this only re-asserts the
-- already-correct PUBLIC-revoked / authenticated+service_role-granted state (no-op).
DO $$
BEGIN
  IF to_regprocedure('public.save_artifact_atomic(uuid,uuid,text,jsonb,text,jsonb)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.save_artifact_atomic(uuid,uuid,text,jsonb,text,jsonb) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.save_artifact_atomic(uuid,uuid,text,jsonb,text,jsonb) TO authenticated, service_role';
  END IF;
  IF to_regprocedure('public.match_document_chunks(vector,uuid,integer,double precision,text[])') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.match_document_chunks(vector,uuid,integer,double precision,text[]) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.match_document_chunks(vector,uuid,integer,double precision,text[]) TO authenticated, service_role';
  END IF;
END $$;

COMMIT;
