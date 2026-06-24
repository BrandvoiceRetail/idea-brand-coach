-- Atomic artifact save — fixes R1 (same-avatar REGENERATION blocked).
--
-- DEFECT (E2E_GAP_REPORT §4 R1): the previous client-side saveArtifact was
-- insert-THEN-supersede. On a repeat save for an existing (user, avatar, kind) the
-- new INSERT transiently created a SECOND `superseded_by IS NULL` row, which the
-- partial unique index `uq_artifacts_current_per_kind` (checked immediately, not
-- deferrable) rejected with a duplicate-key error. Every artifact-writing tool then
-- failed to regenerate, and `export_workbook` silently re-rendered the stale chain.
--
-- FIX: do the whole supersede→insert→repoint sequence inside ONE transaction (a
-- Postgres function = implicit single transaction), in an ordering that never has two
-- current rows simultaneously:
--   1. SELF-supersede the current row(s): `superseded_by = id`. Setting it to the
--      row's OWN id satisfies the self-FK (artifacts.superseded_by → artifacts.id;
--      the id already exists) AND exits the partial-index predicate
--      (`superseded_by IS NULL` becomes false), freeing the unique slot.
--   2. INSERT the new row (now the only `superseded_by IS NULL` row for the key).
--   3. REPOINT the just-self-superseded rows at the new id, so history walks forward
--      to the new current row and no row stays pointing at itself.
-- If any step raises, the function's transaction rolls back as a unit — the chain is
-- never left with zero current rows.
--
-- SECURITY: SECURITY INVOKER (the default) — it runs as the JWT-bound caller, so the
-- table's existing owner-only RLS policies (SELECT/INSERT/UPDATE gated on
-- `auth.uid() = user_id`) protect every row touched. No service-role, no privilege
-- escalation (guardrail #5). `p_user_id` is asserted to equal `auth.uid()` up front,
-- mirroring the WITH CHECK on the INSERT policy and the explicit guard used by the
-- project's other user-scoped RPCs (e.g. match_document_chunks). search_path is locked.
--
-- ADDITIVE ONLY: a new function over OUR `artifacts` table (created this build). No
-- ALTER/DROP of existing objects; the public artifactStore API is unchanged.

CREATE OR REPLACE FUNCTION public.save_artifact_atomic(
    p_user_id       UUID,
    p_avatar_id     UUID,
    p_kind          TEXT,
    p_content       JSONB,
    p_grounding     TEXT,
    p_evidence_refs JSONB
)
RETURNS public.artifacts
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
    v_new public.artifacts;
BEGIN
    -- Defense in depth on top of RLS: the caller may only write their own rows.
    IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
        RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
    END IF;

    -- 1. Self-supersede current row(s): frees the partial-unique slot, FK-safe.
    UPDATE public.artifacts
       SET superseded_by = id
     WHERE user_id = p_user_id
       AND kind = p_kind
       AND COALESCE(avatar_id, '00000000-0000-0000-0000-000000000000'::uuid)
           = COALESCE(p_avatar_id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND superseded_by IS NULL;

    -- 2. Insert the new current row.
    INSERT INTO public.artifacts (user_id, avatar_id, kind, content, grounding, evidence_refs)
    VALUES (p_user_id, p_avatar_id, p_kind, p_content, p_grounding, p_evidence_refs)
    RETURNING * INTO v_new;

    -- 3. Repoint the rows we self-superseded in step 1 at the new current row.
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

-- Supabase auto-grants EXECUTE to anon/authenticated on new public functions; revoke
-- the unauthenticated roles so only the JWT-bound `authenticated` client can call it.
-- (The in-function auth.uid() guard is the real gate; this is defense in depth.)
REVOKE ALL ON FUNCTION public.save_artifact_atomic(UUID, UUID, TEXT, JSONB, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_artifact_atomic(UUID, UUID, TEXT, JSONB, TEXT, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_artifact_atomic(UUID, UUID, TEXT, JSONB, TEXT, JSONB) TO authenticated;
