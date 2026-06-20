-- =============================================================================
-- Multi-Avatar Phase 1 — FILE 4/4: BACKFILL (auto-migrate, shared-by-default)
-- =============================================================================
-- Idempotent: every UPDATE is guarded by `... IS NULL` and ON CONFLICT DO NOTHING, so a
-- re-run produces zero deltas. Runs as the migration role (RLS-exempt).
--
-- LIVE FACTS baked in (re-verified):
--   * 13 avatars, 7 brands (1/user, 0 multi-brand), 2191 KB rows, 0 chunks, 0 brand_assets.
--   * KB avatar-scoped categories = {avatar, insights}. Live distinct categories:
--     avatar, canvas, consultant, copy, insights -> only avatar/insights become avatar-scoped.
--   * brand_assets has NO user_id and 0 rows -> step 8 derives brand via avatar and is a
--     guaranteed no-op today (kept for drift-safety).
--   * AVATAR-LESS COHORT (data-integrity HIGH + coach MEDIUM): 4 users have 0 avatars.
--     TWO of them carry avatar-tier knowledge that, without intervention, would be DEMOTED
--     to brand scope by step 4b (the exact cross-avatar bleed the two-tier split prevents).
--     This is NOT defensive on live — it actually fires for these rows absent step 2b:
--       - 4347d1d7…: 6 avatar/insights KB rows, 4 coach threads with NULL avatar_id
--       - 3d0d58b8…: 3 avatar/insights KB rows, 1 coach thread with NULL avatar_id
--     Per product intent, step 2b AUTO-CREATES one default primary avatar per brand that
--     has none, so (a) avatar-tier KB stays avatar-scoped, and (b) coach threads bind to a
--     real avatar instead of remaining stranded. With step 2b in place, the step-4b demotion
--     becomes truly defensive (it no longer fires on live — see the corrected step-4b note).
--   * ORPHAN avatar_id rows (5 artifacts / 1 signature / 3 evidence) were NULLed in FILE 1
--     §0, so their backfill resolves brand via the user's brand (COALESCE path) and the
--     FILE 1 §9 NON-DESTRUCTIVE trigger never clobbers it back to NULL.
--
--   Sequencing: brands first (from the UNION of ALL user-scoped tables so KB-only or
--   doc-only users still get a brand), attach avatars, AUTO-CREATE a default avatar for
--   brands with none, pin primary + mirror pointers, scope KB/chunks/per-avatar
--   tables/diagnostics, ASSERT (now covering ALL brand_id columns), then the irreversible
--   NOT NULL tighten on avatars.brand_id.
-- =============================================================================

BEGIN;

-- 1. ONE brand per user — seed from the UNION of every user-scoped table (F1).
INSERT INTO public.brands (user_id, name)
SELECT DISTINCT u.user_id, 'My Brand'
FROM (
  SELECT user_id FROM public.avatars                WHERE user_id IS NOT NULL
  UNION SELECT user_id FROM public.user_knowledge_base
  UNION SELECT user_id FROM public.uploaded_documents     WHERE user_id IS NOT NULL
  UNION SELECT user_id FROM public.user_diagnostic_results
  UNION SELECT user_id FROM public.diagnostic_submissions
  UNION SELECT user_id FROM public.artifacts
) u
LEFT JOIN public.brands b ON b.user_id = u.user_id
WHERE b.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;   -- uq_brands_user_id from FILE 1

-- 2. Attach avatars to their user's brand.
UPDATE public.avatars a
   SET brand_id = b.id
  FROM public.brands b
 WHERE b.user_id = a.user_id
   AND a.brand_id IS NULL;

-- 2b. AUTO-CREATE a default avatar for any brand that has NO non-template avatar
--     (data-integrity HIGH + coach MEDIUM). On LIVE this fires for the 2 avatar-less users
--     who carry avatar-tier knowledge (and the 2 who carry none — harmless), so it is a
--     real, load-bearing step on live, not a no-op. Naming respects the live
--     UNIQUE(user_id, name) index by guarding on NOT EXISTS for that exact name.
INSERT INTO public.avatars (user_id, brand_id, name, is_template, is_primary)
SELECT b.user_id, b.id, 'My Avatar', false, false
FROM public.brands b
WHERE NOT EXISTS (
        SELECT 1 FROM public.avatars a
         WHERE a.brand_id = b.id AND a.is_template = false)
  AND NOT EXISTS (
        SELECT 1 FROM public.avatars a
         WHERE a.user_id = b.user_id AND a.name = 'My Avatar');

