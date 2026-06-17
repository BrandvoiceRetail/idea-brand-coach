-- =============================================================================
-- Multi-Avatar Phase 1 — FILE 1/4: SCHEMA (brand spine + two-tier scoping columns)
-- =============================================================================
-- Authored against LIVE Supabase ground-truth (re-grounded on origin/main, NOT the
-- stale feat/alpha-instrumentation narrative the design was drafted on).
--
-- Idempotent: every statement is IF NOT EXISTS / DROP-then-recreate / guarded DO block.
-- Safe to re-run; a second run produces zero deltas.
--
-- LIVE FACTS baked in (verified via information_schema / pg_index / pg_proc):
--   * avatars: NO brand_id, NO is_primary. UNIQUE idx avatars_user_id_name_key ALREADY LIVE.
--   * brands: NO primary_avatar_id. max 1 brand/user (dedup is a no-op but kept).
--   * profiles: NO current_avatar_id. PK = id (auth uid).
--   * chat_sessions.avatar_id ALREADY PRESENT (nullable) -> ADD is a no-op.
--   * uploaded_documents.avatar_id ALREADY PRESENT (nullable) -> ADD is a no-op.
--   * brand_assets: avatar_id NOT NULL, NO brand_id, NO user_id. 0 rows.
--   * evidence_snapshots has NO updated_at column (created_at only) -> its sync trigger
--     is BEFORE INSERT only.
--   * performance_metrics DOES NOT EXIST live (repo drift) -> nothing to touch here.
--   * artifacts supersede key = (user_id, COALESCE(avatar_id, zero-uuid), kind) WHERE superseded_by IS NULL.
--   * LIVE ORPHANS (re-confirmed by data-integrity review): 5 CURRENT artifacts, 1 signature,
--     3 evidence_snapshots carry an avatar_id pointing at a DELETED avatar (orphan FK, since
--     avatar_id FKs were ON DELETE SET NULL / absent). The sync trigger and backfill MUST NOT
--     null-clobber these; see §9 (FOUND-guarded, non-destructive trigger) + §0 (orphan pre-clean).
--
-- The RLS swap that brand_assets' DROP NOT NULL depends on lives in FILE 2 and MUST be
-- applied in the SAME window as this file (relax-then-swap-then-smoke-insert). Do not
-- apply this file to production without immediately applying ...000100_rls.sql after it.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. ORPHAN PRE-CLEAN (data-integrity review C-1 / M-3) — run BEFORE the trigger exists
-- -----------------------------------------------------------------------------
-- Live has rows whose avatar_id references a deleted avatar. With the non-destructive
-- trigger in §9 these would simply keep brand_id from the backfill, but a dangling
-- avatar_id is still a latent FK-less pointer. NULL them so the backfill resolves brand
-- via the user's brand (FILE 4 LEFT JOIN miss -> COALESCE to user brand) cleanly and the
-- avatar_id no longer lies. Guarded: only touches rows whose avatar_id has no live avatar.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['artifacts','signatures','evidence_snapshots','decision_triggers','chat_sessions','uploaded_documents'] LOOP
    EXECUTE format(
      'UPDATE public.%I x SET avatar_id = NULL
         WHERE x.avatar_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM public.avatars a WHERE a.id = x.avatar_id)', t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 1. BRAND SPINE — one brand per user (funnel + brand assets are brand-level)
-- -----------------------------------------------------------------------------
-- Pre-consolidate duplicate brands BEFORE the unique index. Live = 1 brand/user,
-- so this is a no-op today, but it keeps the unique index creation safe on re-run
-- or on any environment that drifted to multi-brand.
DELETE FROM public.brands b
USING public.brands keep
WHERE b.user_id = keep.user_id
  AND b.id > keep.id;   -- keep MIN(id) per user

CREATE UNIQUE INDEX IF NOT EXISTS uq_brands_user_id
  ON public.brands(user_id);

