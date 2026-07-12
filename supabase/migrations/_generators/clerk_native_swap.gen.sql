-- =====================================================================
-- Clerk native-swap migration GENERATOR  (Layer-3, drift-proof)
-- =====================================================================
-- WHY A GENERATOR AND NOT A STATIC MIGRATION:
--   The re-key surface (RLS policies keyed on auth.uid(), user_id uuid
--   columns, FKs to auth.users) GROWS every time a new user-data table
--   ships. A hand-frozen swap migration goes stale within days (the
--   original 20260624 one missed 17 later migrations / ~15 new tables).
--   This generator reads the LIVE catalog, so it always emits a migration
--   that matches prod exactly at the moment you run it.
--
-- HOW TO USE (at cutover, per docs/integrations/CLERK_CUTOVER_RUNBOOK.md):
--   1. Run each SELECT below against PROD (read-only; emits DDL text only).
--   2. Assemble a new timestamped migration file
--        supabase/migrations/<UTC-ts>_clerk_native_swap.sql
--      by concatenating the emitted sections IN THIS EXACT ORDER:
--        BEGIN;
--        [section 1]      drop FKs to auth.users
--        [section 2·pre]  drop auth.uid() column DEFAULTs
--        [section 2a]     drop dependent views
--        [section 2b]     retype uuid user columns -> text
--        [section 2·post] re-add DEFAULTs as (auth.jwt()->>'sub')
--        [section 2c]     recreate the dropped views (use captured DDL)
--        [section 3]      rebuild auth.uid() policies as jwt-sub
--        COMMIT;
--   3. Append the function/profiles rewrites: run the companion migration
--      20260624000100_clerk_profiles_and_functions.sql AFTER this one (it
--      depends on the columns already being text). RE-ENUMERATE auth.uid()
--      functions at cutover (see that file's STEP 3 query) — the set drifts.
--   4. REVIEW the assembled SQL end-to-end, take a backup, then apply inside
--      the cutover transaction. A down-migration generator is at the bottom.
--
-- The static 20260624000000_clerk_native_swap.sql(+_down) in this dir are the
-- ORIGINAL hand-authored swap from 2026-06-24 and are now STALE (they predate
-- ~25 tables/policies/defaults added since). They are kept for reference only
-- and are marked SUPERSEDED — DO NOT APPLY them; use this generator instead.
--
-- IDENTITY MODEL: Supabase trusts Clerk (third-party auth). RLS reads the
--   Clerk user id from (auth.jwt() ->> 'sub') [text]. auth.uid() [uuid]
--   returns NULL under Clerk, so every auth.uid() reference and every
--   uuid user-column/FK to auth.users must move to text.
--
-- PRECONDITION: verified 2026-07-12 that auth.uid() renders BARE in every
--   stored policy expression (0 wrapped as "SELECT auth.uid()"), so the
--   plain string substitution below is exact. RE-CHECK at cutover:
--     SELECT count(*) FROM pg_policies WHERE schemaname='public'
--       AND (qual ILIKE '%select auth.uid()%'
--         OR coalesce(with_check,'') ILIKE '%select auth.uid()%');
--   If that is > 0, adjust the replace() target before trusting the output.
-- =====================================================================


-- ---------------------------------------------------------------------
-- SECTION 1 of 3 — DROP every FK from public.* to auth.users
-- (must run BEFORE the column retype in section 2; Clerk users have no
--  auth.users row, so these FKs cannot survive.)
-- ---------------------------------------------------------------------
SELECT string_agg(
  format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I;',
         c.conrelid::regclass::text, c.conname),
  E'\n' ORDER BY c.conrelid::regclass::text
) AS section_1_drop_fks
FROM pg_constraint c
WHERE c.contype = 'f'
  AND c.confrelid = 'auth.users'::regclass
  AND connamespace = 'public'::regnamespace;


