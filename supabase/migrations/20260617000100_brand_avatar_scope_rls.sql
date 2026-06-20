-- =============================================================================
-- Multi-Avatar Phase 1 — FILE 2/4: RLS
-- =============================================================================
-- APPLY IN THE SAME WINDOW AS FILE 1 (...000000_schema.sql), immediately after it.
-- FILE 1 dropped brand_assets.avatar_id NOT NULL; until the brand_assets policy swap
-- below lands, avatar_id-NULL inventory rows are unreadable/uninsertable. The smoke
-- insert at the end of this file ASSERTS the window landed correctly (now INSERT -> SELECT
-- -> DELETE, so it also proves the row is readable, not just insertable — security C-1).
--
-- LIVE FACTS baked in:
--   * brand_assets has NO user_id; all 4 live policies are EXISTS(avatars ... user_id=auth.uid()).
--     New policies root ownership through brand_id -> brands.user_id (and keep the
--     avatar path for avatar-bound rows). 0 rows live.
--   * avatar_field_values has exactly ONE `ALL` policy (avatars-join, role public) and
--     NO user_id column. The design's "reconcile two contested policies / root on
--     auth.uid()=user_id" is STALE: there is no conflict and no user_id. We only
--     CONFIRM/normalize the single avatars-join policy. (No-op-equivalent.)
--   * diagnostic_submissions + user_diagnostic_results are SELECT+INSERT only -> add
--     UPDATE + DELETE so overlays can be re-run/replaced.
--   * performance_metrics DOES NOT EXIST live -> guarded no-op.
--   * profiles has no DELETE policy; current_avatar_id value-ownership is enforced by
--     the set_current_avatar RPC (FILE 3), NOT by RLS. profiles RLS left unchanged.
--
-- REVIEW FIXES applied in this file:
--   * security H-3: every policy here is `TO authenticated` (was `TO public`). anon is
--     never a member of authenticated, removing the latent surface.
--   * security H-4: brand_assets + brand_asset_audits INSERT/UPDATE require an avatar to
--     belong to the SAME brand (no cross-brand avatar/asset pairing).
--   * security M-5: brands UPDATE WITH CHECK validates primary_avatar_id ownership.
--   * security M-2: avatar_build_state SELECT cross-checks avatar ownership (belt+suspenders).
--   * security L-3: diagnostic UPDATE WITH CHECK validates brand_id/avatar_id ownership.
--   * security L-4: brand_asset_audits UPDATE WITH CHECK re-verifies avatar+brand ownership.
--   * security C-1 / L-2: smoke block INSERT->SELECT->DELETE, plus an authenticated-role
--     RLS probe that proves the owner can actually SELECT a brand-keyed inventory row.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. brand_assets — relax avatar-rooted policies to brand-OR-avatar ownership
-- -----------------------------------------------------------------------------
-- Ownership for an inventory row (avatar_id NULL) routes via brand_id -> brands.user_id.
-- Ownership for any avatar-bound row also accepted via the avatar path (back-compat),
-- BUT when both keys are present the avatar must belong to the same brand (security H-4).
ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view own brand_assets"   ON public.brand_assets;
DROP POLICY IF EXISTS "insert own brand_assets" ON public.brand_assets;
DROP POLICY IF EXISTS "update own brand_assets" ON public.brand_assets;
DROP POLICY IF EXISTS "delete own brand_assets" ON public.brand_assets;

-- SELECT/DELETE: brand-OR-avatar ownership (read/remove is non-mutating, so the
-- same-brand coupling is enforced only on write where the row shape is being set).
CREATE POLICY "view own brand_assets" ON public.brand_assets
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.brands  b WHERE b.id = brand_assets.brand_id  AND b.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.avatars a WHERE a.id = brand_assets.avatar_id AND a.user_id = auth.uid())
  );