-- 3. Pin primary (oldest NON-TEMPLATE) per brand; mirror to brands + profiles.
WITH ranked AS (
  SELECT id, brand_id,
         row_number() OVER (PARTITION BY brand_id ORDER BY created_at) AS rn
  FROM public.avatars
  WHERE brand_id IS NOT NULL AND is_template = false
)
UPDATE public.avatars a
   SET is_primary = true
  FROM ranked r
 WHERE a.id = r.id
   AND r.rn = 1
   AND NOT EXISTS (
     SELECT 1 FROM public.avatars x WHERE x.brand_id = a.brand_id AND x.is_primary
   );

UPDATE public.brands b
   SET primary_avatar_id = (
     SELECT a.id FROM public.avatars a
     WHERE a.brand_id = b.id AND a.is_primary
     ORDER BY a.created_at LIMIT 1)
 WHERE b.primary_avatar_id IS NULL;

UPDATE public.profiles p
   SET current_avatar_id = (
     SELECT a.id FROM public.avatars a
     JOIN public.brands b ON b.id = a.brand_id
     WHERE b.user_id = p.id AND a.is_primary
     ORDER BY a.created_at LIMIT 1)
 WHERE p.current_avatar_id IS NULL;

-- 4. KB scoping — branch on category. avatar/insights -> avatar-scoped to the primary
--    avatar; everything else (canvas, consultant, copy, ...) -> brand-shared.
UPDATE public.user_knowledge_base k
   SET brand_id  = b.id,
       avatar_id = CASE WHEN k.category IN ('avatar','insights') THEN pa.id ELSE NULL END,
       scope     = CASE WHEN k.category IN ('avatar','insights') THEN 'avatar' ELSE 'brand' END
  FROM public.brands b
  LEFT JOIN public.avatars pa ON pa.brand_id = b.id AND pa.is_primary
 WHERE b.user_id = k.user_id
   AND k.brand_id IS NULL;

-- 4b. SAFETY NET (NOW truly defensive after step 2b). data-integrity HIGH correction: WITHOUT
--     step 2b, the 2 avatar-less users / 9 avatar-or-insights KB rows would land in step 4
--     with scope='avatar' AND avatar_id NULL (LEFT JOIN to a non-existent primary), violating
--     chk_ukb_scope_avatar — and THIS demotion would be the only thing saving the migration
--     from aborting. The earlier "Defensive; live always has a primary" framing was FALSE on
--     live. Step 2b now guarantees every brand has a primary avatar, so on LIVE this UPDATE
--     matches 0 rows. It is retained as a genuine guard for any drifted environment where a
--     brand somehow lacks a primary; such rows are demoted to brand scope rather than aborting.
UPDATE public.user_knowledge_base k
   SET scope = 'brand', avatar_id = NULL
 WHERE k.scope = 'avatar' AND k.avatar_id IS NULL;

UPDATE public.user_knowledge_chunks c
   SET brand_id = b.id, scope = 'brand', avatar_id = NULL
  FROM public.brands b
 WHERE b.user_id = c.user_id
   AND c.brand_id IS NULL;   -- 0 rows live

-- 5. Per-avatar tables: brand_id from the row's avatar, else the user's brand.
--    avatar_id is never cleared. Orphan avatar_id rows were NULLed in FILE 1 §0, so the
--    LEFT JOIN miss correctly COALESCEs to the user's brand. The FILE 1 §9 trigger fires on
--    these UPDATEs but is NON-DESTRUCTIVE: it only overwrites brand_id when the avatar
--    resolves to a real brand, so it never re-NULLs these resolved values (data-integrity C-1).
-- Scalar-subquery form: Postgres forbids referencing the UPDATE target (t) inside a
-- FROM-clause LEFT JOIN ON (42P01). Correlated subqueries resolve per-row correctly.
UPDATE public.artifacts t SET brand_id = COALESCE(
  (SELECT av.brand_id FROM public.avatars av WHERE av.id = t.avatar_id),
  (SELECT b.id FROM public.brands b WHERE b.user_id = t.user_id))
 WHERE t.brand_id IS NULL;

UPDATE public.signatures t SET brand_id = COALESCE(
  (SELECT av.brand_id FROM public.avatars av WHERE av.id = t.avatar_id),
  (SELECT b.id FROM public.brands b WHERE b.user_id = t.user_id))
 WHERE t.brand_id IS NULL;

UPDATE public.evidence_snapshots t SET brand_id = COALESCE(
  (SELECT av.brand_id FROM public.avatars av WHERE av.id = t.avatar_id),
  (SELECT b.id FROM public.brands b WHERE b.user_id = t.user_id))
 WHERE t.brand_id IS NULL;

UPDATE public.decision_triggers t SET brand_id = COALESCE(
  (SELECT av.brand_id FROM public.avatars av WHERE av.id = t.avatar_id),
  (SELECT b.id FROM public.brands b WHERE b.user_id = t.user_id))
 WHERE t.brand_id IS NULL;

