-- Lead-magnet capture for the free Trust Gap diagnostic.
-- Anonymous visitors submit email + scores via the service-role edge function
-- `submit-diagnostic-lead`; RLS is ENABLED with NO public policies, so lead PII is
-- locked to the service role only (no anon/authenticated read or write).
-- Applied to live 2026-06-21 (ledger: diagnostic_leads).
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  company text,
  source text not null default 'free_diagnostic',
  scores jsonb,
  answers jsonb,
  primary_gap text,
  overall_score integer,
  posthog_distinct_id text,
  utm jsonb,
  consent boolean not null default false,
  emailed_at timestamptz,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;
-- Intentionally NO policies: only the service role (edge function) may read/write.

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_email_idx on public.leads (lower(email));