-- INSERT/UPDATE: require the brand to be owned, and IF an avatar is set it must belong to
-- the same owned brand. This closes the cross-brand pairing hole (H-4). The brand arm is
-- mandatory because the §7b sync trigger always populates brand_id from a set avatar, so a
-- legitimate avatar-bound insert will have brand_id stamped before the WITH CHECK is evaluated.
CREATE POLICY "insert own brand_assets" ON public.brand_assets
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.brands b WHERE b.id = brand_assets.brand_id AND b.user_id = auth.uid())
    AND (
      brand_assets.avatar_id IS NULL
      OR EXISTS (SELECT 1 FROM public.avatars a
                 WHERE a.id = brand_assets.avatar_id
                   AND a.user_id = auth.uid()
                   AND a.brand_id = brand_assets.brand_id)
    )
  );

CREATE POLICY "update own brand_assets" ON public.brand_assets
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.brands  b WHERE b.id = brand_assets.brand_id  AND b.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.avatars a WHERE a.id = brand_assets.avatar_id AND a.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.brands b WHERE b.id = brand_assets.brand_id AND b.user_id = auth.uid())
    AND (
      brand_assets.avatar_id IS NULL
      OR EXISTS (SELECT 1 FROM public.avatars a
                 WHERE a.id = brand_assets.avatar_id
                   AND a.user_id = auth.uid()
                   AND a.brand_id = brand_assets.brand_id)
    )
  );

CREATE POLICY "delete own brand_assets" ON public.brand_assets
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.brands  b WHERE b.id = brand_assets.brand_id  AND b.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.avatars a WHERE a.id = brand_assets.avatar_id AND a.user_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 2. KB tables — keep auth.uid()=user_id SELECT/DELETE; TIGHTEN INSERT/UPDATE WITH CHECK
-- -----------------------------------------------------------------------------
-- Ensure brand_id / avatar_id written on a row actually belong to the caller.
-- SELECT/DELETE remain user-rooted (unchanged semantics; recreated for idempotency).
-- security H-3: scoped TO authenticated (was TO public).
ALTER TABLE public.user_knowledge_base ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own knowledge"   ON public.user_knowledge_base;
DROP POLICY IF EXISTS "Users can delete own knowledge" ON public.user_knowledge_base;
DROP POLICY IF EXISTS "Users can insert own knowledge" ON public.user_knowledge_base;
DROP POLICY IF EXISTS "Users can update own knowledge" ON public.user_knowledge_base;

CREATE POLICY "Users can view own knowledge" ON public.user_knowledge_base
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own knowledge" ON public.user_knowledge_base
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own knowledge" ON public.user_knowledge_base
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (brand_id  IS NULL OR EXISTS (SELECT 1 FROM public.brands  b WHERE b.id = brand_id  AND b.user_id = auth.uid()))
    AND (avatar_id IS NULL OR EXISTS (SELECT 1 FROM public.avatars a WHERE a.id = avatar_id AND a.user_id = auth.uid()))
  );
CREATE POLICY "Users can update own knowledge" ON public.user_knowledge_base
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (brand_id  IS NULL OR EXISTS (SELECT 1 FROM public.brands  b WHERE b.id = brand_id  AND b.user_id = auth.uid()))
    AND (avatar_id IS NULL OR EXISTS (SELECT 1 FROM public.avatars a WHERE a.id = avatar_id AND a.user_id = auth.uid()))
  );

ALTER TABLE public.user_knowledge_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own knowledge chunks"   ON public.user_knowledge_chunks;
DROP POLICY IF EXISTS "Users can delete their own knowledge chunks" ON public.user_knowledge_chunks;
DROP POLICY IF EXISTS "Users can insert their own knowledge chunks" ON public.user_knowledge_chunks;
DROP POLICY IF EXISTS "Users can update their own knowledge chunks" ON public.user_knowledge_chunks;

CREATE POLICY "Users can view their own knowledge chunks" ON public.user_knowledge_chunks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own knowledge chunks" ON public.user_knowledge_chunks
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own knowledge chunks" ON public.user_knowledge_chunks
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (brand_id  IS NULL OR EXISTS (SELECT 1 FROM public.brands  b WHERE b.id = brand_id  AND b.user_id = auth.uid()))
    AND (avatar_id IS NULL OR EXISTS (SELECT 1 FROM public.avatars a WHERE a.id = avatar_id AND a.user_id = auth.uid()))
  );