UPDATE public.uploaded_documents t SET brand_id = COALESCE(
  (SELECT av.brand_id FROM public.avatars av WHERE av.id = t.avatar_id),
  (SELECT b.id FROM public.brands b WHERE b.user_id = t.user_id))
 WHERE t.brand_id IS NULL;

-- 6. chat_sessions: stamp brand_id; backfill coach threads to the primary avatar so past
--    coach chat is not stranded. With step 2b every brand now has a primary, so the coach
--    threads for the previously avatar-less users ALSO bind (the coach MEDIUM finding's
--    "5 threads remain avatar-NULL" no longer applies — they now get the default avatar).
--    Non-coach threads keep their existing avatar_id.
UPDATE public.chat_sessions s
   SET brand_id = b.id,
       avatar_id = CASE
         WHEN s.chatbot_type = 'idea-framework-consultant' AND s.avatar_id IS NULL THEN pa.id
         ELSE s.avatar_id
       END
  FROM public.brands b
  LEFT JOIN public.avatars pa ON pa.brand_id = b.id AND pa.is_primary
 WHERE b.user_id = s.user_id
   AND s.brand_id IS NULL;

-- 7. Diagnostics -> brand baseline (avatar_id stays NULL), stamp brand_id.
UPDATE public.diagnostic_submissions d
   SET brand_id = b.id
  FROM public.brands b
 WHERE b.user_id = d.user_id AND d.brand_id IS NULL;

UPDATE public.user_diagnostic_results r
   SET brand_id = b.id
  FROM public.brands b
 WHERE b.user_id = r.user_id AND r.brand_id IS NULL;

-- 8. brand_assets -> inventory (brand-level). brand_assets has NO user_id, so derive the
--    brand via the row's avatar. 0 rows live -> no-op (kept for drift-safety).
UPDATE public.brand_assets x
   SET brand_id = av.brand_id
  FROM public.avatars av
 WHERE av.id = x.avatar_id
   AND x.brand_id IS NULL;

-- 9. ASSERT-THEN-TIGHTEN: fail loudly (with counts) BEFORE the irreversible NOT NULL.
--    EXTENDED (data-integrity C-1): assert brand_id IS NULL == 0 on EVERY table that got a
--    brand_id, not just avatars + KB. This makes any orphan/edge row that ended brand-NULL
--    fail the migration loudly instead of silently becoming brand-unscoped (the exact
--    silent failure the non-destructive trigger + orphan pre-clean were meant to prevent —
--    this assert is the belt to those suspenders).
DO $$
DECLARE
  n  int;
  tn text;
BEGIN
  -- avatars must all have a brand (irreversible NOT NULL depends on this).
  SELECT count(*) INTO n FROM public.avatars WHERE brand_id IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'backfill incomplete: % avatars without brand_id', n;
  END IF;

  -- Every brand_id-bearing table: 0 rows brand-NULL.
  FOREACH tn IN ARRAY ARRAY[
    'user_knowledge_base','user_knowledge_chunks',
    'artifacts','signatures','evidence_snapshots','decision_triggers',
    'uploaded_documents','chat_sessions',
    'diagnostic_submissions','user_diagnostic_results'
  ] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE brand_id IS NULL', tn) INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION 'backfill incomplete: % %.brand_id rows are NULL', n, tn;
    END IF;
  END LOOP;

  -- brand_assets only counts rows that exist (0 live); avatar_id may be NULL (inventory).
  SELECT count(*) INTO n FROM public.brand_assets WHERE brand_id IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'backfill incomplete: % brand_assets rows without brand_id', n;
  END IF;

  -- KB scope coherence: no scope='avatar' row may have a NULL avatar_id.
  SELECT count(*) INTO n FROM public.user_knowledge_base WHERE scope = 'avatar' AND avatar_id IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'backfill incomplete: % KB avatar-scoped rows have NULL avatar_id', n;
  END IF;

  -- Every brand with a non-template avatar must have a pinned primary.
  SELECT count(*) INTO n FROM public.brands b
   WHERE NOT EXISTS (SELECT 1 FROM public.avatars a WHERE a.brand_id = b.id AND a.is_primary)
     AND EXISTS     (SELECT 1 FROM public.avatars a WHERE a.brand_id = b.id AND a.is_template = false);
  IF n > 0 THEN
    RAISE EXCEPTION 'backfill incomplete: % brands with non-template avatars but no primary', n;
  END IF;
END $$;

ALTER TABLE public.avatars ALTER COLUMN brand_id SET NOT NULL;
-- chk_ukb_scope_avatar was already VALIDATEd inside FILE 1's window.

COMMIT;
