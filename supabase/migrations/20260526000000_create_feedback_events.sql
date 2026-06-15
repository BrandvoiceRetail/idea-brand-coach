-- feedback_events: moment-tagged product-signal event log (Gen 3 alpha).
-- Written ONLY via the save-feedback-event edge function (service role, bypasses RLS).
-- Distinct from beta_feedback (beta-program form/widget) — this is the generic moment-tagged sink.

create table if not exists public.feedback_events (
  id          uuid primary key default gen_random_uuid(),
  moment      text not null,
  user_id     uuid references auth.users (id) on delete set null,
  session_id  text,
  created_at  timestamptz not null default now(),
  payload     jsonb not null default '{}'::jsonb
);

comment on table public.feedback_events is
  'Moment-tagged product-signal feedback events (Gen 3 alpha). moment e.g. ''moment_1''. '
  'payload e.g. {chosen_signature, scores, free_text} or {skipped:true,...}. '
  'Written only via the save-feedback-event edge function (service role).';

create index if not exists feedback_events_moment_idx     on public.feedback_events (moment);
create index if not exists feedback_events_user_id_idx     on public.feedback_events (user_id);
create index if not exists feedback_events_created_at_idx  on public.feedback_events (created_at desc);

-- RLS: enabled, deny-by-default for clients. The edge function uses the service-role key
-- (which bypasses RLS) for inserts, and derives user_id from the verified JWT.
alter table public.feedback_events enable row level security;

-- No client INSERT policy on purpose (writes go through the edge function only).
-- Allow a signed-in user to read back their own events (future read use; safe today).
drop policy if exists feedback_events_select_own on public.feedback_events;
create policy feedback_events_select_own
  on public.feedback_events
  for select
  to authenticated
  using (user_id = auth.uid());