-- Funnel default avatar (locked #7). NOT the coach pointer. ON DELETE SET NULL so a
-- deleted avatar simply unpins the funnel default.
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS primary_avatar_id uuid;
ALTER TABLE public.brands
  DROP CONSTRAINT IF EXISTS brands_primary_avatar_id_fkey;
ALTER TABLE public.brands
  ADD CONSTRAINT brands_primary_avatar_id_fkey
  FOREIGN KEY (primary_avatar_id) REFERENCES public.avatars(id) ON DELETE SET NULL;
-- NOTE (security M-5): this FK enforces EXISTENCE only, not OWNERSHIP. The
-- ownership cross-check (primary_avatar_id must belong to the same user) is enforced
-- in FILE 2 via the brands UPDATE/INSERT WITH CHECK and in FILE 3 via set_primary_avatar.

-- -----------------------------------------------------------------------------
-- 2. COACH CURRENT-AVATAR — UI default mirror (the chat thread is authoritative)
-- -----------------------------------------------------------------------------
-- ON DELETE SET NULL: deleting the current avatar nulls the pointer (no dangling).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_avatar_id uuid;
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_current_avatar_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_current_avatar_id_fkey
  FOREIGN KEY (current_avatar_id) REFERENCES public.avatars(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_current_avatar
  ON public.profiles(current_avatar_id);

-- -----------------------------------------------------------------------------
-- 3. avatars.brand_id + is_primary
-- -----------------------------------------------------------------------------
-- Reconcile the FK regardless of whether brand_id pre-exists (drift-proof: the repo
-- migration 20260301065445 adds it ON DELETE SET NULL on some branches; live has none).
-- We intend ON DELETE CASCADE: deleting the brand removes its avatars.
-- NOT NULL is asserted-then-tightened in the backfill file (FILE 4), not here.
ALTER TABLE public.avatars
  ADD COLUMN IF NOT EXISTS brand_id uuid;
ALTER TABLE public.avatars
  DROP CONSTRAINT IF EXISTS avatars_brand_id_fkey;
ALTER TABLE public.avatars
  ADD CONSTRAINT avatars_brand_id_fkey
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_avatars_brand_id
  ON public.avatars(brand_id);

ALTER TABLE public.avatars
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;
-- At most one primary avatar per brand.
CREATE UNIQUE INDEX IF NOT EXISTS uq_avatars_one_primary_per_brand
  ON public.avatars(brand_id) WHERE is_primary;

-- NOTE (moot per live): avatars_user_id_name_key UNIQUE(user_id, name) is ALREADY LIVE.
-- Intentionally NOT recreated here.

-- -----------------------------------------------------------------------------
-- 4. KB TWO-TIER (the cross-avatar bleed fix) — scope column is authoritative
-- -----------------------------------------------------------------------------
ALTER TABLE public.user_knowledge_base
  ADD COLUMN IF NOT EXISTS brand_id  uuid,
  ADD COLUMN IF NOT EXISTS avatar_id uuid,
  ADD COLUMN IF NOT EXISTS scope     text NOT NULL DEFAULT 'brand';

ALTER TABLE public.user_knowledge_base
  DROP CONSTRAINT IF EXISTS user_knowledge_base_brand_id_fkey;
ALTER TABLE public.user_knowledge_base
  ADD CONSTRAINT user_knowledge_base_brand_id_fkey
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;
ALTER TABLE public.user_knowledge_base
  DROP CONSTRAINT IF EXISTS user_knowledge_base_avatar_id_fkey;
ALTER TABLE public.user_knowledge_base
  ADD CONSTRAINT user_knowledge_base_avatar_id_fkey
  FOREIGN KEY (avatar_id) REFERENCES public.avatars(id) ON DELETE CASCADE;

ALTER TABLE public.user_knowledge_base
  DROP CONSTRAINT IF EXISTS chk_ukb_scope_enum;
ALTER TABLE public.user_knowledge_base
  ADD CONSTRAINT chk_ukb_scope_enum CHECK (scope IN ('brand','avatar'));

-- scope<->avatar_id coherence. Added NOT VALID so it never fails on the pre-backfill
-- default-'brand' rows (all have avatar_id NULL, which already satisfies the brand arm),
-- then VALIDATEd in this same window once the column population is consistent. 2191 rows,
-- trivial lock. Because the default is 'brand' + avatar_id NULL, this is already valid.
ALTER TABLE public.user_knowledge_base
  DROP CONSTRAINT IF EXISTS chk_ukb_scope_avatar;
ALTER TABLE public.user_knowledge_base
  ADD CONSTRAINT chk_ukb_scope_avatar CHECK (
    (scope = 'avatar' AND avatar_id IS NOT NULL)
    OR (scope = 'brand' AND avatar_id IS NULL)
  ) NOT VALID;
ALTER TABLE public.user_knowledge_base
  VALIDATE CONSTRAINT chk_ukb_scope_avatar;

CREATE INDEX IF NOT EXISTS idx_ukb_brand_scope
  ON public.user_knowledge_base(brand_id, scope, is_current);
CREATE INDEX IF NOT EXISTS idx_ukb_avatar
  ON public.user_knowledge_base(avatar_id, is_current) WHERE avatar_id IS NOT NULL;

-- chunks (0 rows live; trivial)
ALTER TABLE public.user_knowledge_chunks
  ADD COLUMN IF NOT EXISTS brand_id  uuid,
  ADD COLUMN IF NOT EXISTS avatar_id uuid,
  ADD COLUMN IF NOT EXISTS scope     text NOT NULL DEFAULT 'brand';
ALTER TABLE public.user_knowledge_chunks
  DROP CONSTRAINT IF EXISTS user_knowledge_chunks_brand_id_fkey;
ALTER TABLE public.user_knowledge_chunks
  ADD CONSTRAINT user_knowledge_chunks_brand_id_fkey
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;
ALTER TABLE public.user_knowledge_chunks
  DROP CONSTRAINT IF EXISTS user_knowledge_chunks_avatar_id_fkey;
ALTER TABLE public.user_knowledge_chunks
  ADD CONSTRAINT user_knowledge_chunks_avatar_id_fkey
  FOREIGN KEY (avatar_id) REFERENCES public.avatars(id) ON DELETE CASCADE;
ALTER TABLE public.user_knowledge_chunks
  DROP CONSTRAINT IF EXISTS chk_ukc_scope_enum;
ALTER TABLE public.user_knowledge_chunks
  ADD CONSTRAINT chk_ukc_scope_enum CHECK (scope IN ('brand','avatar'));
CREATE INDEX IF NOT EXISTS idx_ukc_brand_scope
  ON public.user_knowledge_chunks(brand_id, scope);
CREATE INDEX IF NOT EXISTS idx_ukc_avatar
  ON public.user_knowledge_chunks(avatar_id) WHERE avatar_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 5. brand_id denormalized onto avatar-keyed per-user tables (single-key scoping)
-- -----------------------------------------------------------------------------
-- chat_sessions.avatar_id + uploaded_documents.avatar_id are ALREADY LIVE; the ADDs below
-- are no-ops via IF NOT EXISTS. Only brand_id is genuinely net-new on these.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'artifacts','signatures','evidence_snapshots',
    'uploaded_documents','chat_sessions','decision_triggers'
  ] LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS brand_id uuid', t);
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_brand_id_fkey');
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE',
      t, t || '_brand_id_fkey');
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I(brand_id)', 'idx_' || t || '_brand_id', t);
  END LOOP;