-- ---------------------------------------------------------------------
-- SECTION 2 of 3 — Retype auth-linked uuid columns to text
-- Targets: (a) the local column of every dropped auth.users FK, and
-- (b) any denormalised uuid user-scoping column (user_id/owner_id/
-- created_by/author_id) even without an FK. profiles.id is included via
-- (a) because profiles_id_fkey references auth.users.
--
-- VIEW SAFETY (two guards, both verified needed on the 2026-07-12 schema):
--   * Section 2 only targets BASE TABLES (c.relkind='r'). A view column
--     (e.g. user_knowledge_current.user_id) must never be ALTERed — it
--     inherits its type from the base table.
--   * A uuid->text ALTER on a base column FAILS if a view depends on that
--     column. Section 2a drops such views first; section 2c recreates them
--     verbatim after the retype. RE-DERIVE the dependent-view list at
--     cutover (a new dependent view invalidates a hard-coded list):
--       SELECT DISTINCT dependent.relname
--       FROM pg_depend d
--       JOIN pg_rewrite r ON r.oid=d.objid
--       JOIN pg_class dependent ON dependent.oid=r.ev_class
--       JOIN pg_class src ON src.oid=d.refobjid
--       JOIN pg_namespace ns ON ns.oid=src.relnamespace AND ns.nspname='public'
--       JOIN pg_attribute a ON a.attrelid=d.refobjid AND a.attnum=d.refobjsubid
--       WHERE dependent.relkind IN ('v','m') AND src.relkind='r'
--         AND a.attname IN ('user_id','id','owner_id','created_by','author_id')
--         AND dependent.relname <> src.relname;
--     As of 2026-07-12 the only hit is public.user_knowledge_current.
-- ---------------------------------------------------------------------

-- SECTION 2·pre — drop auth.uid() column DEFAULTs before the retype.
-- A uuid-typed DEFAULT of auth.uid() blocks the uuid->text ALTER (type
-- mismatch) AND, left as-is under Clerk, inserts NULL owner on every row
-- (auth.uid() is NULL under Clerk) — a silent ownership break. Drop here,
-- re-add as the text jwt-sub in SECTION 2·post. Verified 7 such columns on
-- 2026-07-12 (ad_search_terms, campaign_metrics, campaigns, coach_assets,
-- coach_asset_events, email_sequences, email_steps); RE-DERIVE at cutover.
SELECT string_agg(
  format('ALTER TABLE public.%I ALTER COLUMN %I DROP DEFAULT;', c.relname, a.attname),
  E'\n' ORDER BY c.relname, a.attname
) AS section_2pre_drop_uid_defaults
FROM pg_attrdef ad
JOIN pg_class c ON c.oid = ad.adrelid
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
JOIN pg_attribute a ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
WHERE pg_get_expr(ad.adbin, ad.adrelid) ILIKE '%auth.uid()%';

-- SECTION 2·post — re-add those DEFAULTs as the Clerk sub (text), AFTER
-- the columns are retyped to text in 2b. Emit AFTER section 2b in the file.
SELECT string_agg(
  format('ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT (auth.jwt() ->> ''sub''::text);',
         c.relname, a.attname),
  E'\n' ORDER BY c.relname, a.attname
) AS section_2post_readd_defaults_as_sub
FROM pg_attrdef ad
JOIN pg_class c ON c.oid = ad.adrelid
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
JOIN pg_attribute a ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
WHERE pg_get_expr(ad.adbin, ad.adrelid) ILIKE '%auth.uid()%';

-- SECTION 2a — drop dependent views before the retype (recreate in 2c).
-- Emit CREATE statements to capture BEFORE dropping so 2c is exact:
SELECT format('-- capture for 2c recreate:%s%s',
              E'\n',
              'CREATE OR REPLACE VIEW public.user_knowledge_current AS '
              || pg_get_viewdef('public.user_knowledge_current'::regclass, true)
       ) AS section_2c_recreate_view_captured,
       E'DROP VIEW IF EXISTS public.user_knowledge_current;' AS section_2a_drop_view;

