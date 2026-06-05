-- feedback_events: substantive Alpha feedback content (Moment-1 only).
--
-- PostHog owns the funnel; this table holds only what testers actually said
-- (chosen Signature, the options they chose among, scores, q1-q3 answers).
--
-- THE JOIN KEY: posthog_distinct_id connects "this person's funnel journey in
-- PostHog" to "this person's feedback in Supabase". It is NOT NULL and
-- non-empty by constraint — without it the two systems are islands.

CREATE TABLE IF NOT EXISTS public.feedback_events (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    moment                  TEXT NOT NULL DEFAULT 'moment_1',
    user_id                 UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    posthog_distinct_id     TEXT NOT NULL CHECK (length(trim(posthog_distinct_id)) > 0),
    avatar_id               UUID,
    session_id              TEXT,
    chosen_signature        TEXT,
    signature_options       JSONB,
    scores                  JSONB,
    q1_score_felt_right     TEXT CHECK (q1_score_felt_right IS NULL OR q1_score_felt_right IN ('yes', 'no', 'partial')),
    q2_signature_felt_right TEXT CHECK (q2_signature_felt_right IS NULL OR q2_signature_felt_right IN ('yes', 'no', 'partial')),
    q3_whats_off            TEXT,
    payload                 JSONB
);

-- Join-key lookups ("this person dropped off here AND said this")
CREATE INDEX IF NOT EXISTS idx_feedback_events_posthog_distinct_id
    ON public.feedback_events (posthog_distinct_id);

ALTER TABLE public.feedback_events ENABLE ROW LEVEL SECURITY;

-- INSERT: a tester may submit feedback with or without auth, but the PostHog
-- join key must be present (double-enforced by the column constraint).
CREATE POLICY "Anyone can submit feedback events"
    ON public.feedback_events
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (length(trim(posthog_distinct_id)) > 0);

-- SELECT: deliberately NO policy for anon/authenticated — this is review
-- data, not tester-readable. The service role bypasses RLS for manual SQL.
-- UPDATE/DELETE: deliberately NO policies — feedback rows are immutable from
-- clients.
