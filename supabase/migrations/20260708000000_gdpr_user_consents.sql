-- GDPR consent ledger (Art. 7(1) — the controller must be able to DEMONSTRATE
-- consent). Append-only: each decision (grant OR withdrawal) is a new row; the
-- latest row per (user_id, consent_type) is the current state. No UPDATE/DELETE
-- policies on purpose — the ledger is the audit trail. Rows die with the user
-- via ON DELETE CASCADE (right to erasure keeps no orphaned consent trail;
-- the erasure event itself is logged separately in gdpr_requests).

create table public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- analytics: PostHog capture opt-in/out (banner + settings toggle)
  -- policy_acceptance: privacy notice + terms agreed at signup
  -- marketing_email: brand-tips emails (lead capture / future marketing sends)
  consent_type text not null check (consent_type in ('analytics', 'policy_acceptance', 'marketing_email')),
  granted boolean not null,
  policy_version text not null,
  -- where the decision was made: 'consent_banner' | 'signup_form' | 'settings' | 'lead_capture'
  source text not null,
  created_at timestamptz not null default now()
);

comment on table public.user_consents is
  'Append-only GDPR consent ledger. Latest row per (user_id, consent_type) wins.';

create index user_consents_user_type_created_idx
  on public.user_consents (user_id, consent_type, created_at desc);

alter table public.user_consents enable row level security;

create policy "Users insert their own consent decisions"
  on public.user_consents for insert
  with check (auth.uid() = user_id);

create policy "Users read their own consent decisions"
  on public.user_consents for select
  using (auth.uid() = user_id);

-- GDPR request log (Art. 12(3) — requests must be tracked and answered within
-- one month). Written service-role by the gdpr-export / gdpr-delete-account
-- edge functions; users can read their own entries.
create table public.gdpr_requests (
  id uuid primary key default gen_random_uuid(),
  -- NOT a foreign key: an erasure row must survive the auth.users delete it
  -- records (Art. 5(2) accountability). Only the opaque UUID remains.
  user_id uuid not null,
  request_type text not null check (request_type in ('export', 'erasure')),
  status text not null default 'completed' check (status in ('completed', 'failed')),
  -- erasure keeps a per-table row-count tally; export keeps table list only
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.gdpr_requests is
  'Log of data-subject requests (export/erasure) handled by the GDPR edge functions.';

alter table public.gdpr_requests enable row level security;

create policy "Users read their own GDPR requests"
  on public.gdpr_requests for select
  using (auth.uid() = user_id);