-- SECTION 2b — retype base-table columns to text (VIEWS EXCLUDED):
WITH targets AS (
  -- (a) local columns of FKs to auth.users
  SELECT (c.conrelid::regclass)::text AS tbl,
         a.attname                    AS col
  FROM pg_constraint c
  JOIN unnest(c.conkey) WITH ORDINALITY k(attnum, ord) ON TRUE
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
  WHERE c.contype = 'f'
    AND c.confrelid = 'auth.users'::regclass
    AND c.connamespace = 'public'::regnamespace
  UNION
  -- (b) denormalised uuid user columns without an FK — BASE TABLES ONLY
  SELECT format('%I', col.table_name), col.column_name
  FROM information_schema.columns col
  JOIN pg_class pc ON pc.relname = col.table_name
  JOIN pg_namespace pn ON pn.oid = pc.relnamespace AND pn.nspname = 'public'
  WHERE col.table_schema = 'public'
    AND col.data_type = 'uuid'
    AND col.column_name IN ('user_id','owner_id','created_by','author_id')
    AND pc.relkind = 'r'   -- exclude views/matviews
)
SELECT string_agg(
  format('ALTER TABLE public.%s ALTER COLUMN %I TYPE text USING %I::text;',
         tbl, col, col),
  E'\n' ORDER BY tbl, col
) AS section_2b_retype_columns
FROM (SELECT DISTINCT tbl, col FROM targets) t;

-- SECTION 2c — recreate the views dropped in 2a (use the captured DDL above).


-- ---------------------------------------------------------------------
-- SECTION 3 of 3 — Recreate every auth.uid() policy against the Clerk sub
-- Rewrites auth.uid()  ->  (auth.jwt() ->> 'sub'::text)  [text].
-- Only policies that reference auth.uid() are touched; service-role /
-- public-read / email-based policies are left exactly as-is.
-- ---------------------------------------------------------------------
SELECT string_agg(
  format(
    E'DROP POLICY IF EXISTS %I ON public.%I;\nCREATE POLICY %I ON public.%I AS %s FOR %s TO %s%s%s;',
    policyname, tablename, policyname, tablename,
    permissive, cmd, array_to_string(roles, ', '),
    CASE WHEN qual IS NOT NULL
      THEN E'\n  USING (' || replace(qual, 'auth.uid()', '(auth.jwt() ->> ''sub''::text)') || ')'
      ELSE '' END,
    CASE WHEN with_check IS NOT NULL
      THEN E'\n  WITH CHECK (' || replace(with_check, 'auth.uid()', '(auth.jwt() ->> ''sub''::text)') || ')'
      ELSE '' END
  ),
  E'\n\n' ORDER BY tablename, policyname
) AS section_3_rewrite_policies
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual ILIKE '%auth.uid()%' OR coalesce(with_check, '') ILIKE '%auth.uid()%');


-- =====================================================================
-- DOWN-MIGRATION GENERATOR (roll back the swap)
-- Run these two sections to emit the reverse migration. Restores uuid
-- columns and auth.uid() policies. NOTE: re-adding the auth.users FKs is
-- intentionally NOT generated — after the swap, rows may be keyed to
-- Clerk ids with no matching auth.users row, so the FK would fail to
-- validate. Re-add FKs by hand only after confirming every user_id has a
-- matching auth.users.id (i.e. only on a full revert with no Clerk data).
-- =====================================================================

-- DOWN 1 — retype columns back to uuid (reverse of section 2)
WITH targets AS (
  SELECT format('%I', table_name) AS tbl, column_name AS col
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND data_type = 'text'
    AND column_name IN ('user_id','owner_id','created_by','author_id')
  UNION
  SELECT 'profiles', 'id'
)
SELECT string_agg(
  format('ALTER TABLE public.%s ALTER COLUMN %I TYPE uuid USING %I::uuid;',
         tbl, col, col),
  E'\n' ORDER BY tbl, col
) AS down_1_retype_columns
FROM (SELECT DISTINCT tbl, col FROM targets) t;

-- DOWN 2 — rewrite policies back to auth.uid() (reverse of section 3)
-- Run this BEFORE down_1 has been applied on a fresh clone, or capture
-- the pre-swap policy DDL from this generator's section 3 output run
-- against a pre-swap snapshot. Simplest reliable rollback: keep the
-- section-3 pre-swap emission from cutover and replay it. (Symmetric
-- reverse-substitution is fragile if any policy legitimately contains
-- the literal jwt expression, so prefer the captured pre-swap DDL.)
