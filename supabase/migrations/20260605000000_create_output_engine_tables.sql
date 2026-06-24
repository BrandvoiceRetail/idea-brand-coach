-- Output-engine persistence layer (Gold-Workbook Output Engine, Phase 1).
--
-- Four additive tables backing the artifact chain that produces the two
-- Trevor-approved gold workbooks:
--   * artifacts          — every generated artifact (diagnostic, avatar stages,
--                          signature, canvas, brief, audit×IDEA, marketing audit,
--                          rollout) with grounding + evidence_refs + supersede chain.
--   * evidence_snapshots — point-in-time own/competitor reviews + listing copy that
--                          a generator grounded against (the "filled-evidence" source).
--   * signatures         — chosen Signature persistence (satisfies the Alpha
--                          "persist chosen Signature locally/server" decision).
--   * marketing_audits   — Output-B tiered investment matrix + 90-day rollout.
--
-- ADDITIVE ONLY: CREATE ... IF NOT EXISTS, new policies, new indexes. No ALTER /
-- DROP of existing objects. RLS = owner-only, cloned from the
-- diagnostic_submissions policy style (auth.uid() = user_id).

-- ---------------------------------------------------------------------------
-- artifacts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.artifacts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    avatar_id     UUID,
    kind          TEXT NOT NULL,
    content       JSONB NOT NULL,
    grounding     TEXT NOT NULL CHECK (grounding IN ('evidence', 'inference')),
    evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
    schema_version TEXT,
    model         TEXT,
    status        TEXT NOT NULL DEFAULT 'success',
    superseded_by UUID REFERENCES public.artifacts(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One current artifact per (user, avatar, kind). avatar_id NULL is coalesced to
-- a sentinel so brand-level (avatar-less) artifacts get a stable uniqueness key.
-- Only rows that are NOT superseded participate, so the supersede chain can hold
-- any number of historical versions.
CREATE UNIQUE INDEX IF NOT EXISTS uq_artifacts_current_per_kind
    ON public.artifacts (
        user_id,
        COALESCE(avatar_id, '00000000-0000-0000-0000-000000000000'::uuid),
        kind
    )
    WHERE superseded_by IS NULL;

CREATE INDEX IF NOT EXISTS idx_artifacts_user_id ON public.artifacts (user_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_avatar_id ON public.artifacts (avatar_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_kind ON public.artifacts (kind);

ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own artifacts"
    ON public.artifacts FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own artifacts"
    ON public.artifacts FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own artifacts"
    ON public.artifacts FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- evidence_snapshots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.evidence_snapshots (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    avatar_id  UUID,
    source     TEXT NOT NULL,
    source_ref UUID,
    reviews    JSONB,
    listing    JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_snapshots_user_id ON public.evidence_snapshots (user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_snapshots_avatar_id ON public.evidence_snapshots (avatar_id);

ALTER TABLE public.evidence_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own evidence snapshots"
    ON public.evidence_snapshots FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own evidence snapshots"
    ON public.evidence_snapshots FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own evidence snapshots"
    ON public.evidence_snapshots FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- signatures
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.signatures (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    avatar_id      UUID,
    signature_text TEXT,
    all_options    JSONB,
    chosen_index   INTEGER,
    used_reviews   BOOLEAN,
    inference      BOOLEAN,
    artifact_id    UUID REFERENCES public.artifacts(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signatures_user_id ON public.signatures (user_id);
CREATE INDEX IF NOT EXISTS idx_signatures_avatar_id ON public.signatures (avatar_id);
CREATE INDEX IF NOT EXISTS idx_signatures_artifact_id ON public.signatures (artifact_id);

ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own signatures"
    ON public.signatures FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own signatures"
    ON public.signatures FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own signatures"
    ON public.signatures FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- marketing_audits
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_audits (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    constraints JSONB,
    investments JSONB,
    rollout     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_audits_user_id ON public.marketing_audits (user_id);

ALTER TABLE public.marketing_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own marketing audits"
    ON public.marketing_audits FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own marketing audits"
    ON public.marketing_audits FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own marketing audits"
    ON public.marketing_audits FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
