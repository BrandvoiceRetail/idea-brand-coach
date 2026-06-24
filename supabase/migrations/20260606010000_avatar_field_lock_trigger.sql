-- avatar_field_values lock trigger (MF-2) — Gold-Workbook Output Engine, Phase 3.
--
-- OWNER-INTENT slots written through the context write-back land in
-- avatar_field_values with field_source='manual' and are LOCKABLE (is_locked). The
-- avatar pipeline (S1-S4 forensics) and other AI generators write field_source='ai'.
-- MF-2: an AI write must NEVER overwrite a field the owner has locked — the owner's
-- confirmed intent is authoritative over model inference (manifest §1 OWNER-INTENT
-- "Confirmed-by-owner; lockable"; §6 fabrication discipline).
--
-- This BEFORE UPDATE trigger rejects any UPDATE that changes field_value when the row
-- is locked AND the incoming write is AI-sourced. A manual write (the owner) may still
-- edit a locked field, and an AI write may still touch non-value columns (e.g.
-- confidence_score) — only field_value mutation on a locked row by an AI source is
-- blocked. Unlocking remains a manual action and is not affected.
--
-- ADDITIVE ONLY: CREATE OR REPLACE FUNCTION (idempotent) + a guarded CREATE TRIGGER
-- (dropped-if-exists only for THIS trigger name, then recreated, so re-running the
-- migration is safe). No ALTER/DROP of the table or any other object.

CREATE OR REPLACE FUNCTION public.reject_ai_overwrite_of_locked_field()
RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(OLD.is_locked, false)
     AND NEW.field_source = 'ai'
     AND NEW.field_value IS DISTINCT FROM OLD.field_value
  THEN
    RAISE EXCEPTION
      'avatar_field_values: AI source cannot overwrite a locked field_value (field_id=%, avatar_id=%)',
      OLD.field_id, OLD.avatar_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger idempotently (only this named trigger is touched).
DROP TRIGGER IF EXISTS reject_ai_overwrite_locked ON public.avatar_field_values;

CREATE TRIGGER reject_ai_overwrite_locked
BEFORE UPDATE ON public.avatar_field_values
FOR EACH ROW
EXECUTE FUNCTION public.reject_ai_overwrite_of_locked_field();
