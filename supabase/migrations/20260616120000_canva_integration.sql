-- Canva Connect integration — OAuth state, per-user tokens, imported designs.
--
-- Security posture (per canva-contract.md): the two token-bearing tables
-- (canva_oauth_states, canva_connections) have RLS ENABLED with NO POLICIES, so
-- only the service role (edge functions) can read/write them — tokens are never
-- client-readable. canva_imported_designs is owner-readable (SELECT + DELETE)
-- but the INSERT path is the edge function via service role, so no INSERT policy
-- is granted. Idempotent: safe to re-apply (CREATE TABLE IF NOT EXISTS,
-- DROP POLICY IF EXISTS before CREATE).

-- ── canva_oauth_states — short-lived PKCE/state rows (service-role only) ──────
CREATE TABLE IF NOT EXISTS public.canva_oauth_states (
    state         TEXT PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code_verifier TEXT NOT NULL,
    return_url    TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_canva_oauth_states_expires_at
    ON public.canva_oauth_states (expires_at);

ALTER TABLE public.canva_oauth_states ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (edge functions) may touch this table.

-- ── canva_connections — per-user OAuth tokens (service-role only) ─────────────
CREATE TABLE IF NOT EXISTS public.canva_connections (
    user_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    canva_user_id    TEXT,
    canva_team_id    TEXT,
    display_name     TEXT,
    scopes           TEXT,
    access_token     TEXT NOT NULL,
    refresh_token    TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ NOT NULL,
    connected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.canva_connections ENABLE ROW LEVEL SECURITY;
-- No policies: tokens are never client-readable. Service role bypasses RLS.

-- ── canva_imported_designs — imported design refs (no tokens; owner-readable) ─
CREATE TABLE IF NOT EXISTS public.canva_imported_designs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    canva_design_id TEXT NOT NULL,
    title           TEXT,
    thumbnail_url   TEXT,
    edit_url        TEXT,
    view_url        TEXT,
    imported_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, canva_design_id)
);

ALTER TABLE public.canva_imported_designs ENABLE ROW LEVEL SECURITY;

-- Owner may read and delete their own imported-design rows. INSERT flows through
-- the canva-imports edge function (service role), so no INSERT policy is needed.
DROP POLICY IF EXISTS canva_imported_designs_select_own ON public.canva_imported_designs;
CREATE POLICY canva_imported_designs_select_own
    ON public.canva_imported_designs
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS canva_imported_designs_delete_own ON public.canva_imported_designs;
CREATE POLICY canva_imported_designs_delete_own
    ON public.canva_imported_designs
    FOR DELETE
    USING (auth.uid() = user_id);