CREATE POLICY "Users can update their own knowledge chunks" ON public.user_knowledge_chunks
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (brand_id  IS NULL OR EXISTS (SELECT 1 FROM public.brands  b WHERE b.id = brand_id  AND b.user_id = auth.uid()))
    AND (avatar_id IS NULL OR EXISTS (SELECT 1 FROM public.avatars a WHERE a.id = avatar_id AND a.user_id = auth.uid()))
  );

-- -----------------------------------------------------------------------------
-- 3. avatars — tighten UPDATE WITH CHECK (live UPDATE has qual only, no with_check),
--    and constrain brand_id to a brand the caller owns. security H-3: TO authenticated.
-- -----------------------------------------------------------------------------
ALTER TABLE public.avatars ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert their own avatars" ON public.avatars;
DROP POLICY IF EXISTS "Users can update their own avatars" ON public.avatars;
CREATE POLICY "Users can insert their own avatars" ON public.avatars
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (brand_id IS NULL OR EXISTS (SELECT 1 FROM public.brands b WHERE b.id = brand_id AND b.user_id = auth.uid()))
  );
CREATE POLICY "Users can update their own avatars" ON public.avatars
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (brand_id IS NULL OR EXISTS (SELECT 1 FROM public.brands b WHERE b.id = brand_id AND b.user_id = auth.uid()))
  );

-- -----------------------------------------------------------------------------
-- 3b. brands — add WITH CHECK that primary_avatar_id is an owned avatar (security M-5)
-- -----------------------------------------------------------------------------
-- Live brands UPDATE policy is qual-only (auth.uid()=user_id) with no with_check, so a
-- direct `UPDATE brands SET primary_avatar_id = <foreign avatar>` is currently accepted by
-- RLS (the FK only checks existence, not ownership). Recreate INSERT/UPDATE with ownership
-- validation on primary_avatar_id. SELECT/DELETE left as live (recreated for idempotency).
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert their own brands" ON public.brands;
DROP POLICY IF EXISTS "Users can update their own brands" ON public.brands;
CREATE POLICY "Users can insert their own brands" ON public.brands
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (primary_avatar_id IS NULL OR EXISTS (
      SELECT 1 FROM public.avatars a WHERE a.id = primary_avatar_id AND a.user_id = auth.uid()))
  );
CREATE POLICY "Users can update their own brands" ON public.brands
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (primary_avatar_id IS NULL OR EXISTS (
      SELECT 1 FROM public.avatars a WHERE a.id = primary_avatar_id AND a.user_id = auth.uid()))
  );

-- -----------------------------------------------------------------------------
-- 4. diagnostic tables — ADD UPDATE + DELETE (live = SELECT+INSERT only)
-- -----------------------------------------------------------------------------
-- security L-3: UPDATE WITH CHECK validates brand_id/avatar_id ownership so a user cannot
-- repoint their own diagnostic row to a foreign user's brand/avatar. security H-3: authenticated.
ALTER TABLE public.diagnostic_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can update their own diagnostic submissions" ON public.diagnostic_submissions;
DROP POLICY IF EXISTS "Users can delete their own diagnostic submissions" ON public.diagnostic_submissions;
CREATE POLICY "Users can update their own diagnostic submissions" ON public.diagnostic_submissions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (brand_id  IS NULL OR EXISTS (SELECT 1 FROM public.brands  b WHERE b.id = brand_id  AND b.user_id = auth.uid()))
    AND (avatar_id IS NULL OR EXISTS (SELECT 1 FROM public.avatars a WHERE a.id = avatar_id AND a.user_id = auth.uid()))
  );
CREATE POLICY "Users can delete their own diagnostic submissions" ON public.diagnostic_submissions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.user_diagnostic_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can update their own diagnostic results" ON public.user_diagnostic_results;
DROP POLICY IF EXISTS "Users can delete their own diagnostic results" ON public.user_diagnostic_results;
CREATE POLICY "Users can update their own diagnostic results" ON public.user_diagnostic_results
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (brand_id  IS NULL OR EXISTS (SELECT 1 FROM public.brands  b WHERE b.id = brand_id  AND b.user_id = auth.uid()))
    AND (avatar_id IS NULL OR EXISTS (SELECT 1 FROM public.avatars a WHERE a.id = avatar_id AND a.user_id = auth.uid()))
  );
