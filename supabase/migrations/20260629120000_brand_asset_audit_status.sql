-- ============================================
-- T11 — per-avatar verdict STATUS on the audit overlay.
--
-- brand_asset_audits already carries the per-(asset, avatar) overall_score +
-- audit_result, but NOT the verdict status enum (that lived only on the
-- brand-level brand_assets row). For the funnel to be brand-scoped (one piece
-- per (brand, touchpoint)) while the EVALUATION is per-avatar, the overlay must
-- carry its own status. Additive + reversible: a nullable column + a backfill +
-- one extra DEFAULT NULL param on the atomic writer (old 6-arg callers keep
-- working). RLS unchanged — the overlay is already user-scoped.
-- ============================================

-- ---------- 1. per-avatar status column (same vocabulary as brand_assets) ----------
ALTER TABLE public.brand_asset_audits
  ADD COLUMN IF NOT EXISTS status TEXT
    CHECK (status IS NULL OR status IN
      ('pending','aligned','stale','misaligned','missing','failed'));

-- ---------- 2. backfill existing current audits from their piece's status ----------
UPDATE public.brand_asset_audits aud
SET status = ba.status
FROM public.brand_assets ba
WHERE ba.id = aud.brand_asset_id
  AND aud.status IS NULL
  AND aud.superseded_by IS NULL;

-- ---------- 3. extend the atomic writer with an optional p_status ----------
-- Drop the 6-arg signature and recreate with p_status appended (DEFAULT NULL) so
-- existing named-param callers that omit p_status still resolve (PostgREST).
DROP FUNCTION IF EXISTS public.save_asset_audit_atomic(uuid, uuid, integer, jsonb, text, jsonb);

CREATE OR REPLACE FUNCTION public.save_asset_audit_atomic(
  p_brand_asset_id uuid,
  p_avatar_id uuid,
  p_overall_score integer,
  p_audit_result jsonb,
  p_grounding text,
  p_evidence_refs jsonb,
  p_status text DEFAULT NULL
)
RETURNS brand_asset_audits
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_brand uuid; v_abrand uuid; v_new public.brand_asset_audits;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF p_status IS NOT NULL AND p_status NOT IN
     ('pending','aligned','stale','misaligned','missing','failed') THEN
    RAISE EXCEPTION 'invalid status %', p_status USING ERRCODE = '22023';
  END IF;
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
    (brand_asset_id, avatar_id, brand_id, user_id, overall_score, audit_result, grounding, evidence_refs, status)
  VALUES (p_brand_asset_id, p_avatar_id, v_brand, v_uid, p_overall_score, p_audit_result,
     COALESCE(p_grounding, 'inference'), COALESCE(p_evidence_refs, '[]'::jsonb), p_status)
  RETURNING * INTO v_new;
  UPDATE public.brand_asset_audits SET superseded_by = v_new.id
   WHERE brand_asset_id = p_brand_asset_id AND avatar_id = p_avatar_id AND superseded_by = id;
  RETURN v_new;
END; $function$;
