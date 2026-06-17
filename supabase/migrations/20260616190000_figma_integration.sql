-- Migration: Figma integration (OAuth connections + imported design data)
-- Created: 2026-06-16
-- Description:
--   Adds the storage backing the user-facing Figma OAuth flow:
--     1. figma_connections  — per-user Figma OAuth tokens. SERVICE-ROLE ONLY.
--                              Tokens are encrypted at rest by the edge functions
--                              (AES-GCM, FIGMA_TOKEN_ENC_KEY) and never exposed to
--                              the browser. RLS is enabled with NO authenticated
--                              policies, and table grants are revoked from anon/
--                              authenticated so only the service role (edge
--                              functions, which bypass RLS) can read/write them.
--     2. figma_oauth_state  — short-lived CSRF state for the authorize round-trip.
--                              SERVICE-ROLE ONLY (same posture as above).
--     3. figma_imports      — structured design data extracted from a Figma file
--                              (palette, typography, components, summary). User-
--                              scoped with standard owner RLS; powers the import
--                              history UI and the coach's visual-identity context.
--   Also expands the user_knowledge_base.category CHECK so figma-sync can write a
--   readable "visual_identity" summary the brand coach already retrieves. The
--   allowed list is the superset of categories observed in production
--   (diagnostic/avatar/insights/canvas/copy + capture/core/consultant, which were
--   added out-of-band) plus visual_identity, so applying this never NARROWS an
--   environment's existing constraint.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. figma_connections — service-role-only OAuth token store
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.figma_connections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  figma_user_id   TEXT,
  figma_handle    TEXT,
  figma_email     TEXT,
  scope           TEXT,
  -- access_token / refresh_token are ciphertext (see _shared/figma.ts).
  access_token    TEXT NOT NULL,
  refresh_token   TEXT,
  token_type      TEXT NOT NULL DEFAULT 'Bearer',
  expires_at      TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.figma_connections ENABLE ROW LEVEL SECURITY;
-- Intentionally NO RLS policies: the browser must never read raw tokens.
-- Edge functions use the service-role key (bypasses RLS) for all access.

CREATE INDEX IF NOT EXISTS idx_figma_connections_user_id
  ON public.figma_connections(user_id);

DROP TRIGGER IF EXISTS update_figma_connections_updated_at ON public.figma_connections;
CREATE TRIGGER update_figma_connections_updated_at
  BEFORE UPDATE ON public.figma_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Defense in depth: revoke client grants so only the service role can touch it.
REVOKE ALL ON public.figma_connections FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. figma_oauth_state — short-lived CSRF state (service-role-only)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.figma_oauth_state (
  state         TEXT PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri  TEXT NOT NULL,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at    TIMESTAMP WITH TIME ZONE NOT NULL
);

ALTER TABLE public.figma_oauth_state ENABLE ROW LEVEL SECURITY;
-- No policies — written by figma-oauth-start and consumed (single-use) by
-- figma-oauth-exchange, both via the service-role key.

CREATE INDEX IF NOT EXISTS idx_figma_oauth_state_expires_at
  ON public.figma_oauth_state(expires_at);

REVOKE ALL ON public.figma_oauth_state FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. figma_imports — extracted design data (owner-scoped)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.figma_imports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id       UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  file_key       TEXT NOT NULL,
  file_name      TEXT,
  thumbnail_url  TEXT,
  last_modified  TIMESTAMP WITH TIME ZONE,
  palette        JSONB NOT NULL DEFAULT '[]'::jsonb,
  typography     JSONB NOT NULL DEFAULT '[]'::jsonb,
  components     JSONB NOT NULL DEFAULT '[]'::jsonb,
  pages          JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary        TEXT,
  created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, file_key)
);

ALTER TABLE public.figma_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own figma imports"
  ON public.figma_imports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own figma imports"
  ON public.figma_imports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own figma imports"
  ON public.figma_imports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own figma imports"
  ON public.figma_imports FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_figma_imports_user_id
  ON public.figma_imports(user_id);
CREATE INDEX IF NOT EXISTS idx_figma_imports_user_created
  ON public.figma_imports(user_id, created_at DESC);

DROP TRIGGER IF EXISTS update_figma_imports_updated_at ON public.figma_imports;
CREATE TRIGGER update_figma_imports_updated_at
  BEFORE UPDATE ON public.figma_imports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT ALL ON public.figma_imports TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Allow figma-sync to write a "visual_identity" summary into the coach's KB.
--    The brand coach (idea-framework-consultant-claude/context.ts) already reads
--    user_knowledge_base; expand the category CHECK so the Figma summary fits.
--    Drop the existing category CHECK by catalog lookup (name-agnostic) so a
--    surviving old constraint can't keep rejecting 'visual_identity'.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.user_knowledge_base'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%category%'
  LOOP
    EXECUTE format('ALTER TABLE public.user_knowledge_base DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.user_knowledge_base
  ADD CONSTRAINT user_knowledge_base_category_check
  CHECK (category IN ('diagnostic', 'avatar', 'insights', 'canvas', 'copy', 'capture', 'core', 'consultant', 'visual_identity'));

COMMENT ON TABLE public.figma_connections IS 'Per-user Figma OAuth tokens (encrypted at rest). Service-role only; never exposed to the browser.';
COMMENT ON TABLE public.figma_oauth_state IS 'Short-lived, single-use CSRF state for the Figma OAuth authorize round-trip. Service-role only.';
COMMENT ON TABLE public.figma_imports IS 'Design data (palette/typography/components/summary) extracted from a connected Figma file.';