CREATE POLICY "Users can delete their own diagnostic results" ON public.user_diagnostic_results
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 5. avatar_field_values — CONFIRM the single avatars-join policy (no conflict live)
-- -----------------------------------------------------------------------------
-- Table has NO user_id; ownership is correctly rooted through the avatars join.
-- Recreated idempotently to normalize the name; this is semantically a no-op vs live
-- EXCEPT the role tightening to authenticated (security H-3: was TO public). The
-- avatars-join already nulls out anon, so this only removes the latent public surface.
ALTER TABLE public.avatar_field_values ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own avatar fields" ON public.avatar_field_values;
CREATE POLICY "Users can manage their own avatar fields" ON public.avatar_field_values
  FOR ALL TO authenticated
  USING      (avatar_id IN (SELECT id FROM public.avatars WHERE user_id = auth.uid()))
  WITH CHECK (avatar_id IN (SELECT id FROM public.avatars WHERE user_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- 6. NEW tables — brand_asset_audits + avatar_build_state (auth.uid()=user_id)
-- -----------------------------------------------------------------------------
ALTER TABLE public.brand_asset_audits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own asset audits"   ON public.brand_asset_audits;
DROP POLICY IF EXISTS "Users can insert their own asset audits" ON public.brand_asset_audits;
DROP POLICY IF EXISTS "Users can update their own asset audits" ON public.brand_asset_audits;
DROP POLICY IF EXISTS "Users can delete their own asset audits" ON public.brand_asset_audits;
CREATE POLICY "Users can view their own asset audits" ON public.brand_asset_audits
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own asset audits" ON public.brand_asset_audits
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.avatars a WHERE a.id = avatar_id AND a.user_id = auth.uid() AND a.brand_id = brand_id)
    AND EXISTS (SELECT 1 FROM public.brands  b WHERE b.id = brand_id  AND b.user_id = auth.uid())
  );
-- security L-4: UPDATE re-verifies avatar+brand ownership AND same-brand coupling, so a
-- direct UPDATE cannot rewrite the row into a cross-brand pairing that bypasses the RPC.
CREATE POLICY "Users can update their own asset audits" ON public.brand_asset_audits
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.avatars a WHERE a.id = avatar_id AND a.user_id = auth.uid() AND a.brand_id = brand_id)
    AND EXISTS (SELECT 1 FROM public.brands  b WHERE b.id = brand_id  AND b.user_id = auth.uid())
  );
CREATE POLICY "Users can delete their own asset audits" ON public.brand_asset_audits
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.avatar_build_state ENABLE ROW LEVEL SECURITY;
-- DELETE intentionally cascade-only (FK ON DELETE CASCADE from avatars); no user DELETE
-- policy by design — build state is owned by the avatar lifecycle, not deleted directly.
DROP POLICY IF EXISTS "Users can view their own build state"   ON public.avatar_build_state;
DROP POLICY IF EXISTS "Users can insert their own build state" ON public.avatar_build_state;
DROP POLICY IF EXISTS "Users can update their own build state" ON public.avatar_build_state;
-- security M-2: SELECT cross-checks avatar ownership in addition to user_id (belt+suspenders
-- against a mis-stamped user_id revealing another user's build state).
CREATE POLICY "Users can view their own build state" ON public.avatar_build_state
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.avatars a WHERE a.id = avatar_id AND a.user_id = auth.uid())
  );
CREATE POLICY "Users can insert their own build state" ON public.avatar_build_state
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.avatars a WHERE a.id = avatar_id AND a.user_id = auth.uid())
  );
