-- feedback_events → Alpha instrumentation spec (convergent, idempotent).
--
-- HISTORY: a lean feedback_events (id, moment, user_id, session_id,
-- created_at, payload) was created directly on the live project on 2026-05-26
-- (remote migration `create_feedback_events`; no repo file). This migration
-- converges EITHER that lean shape OR a fresh database to the Alpha spec:
-- substantive Moment-1 feedback in first-class columns.
--
-- THE JOIN KEY: posthog_distinct_id connects "this person's funnel journey in
-- PostHog" to "this person's feedback in Supabase". NOT NULL + non-blank by
-- constraint — without it the two systems are islands.

-- Base shape (no-op on the live project; bootstraps fresh databases).
CREATE TABLE IF NOT EXISTS public.feedback_events (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    moment     TEXT NOT NULL,
    user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    payload    JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Alpha spec columns.
ALTER TABLE public.feedback_events
    ADD COLUMN IF NOT EXISTS posthog_distinct_id     TEXT,
    ADD COLUMN IF NOT EXISTS avatar_id               UUID,
    ADD COLUMN IF NOT EXISTS chosen_signature        TEXT,
    ADD COLUMN IF NOT EXISTS signature_options       JSONB,
    ADD COLUMN IF NOT EXISTS scores                  JSONB,
    ADD COLUMN IF NOT EXISTS q1_score_felt_right     TEXT,
    ADD COLUMN IF NOT EXISTS q2_signature_felt_right TEXT,
    ADD COLUMN IF NOT EXISTS q3_whats_off            TEXT;

-- Backfill pre-spec rows (2026-06-06 QA-walk tests) so the join key can be
-- NOT NULL. 'legacy:pre-spec' marks rows with no PostHog journey to join.
UPDATE public.feedback_events
SET posthog_distinct_id = 'legacy:pre-spec'
WHERE posthog_distinct_id IS NULL;

ALTER TABLE public.feedback_events
    ALTER COLUMN posthog_distinct_id SET NOT NULL,
    ALTER COLUMN moment SET DEFAULT 'moment_1';

-- Named CHECK constraints (ADD CONSTRAINT has no IF NOT EXISTS).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feedback_events_posthog_distinct_id_not_blank') THEN
        ALTER TABLE public.feedback_events
            ADD CONSTRAINT feedback_events_posthog_distinct_id_not_blank
            CHECK (length(trim(posthog_distinct_id)) > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feedback_events_q1_valid') THEN
        ALTER TABLE public.feedback_events
            ADD CONSTRAINT feedback_events_q1_valid
            CHECK (q1_score_felt_right IS NULL OR q1_score_felt_right IN ('yes', 'no', 'partial'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feedback_events_q2_valid') THEN
        ALTER TABLE public.feedback_events
            ADD CONSTRAINT feedback_events_q2_valid
            CHECK (q2_signature_felt_right IS NULL OR q2_signature_felt_right IN ('yes', 'no', 'partial'));
    END IF;
END $$;

-- Join-key lookups ("this person dropped off here AND said this").
CREATE INDEX IF NOT EXISTS idx_feedback_events_posthog_distinct_id
    ON public.feedback_events (posthog_distinct_id);

ALTER TABLE public.feedback_events ENABLE ROW LEVEL SECURITY;

-- RLS posture (tighter than the spec's letter, same intent):
-- * INSERT: no client policy — all writes flow through the save-feedback-event
--   edge fn (service role), which enforces the join key and payload limits.
--   Anonymous testers can still submit (the fn allows null user_id).
-- * SELECT: review data, not tester-readable (spec) — drop the 2026-05-26
--   select-own policy; the service role bypasses RLS for manual SQL review.
-- * UPDATE/DELETE: no policies — feedback rows are immutable from clients.
DROP POLICY IF EXISTS feedback_events_select_own ON public.feedback_events;