END $$;

-- chat_sessions.avatar_id FK (column already present; ensure ON DELETE SET NULL so a
-- deleted avatar doesn't strand the thread). Idempotent re-create.
ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS avatar_id uuid;  -- no-op: already present live
ALTER TABLE public.chat_sessions
  DROP CONSTRAINT IF EXISTS chat_sessions_avatar_id_fkey;
ALTER TABLE public.chat_sessions
  ADD CONSTRAINT chat_sessions_avatar_id_fkey
  FOREIGN KEY (avatar_id) REFERENCES public.avatars(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_chat_sessions_avatar_id
  ON public.chat_sessions(avatar_id);

-- -----------------------------------------------------------------------------
-- 6. DIAGNOSTIC OVERLAY (locked #5): avatar_id NULL = brand baseline; set = overlay
-- -----------------------------------------------------------------------------
ALTER TABLE public.diagnostic_submissions
  ADD COLUMN IF NOT EXISTS brand_id  uuid,
  ADD COLUMN IF NOT EXISTS avatar_id uuid;
ALTER TABLE public.diagnostic_submissions
  DROP CONSTRAINT IF EXISTS diagnostic_submissions_brand_id_fkey;
ALTER TABLE public.diagnostic_submissions
  ADD CONSTRAINT diagnostic_submissions_brand_id_fkey
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;
ALTER TABLE public.diagnostic_submissions
  DROP CONSTRAINT IF EXISTS diagnostic_submissions_avatar_id_fkey;
ALTER TABLE public.diagnostic_submissions
  ADD CONSTRAINT diagnostic_submissions_avatar_id_fkey
  FOREIGN KEY (avatar_id) REFERENCES public.avatars(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_diag_sub_brand_avatar
  ON public.diagnostic_submissions(brand_id, avatar_id, completed_at DESC);

ALTER TABLE public.user_diagnostic_results
  ADD COLUMN IF NOT EXISTS brand_id  uuid,
  ADD COLUMN IF NOT EXISTS avatar_id uuid;
ALTER TABLE public.user_diagnostic_results
  DROP CONSTRAINT IF EXISTS user_diagnostic_results_brand_id_fkey;
ALTER TABLE public.user_diagnostic_results
  ADD CONSTRAINT user_diagnostic_results_brand_id_fkey
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;
ALTER TABLE public.user_diagnostic_results
  DROP CONSTRAINT IF EXISTS user_diagnostic_results_avatar_id_fkey;
ALTER TABLE public.user_diagnostic_results
  ADD CONSTRAINT user_diagnostic_results_avatar_id_fkey
  FOREIGN KEY (avatar_id) REFERENCES public.avatars(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_udr_brand_avatar
  ON public.user_diagnostic_results(brand_id, avatar_id);

-- -----------------------------------------------------------------------------
-- 7. FUNNEL CARVE-OUT: brand_assets inventory becomes brand-level + audit overlay
-- -----------------------------------------------------------------------------
-- LIVE: brand_assets has avatar_id NOT NULL, NO brand_id, NO user_id, 0 rows.
-- We add brand_id and relax avatar_id NOT NULL so inventory rows are brand-keyed.
-- !! The RLS policies (FILE 2) still reference avatar_id; dropping NOT NULL makes
--    avatar_id-NULL inventory rows unreadable/uninsertable UNTIL the policy swap.
--    FILE 1 + FILE 2 MUST be applied in one window. The smoke-insert assertion that
--    proves the window is correct lives at the end of FILE 2.
ALTER TABLE public.brand_assets
  ADD COLUMN IF NOT EXISTS brand_id uuid;
ALTER TABLE public.brand_assets
  DROP CONSTRAINT IF EXISTS brand_assets_brand_id_fkey;
ALTER TABLE public.brand_assets
  ADD CONSTRAINT brand_assets_brand_id_fkey
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;
ALTER TABLE public.brand_assets
  ALTER COLUMN avatar_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_brand_assets_brand
  ON public.brand_assets(brand_id, touchpoint_id, stage);
-- One current inventory row per (brand, touchpoint).
-- NOTE (data-integrity review L-1 / security L-1): brand_id is nullable, and NULLs are
-- DISTINCT in a Postgres unique index, so this guarantee holds ONLY for non-NULL brand_id.
-- The §7b sync trigger below + FILE 2 RLS together ensure any avatar-bound brand_assets
-- insert populates brand_id from the avatar, so in practice brand_id is never NULL on a
-- real inventory row. avatar_id is intentionally NOT in this key: brand_assets is strictly
-- brand-level INVENTORY; per-avatar overlays live in brand_asset_audits.
CREATE UNIQUE INDEX IF NOT EXISTS uq_brand_assets_current_per_touchpoint
  ON public.brand_assets(brand_id, touchpoint_id) WHERE superseded_by IS NULL;

-- 7b. Attach the sync trigger to brand_assets too (security H-4 / L-1, data-integrity M-4):
--     an avatar-bound brand_assets row must get brand_id populated from the avatar so the
--     unique index above is meaningful and FILE 2's brand-OR-avatar policy can never leave
--     a row with both keys NULL. Installed AFTER §9 defines the function (see §9 ordering).

-- Per-avatar audit overlay on a brand-level inventory asset.
CREATE TABLE IF NOT EXISTS public.brand_asset_audits (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_asset_id uuid NOT NULL REFERENCES public.brand_assets(id) ON DELETE CASCADE,
  avatar_id      uuid NOT NULL REFERENCES public.avatars(id)      ON DELETE CASCADE,
  brand_id       uuid NOT NULL REFERENCES public.brands(id)       ON DELETE CASCADE,
  user_id        uuid NOT NULL,
  overall_score  integer,
  audit_result   jsonb,
  grounding      text  NOT NULL DEFAULT 'inference',
  evidence_refs  jsonb NOT NULL DEFAULT '[]'::jsonb,
  superseded_by  uuid REFERENCES public.brand_asset_audits(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_brand_asset_audit_current
  ON public.brand_asset_audits(brand_asset_id, avatar_id) WHERE superseded_by IS NULL;
CREATE INDEX IF NOT EXISTS idx_brand_asset_audits_avatar
  ON public.brand_asset_audits(avatar_id);

-- -----------------------------------------------------------------------------
-- 8. FORENSIC BUILD STATE (per-avatar S1->S4 progress)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.avatar_build_state (
  avatar_id   uuid PRIMARY KEY REFERENCES public.avatars(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  stages_done text[] NOT NULL DEFAULT '{}',
  status      text   NOT NULL DEFAULT 'draft',
  approved_at timestamptz,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.avatar_build_state
  DROP CONSTRAINT IF EXISTS chk_avatar_build_state_status;
ALTER TABLE public.avatar_build_state
  ADD CONSTRAINT chk_avatar_build_state_status
  CHECK (status IN ('draft','built','approved'));

-- -----------------------------------------------------------------------------
-- 9. CONSISTENCY TRIGGER: keep denormalized brand_id == avatar's brand_id
-- -----------------------------------------------------------------------------
-- NON-DESTRUCTIVE (data-integrity review C-1, security review M-3): the trigger ONLY
-- overwrites brand_id when a brand is actually resolved from the avatar. It NEVER assigns
-- NULL over a caller-supplied / backfilled brand_id. This is the single most important fix:
--   * Without the FOUND/IS NOT NULL guard, an orphan avatar_id (no matching avatar) made
--     `SELECT ... INTO NEW.brand_id` set brand_id = NULL, silently clobbering the value the
--     backfill had just resolved for the 5 orphan artifacts / 1 signature / 3 evidence rows.
--   * With this guard, an unresolvable avatar_id leaves NEW.brand_id exactly as supplied.
-- Order of precedence: a caller-supplied brand_id is preserved UNLESS the avatar resolves to
-- a (non-NULL) brand, in which case the avatar is authoritative (keeps the denormalization
-- coherent). On an orphan/unset avatar, the supplied/backfilled brand_id wins.
CREATE OR REPLACE FUNCTION public.sync_brand_id_from_avatar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_brand uuid;
BEGIN
  IF NEW.avatar_id IS NOT NULL THEN
    SELECT a.brand_id INTO v_brand
    FROM public.avatars a
    WHERE a.id = NEW.avatar_id;
    -- Only overwrite when the avatar resolved to a real brand. Never null-clobber.
    IF FOUND AND v_brand IS NOT NULL THEN
      NEW.brand_id := v_brand;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Attach to avatar-keyed tables. evidence_snapshots has NO updated_at and is
-- effectively append-only; INSERT-only trigger is sufficient and correct there.
-- artifacts/signatures/decision_triggers fire on INSERT and UPDATE. brand_assets gets
-- INSERT OR UPDATE so avatar-bound inventory rows always carry brand_id (§7b).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['artifacts','signatures','decision_triggers','brand_assets'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_sync_brand_id ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_sync_brand_id BEFORE INSERT OR UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.sync_brand_id_from_avatar()', t);
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS trg_sync_brand_id ON public.evidence_snapshots;
CREATE TRIGGER trg_sync_brand_id
  BEFORE INSERT ON public.evidence_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.sync_brand_id_from_avatar();

COMMIT;