CREATE POLICY "Users can update their own build state" ON public.avatar_build_state
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.avatars a WHERE a.id = avatar_id AND a.user_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 7. performance_metrics — guarded no-op (table absent on live)
-- -----------------------------------------------------------------------------
-- Repo migration 20260301065636 never applied to live. If a drifted environment HAS
-- this table with a brand_id-join policy that locks owners out on NULL brand_id, add an
-- avatars-user fallback. On live this block never fires.
DO $$
BEGIN
  IF to_regclass('public.performance_metrics') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY';
    -- Intentionally minimal: do not assume column shape on a table we cannot see live.
    -- Operator should reconcile its policies manually if/when it appears.
    RAISE NOTICE 'performance_metrics present on this environment (drift) — reconcile its RLS manually.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 8. SMOKE-INSERT ASSERTION — proves the brand_assets relax+swap window is correct
-- -----------------------------------------------------------------------------
-- security C-1: order is now INSERT -> SELECT (assert visible) -> DELETE, so it proves the
-- relaxed schema AND that the row is not stranded. Runs as the migration role (bypasses
-- RLS), so this validates SCHEMA. The §8b block additionally exercises the AUTHENTICATED
-- policy path (security L-2) to prove the owner can actually SELECT the row through RLS.
DO $$
DECLARE
  v_brand uuid;
  v_id    uuid;
  v_seen  uuid;
BEGIN
  SELECT id INTO v_brand FROM public.brands ORDER BY created_at LIMIT 1;
  IF v_brand IS NULL THEN
    RAISE NOTICE 'No brands yet (pre-backfill) — skipping brand_assets smoke insert.';
    RETURN;
  END IF;
  INSERT INTO public.brand_assets (brand_id, avatar_id, touchpoint_id, stage, context_description, status)
  VALUES (v_brand, NULL, '__smoke__', 'awareness', 'migration smoke insert', 'pending')
  RETURNING id INTO v_id;
  SELECT id INTO v_seen FROM public.brand_assets WHERE id = v_id;
  IF v_seen IS NULL THEN
    RAISE EXCEPTION 'brand_assets smoke insert not visible after relax — window incoherent';
  END IF;
  DELETE FROM public.brand_assets WHERE id = v_id;
  RAISE NOTICE 'brand_assets inventory smoke insert + SELECT (avatar_id NULL) OK.';
END $$;

-- 8b. AUTHENTICATED-ROLE RLS PROBE (security L-2) — proves the owner's policy actually
--     returns a brand-keyed inventory row. Impersonates the owning user via request.jwt.claims,
--     SETs role authenticated, inserts -> selects -> deletes, then RESETs. All inside a
--     sub-block so any failure aborts the migration (the one-window canary for policy, not
--     just schema). Skipped pre-backfill when no brand exists.
DO $$
DECLARE
  v_brand uuid;
  v_uid   uuid;
  v_id    uuid;
  v_cnt   int;
BEGIN
  SELECT b.id, b.user_id INTO v_brand, v_uid
  FROM public.brands b ORDER BY b.created_at LIMIT 1;
  IF v_brand IS NULL OR v_uid IS NULL THEN
    RAISE NOTICE 'No brand/owner yet — skipping authenticated-role RLS probe.';
    RETURN;
  END IF;

  -- Seed a row as the migration role (RLS-exempt) so the probe is read-only under RLS.
  INSERT INTO public.brand_assets (brand_id, avatar_id, touchpoint_id, stage, context_description, status)
  VALUES (v_brand, NULL, '__smoke_rls__', 'awareness', 'rls probe', 'pending')
  RETURNING id INTO v_id;

  -- Impersonate the owner.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO v_cnt FROM public.brand_assets WHERE id = v_id;

  -- Restore migration role before asserting / cleaning up.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);

  IF v_cnt <> 1 THEN
    DELETE FROM public.brand_assets WHERE id = v_id;
    RAISE EXCEPTION 'authenticated-role RLS probe failed: owner saw % rows (expected 1) — view policy broken', v_cnt;
  END IF;

  DELETE FROM public.brand_assets WHERE id = v_id;
  RAISE NOTICE 'authenticated-role RLS probe OK (owner can SELECT brand-keyed inventory row).';
EXCEPTION WHEN OTHERS THEN
  -- Ensure role/claims are always restored even on unexpected error, then re-raise.
  BEGIN RESET ROLE; EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM set_config('request.jwt.claims', NULL, true);
  RAISE;
END $$;

COMMIT;
