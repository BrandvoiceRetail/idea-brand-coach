-- ============================================================================
-- SECURITY HARDENING (follow-up to MF-1/MF-2; closes two linter findings tied
-- to those changes):
--
-- 1. Pin search_path on the new lock-trigger function (SECURITY-DEFINER-adjacent
--    hardening; the four RPCs already set it).
-- 2. Revoke EXECUTE on the four user-scoped SECURITY DEFINER RPCs from PUBLIC.
--    Postgres grants EXECUTE to PUBLIC by default, so `anon` could still INVOKE
--    them (the MF-1 guard denies the data — auth.uid() is NULL for anon — but
--    defence-in-depth says anon should not reach the function at all). The
--    explicit GRANT ... TO authenticated remains, so legitimate signed-in callers
--    are unaffected.
-- ============================================================================

-- 1. search_path on the lock trigger function
CREATE OR REPLACE FUNCTION public.enforce_avatar_field_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.is_locked = true
     AND NEW.field_source IS DISTINCT FROM 'manual'
     AND NEW.field_value IS DISTINCT FROM OLD.field_value
  THEN
    NEW.field_value := OLD.field_value;
    NEW.is_locked := true;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Drop EXECUTE for anon/PUBLIC (anon can no longer invoke these). Note: Supabase
--    grants EXECUTE on public functions to `anon` DIRECTLY via default privileges, so
--    revoking from PUBLIC alone is insufficient — revoke from anon explicitly too.
REVOKE EXECUTE ON FUNCTION public.match_document_chunks  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.match_user_documents   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.match_user_knowledge   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_knowledge_entry FROM PUBLIC, anon;

-- Re-affirm the intended grant (authenticated only).
GRANT EXECUTE ON FUNCTION public.match_document_chunks  TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_user_documents   TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_user_knowledge   TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_knowledge_entry TO authenticated;
