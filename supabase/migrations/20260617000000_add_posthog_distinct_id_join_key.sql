-- Add the PostHog distinct_id join key to the core output/behavior tables so
-- their rows can be tied back to a user's PostHog funnel + session replay
-- (parity with feedback_events.posthog_distinct_id). Nullable + additive:
-- existing rows and write paths are unaffected until they start stamping it.
alter table public.signatures             add column if not exists posthog_distinct_id text;
alter table public.diagnostic_submissions add column if not exists posthog_distinct_id text;
alter table public.chat_sessions          add column if not exists posthog_distinct_id text;

create index if not exists idx_signatures_posthog_distinct_id
  on public.signatures (posthog_distinct_id);
create index if not exists idx_diagnostic_submissions_posthog_distinct_id
  on public.diagnostic_submissions (posthog_distinct_id);
create index if not exists idx_chat_sessions_posthog_distinct_id
  on public.chat_sessions (posthog_distinct_id);
