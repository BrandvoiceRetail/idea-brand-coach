-- ============================================================================
-- SECURITY FIX (MF-2): enforce the manual-edit-lock at the database layer
--
-- "Manual edits always win over AI" was enforced ONLY in TypeScript
-- (FieldPersistenceService): the check is non-atomic (TOCTOU), and `is_locked`
-- sits in the writable upsert payload (`is_locked: field.is_locked ?? false`),
-- so a non-service write path (a future MCP tool, a direct PostgREST/SQL write,
-- or a race) could overwrite a locked field's value AND clear its lock.
--
-- This trigger makes the invariant hold regardless of caller. The TS service
-- stays as the fast-path/convenience; this trigger is the guarantee.
--
-- Rule (BEFORE UPDATE, row level):
--   When a field is locked (OLD.is_locked = true) and the write is NOT an
--   explicit manual edit (field_source <> 'manual') AND it changes the value
--   (NEW.field_value distinct from OLD.field_value) — i.e. an AI *extraction*
--   write — suppress the value change and keep the field locked.
--
-- Why gate on a value change (and not purely on field_source)?
--   `field_source` records where the VALUE came from, not the intent of the
--   write. A user unlocking a previously AI-extracted field via
--   FieldPersistenceService.toggleFieldLock() issues an UPDATE that changes ONLY
--   `is_locked` (value unchanged) while `field_source` stays 'ai'. Gating purely
--   on field_source would wrongly block that legitimate user unlock. An AI
--   extraction, by contrast, always rewrites `field_value`. So:
--     - value-changing + non-manual + locked  -> AI overwrite  -> BLOCK (keep value + lock)
--     - value-unchanged                        -> pure lock toggle -> ALLOW (user lock/unlock)
--     - field_source = 'manual'                -> manual edit   -> ALLOW (manual wins)
--
-- Residual (documented, benign): a non-manual write that re-writes the SAME
-- value while clearing the lock is allowed (no data loss — value is unchanged).
-- The in-app service never does this (saveField blocks AI writes to locked
-- fields before the upsert); it is only reachable by a crafted non-service write
-- and causes no value change. If a stricter "lock may only change via an
-- isolated toggle" policy is desired later, tighten here.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_avatar_field_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_locked = true
     AND NEW.field_source IS DISTINCT FROM 'manual'
     AND NEW.field_value IS DISTINCT FROM OLD.field_value
  THEN
    -- AI/non-manual write trying to overwrite a locked field:
    -- keep the locked value and keep it locked (block the value change and any
    -- lock-clear that rides along with it).
    NEW.field_value := OLD.field_value;
    NEW.is_locked := true;
  END IF;

  RETURN NEW;
END;
$$;

-- Fire AFTER the existing set_timestamp trigger is irrelevant here (both are
-- BEFORE UPDATE and touch disjoint columns); name keeps it grouped with locking.
CREATE TRIGGER trg_enforce_avatar_field_lock
BEFORE UPDATE ON public.avatar_field_values
FOR EACH ROW
EXECUTE FUNCTION public.enforce_avatar_field_lock();

COMMENT ON FUNCTION public.enforce_avatar_field_lock IS
  'Manual-edit-lock backstop: a non-manual value-changing write cannot overwrite or unlock a locked avatar field. Manual edits and pure lock toggles are unaffected.';
