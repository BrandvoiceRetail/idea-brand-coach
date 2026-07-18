-- Expert Intelligence Loop — capture substrate.
--
-- expert_corrections stores an EXPERT (allowlisted, see experts.ts) user's corrections/redirects to
-- the coach, from either surface: source='mcp' (capture_correction tool) or source='chat' (in-app
-- harvest). Written via the caller's JWT under the admin-insert policy (tool) or service-role (harvest).
-- Readable ONLY by admins. Verbatim text is admin-only and must never enter general telemetry (MF-5).
-- Registered in supabase/functions/_shared/gdprData.ts (USER_ID_TABLES); redeploy gdpr fns.

CREATE TABLE IF NOT EXISTS public.expert_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- the expert
  source text NOT NULL CHECK (source IN ('mcp', 'chat')),
  session_id text,                 -- chat_sessions.id (uuid, stored as text) when source='chat'; MCP session token otherwise
  avatar_id uuid,                  -- optional avatar context (no FK: avatars may be deleted; NOT used for authz)
  coach_claim text NOT NULL,       -- what the coach asserted
  correction text NOT NULL,        -- the expert's redirect / what it should be
  verbatim text,                   -- the expert's raw words (MF-5: admin-only)
  tool_context text,               -- tool or topic the correction is about (e.g. 'generate_brief')
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'drafted', 'applied', 'dismissed')),  -- clustering is in-memory (expertDistill)
  proposed_instruction_id text,    -- coach_instructions.instruction_id this fed once drafted (provenance)
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Nightly distill reads status='new'; review reads per-expert newest-first.
CREATE INDEX IF NOT EXISTS idx_expert_corrections_status
  ON public.expert_corrections (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expert_corrections_user
  ON public.expert_corrections (user_id, created_at DESC);
-- Studio provenance: which corrections fed a given drafted instruction (errors.md #20).
CREATE INDEX IF NOT EXISTS idx_expert_corrections_proposed
  ON public.expert_corrections (proposed_instruction_id) WHERE proposed_instruction_id IS NOT NULL;

ALTER TABLE public.expert_corrections ENABLE ROW LEVEL SECURITY;

-- READ: admins only (mirrors coach_instructions' admin gate). Not user-facing data.
CREATE POLICY "Admins can read expert_corrections"
  ON public.expert_corrections
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- INSERT (client path): an authenticated admin may insert a row attributed to THEMSELVES. This keeps
-- the MCP gateway free of the service-role key — capture_correction writes via the caller's JWT and
-- narrows to the expert allowlist (Trevor). The offline harvest uses service-role (bypasses RLS).
-- No client UPDATE/DELETE policy: status transitions are service-role / the publish trigger below.
CREATE POLICY "Admins can insert own expert_corrections"
  ON public.expert_corrections
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

ALTER TABLE public.expert_corrections FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.expert_corrections TO authenticated;  -- effective rows gated by RLS above

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- SECURITY (pre-ship review, CRITICAL): profiles.is_admin and profiles.email are the trust anchors
-- this feature's RLS + expert gate rely on, but the existing "Users can update own profile" policy
-- has no WITH CHECK, so any signed-in user could self-elevate (set is_admin=true / email='trevor@…')
-- and forge OR read expert corrections. Block a self-account from changing either column. Migrations
-- (postgres), service_role, and SECURITY DEFINER functions (e.g. handle_new_user INSERT) are
-- unaffected. Verified no client flow updates these (UserProfileUpdate excludes both).
CREATE OR REPLACE FUNCTION public.profiles_block_privilege_self_edit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND (NEW.is_admin IS DISTINCT FROM OLD.is_admin OR NEW.email IS DISTINCT FROM OLD.email) THEN
    RAISE EXCEPTION 'profiles.is_admin and profiles.email cannot be changed by the account itself';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_block_privilege_self_edit ON public.profiles;
CREATE TRIGGER trg_profiles_block_privilege_self_edit
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_block_privilege_self_edit();

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- CLOSE THE LOOP (pre-ship review, HIGH): when an admin PUBLISHES a coach_instruction in the Studio,
-- mark the corrections that fed it 'applied' — this is what the weekly digest reports. SECURITY
-- DEFINER because expert_corrections has no client UPDATE policy; the publishing admin's JWT can't
-- update it directly.
CREATE OR REPLACE FUNCTION public.mark_expert_corrections_applied()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.expert_corrections
    SET status = 'applied'
    WHERE proposed_instruction_id = NEW.instruction_id
      AND status = 'drafted';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_expert_corrections_applied ON public.coach_instructions;
CREATE TRIGGER trg_mark_expert_corrections_applied
  AFTER UPDATE OF status ON public.coach_instructions
  FOR EACH ROW
  WHEN (NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published')
  EXECUTE FUNCTION public.mark_expert_corrections_applied();
