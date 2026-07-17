-- Expert Intelligence Loop — capture substrate.
--
-- expert_corrections stores an EXPERT (admin) user's corrections/redirects to the coach,
-- from either surface: source='mcp' (capture_correction tool) or source='chat' (in-app harvest).
-- Written ONLY via service-role paths; readable ONLY by admins (profiles.is_admin).
-- Verbatim text is admin/service-role-only and must never enter general telemetry (MF-5).
-- Registered in supabase/functions/_shared/gdprData.ts (USER_ID_TABLES); redeploy gdpr fns.

CREATE TABLE IF NOT EXISTS public.expert_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- the expert (profiles.is_admin)
  source text NOT NULL CHECK (source IN ('mcp', 'chat')),
  session_id text,                 -- chat_sessions.id (uuid, stored as text) when source='chat'; MCP session token otherwise
  avatar_id uuid,                  -- optional avatar context (no FK: avatars may be deleted)
  coach_claim text NOT NULL,       -- what the coach asserted
  correction text NOT NULL,        -- the expert's redirect / what it should be
  verbatim text,                   -- the expert's raw words (MF-5: admin/service-role only)
  tool_context text,               -- tool or topic the correction is about (e.g. 'generate_brief')
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'clustered', 'drafted', 'applied', 'dismissed')),
  cluster_id uuid,                 -- set by the nightly distill when grouped
  proposed_instruction_id text,    -- coach_instructions.instruction_id this fed once drafted
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Nightly sweep reads status='new'; review reads per-expert newest-first.
CREATE INDEX IF NOT EXISTS idx_expert_corrections_status
  ON public.expert_corrections (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expert_corrections_user
  ON public.expert_corrections (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expert_corrections_cluster
  ON public.expert_corrections (cluster_id) WHERE cluster_id IS NOT NULL;
-- Studio provenance: which corrections fed a given drafted instruction (errors.md #20).
CREATE INDEX IF NOT EXISTS idx_expert_corrections_proposed
  ON public.expert_corrections (proposed_instruction_id) WHERE proposed_instruction_id IS NOT NULL;

ALTER TABLE public.expert_corrections ENABLE ROW LEVEL SECURITY;

-- READ: admins only (mirrors coach_instructions' admin gate). No per-user self-read —
-- this is an internal training substrate, not user-facing data.
CREATE POLICY "Admins can read expert_corrections"
  ON public.expert_corrections
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- INSERT (client path): an authenticated admin may insert a row attributed to THEMSELVES. This
-- keeps the MCP gateway free of the service-role key (its security model is RLS-per-JWT, guardrail
-- #5) — the capture_correction tool writes via the caller's JWT and further narrows to the expert
-- allowlist (Trevor). The offline harvest (Feeder 2) runs off-gateway and uses service-role, which
-- bypasses RLS. No client UPDATE/DELETE policy: status transitions are service-role (the distill).
CREATE POLICY "Admins can insert own expert_corrections"
  ON public.expert_corrections
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

ALTER TABLE public.expert_corrections FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.expert_corrections TO authenticated;  -- effective rows gated by the RLS policy above
