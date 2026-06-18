-- Native marketing-asset ledger for the brand-coach MCP.
--
-- Replaces the external (IV-OS) asset ledger the MCP used to consume: brand-coach now
-- OWNS this data in its own Supabase storage. Backs the MCP tools log_asset / get_asset /
-- update_asset_status / record_assessment / get_asset_history / list_assets.
--
-- Two tables:
--   coach_assets        — the asset records (one row per logged/produced marketing asset)
--   coach_asset_events  — append-only change log (logged | status_change | assessment)
--
-- RLS: every row is scoped to its owner via user_id = auth.uid(). The MCP reads/writes
-- through the per-request JWT-bound client (supabaseUser.ts), so RLS evaluates the caller
-- as auth.uid() — no service-role, no cross-user bleed. Distinct from brand_assets (the
-- funnel-tracker touchpoint ledger) and artifacts (the output-engine generator chain).

-- ── coach_assets ──────────────────────────────────────────────────────────────
create table if not exists public.coach_assets (
  id              uuid primary key default gen_random_uuid(),          -- = request_id
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content         text not null,
  content_type    text not null default 'other',                       -- blog|social|amazon|competitor|other
  status          text not null default 'success',                     -- success|partial|failed|pending
  approval_status text not null default 'draft',                       -- draft|in_review|approved|rejected
  agent_name      text,
  prompt          text,
  model           text,
  tokens_used     integer not null default 0,
  campaign_id     text,
  external_id     text,                                                -- caller-supplied idempotency / dedup key
  parameters      jsonb not null default '{}'::jsonb,
  metadata        jsonb not null default '{}'::jsonb,
  performance_metrics jsonb not null default '{}'::jsonb,
  superseded_by   uuid references public.coach_assets(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.coach_assets is
  'Native marketing-asset ledger (brand-coach MCP). One row per logged/produced asset; RLS-scoped to user_id = auth.uid(). Replaces the former external IV-OS ledger.';

-- Idempotency: at most one asset per (user, external_id) when an external_id is supplied,
-- so re-uploading the same history in a different format reconciles instead of duplicating.
create unique index if not exists uq_coach_assets_user_external
  on public.coach_assets (user_id, external_id) where external_id is not null;
create index if not exists idx_coach_assets_user_created
  on public.coach_assets (user_id, created_at desc);
create index if not exists idx_coach_assets_user_status
  on public.coach_assets (user_id, status);

-- ── coach_asset_events (append-only history) ──────────────────────────────────
create table if not exists public.coach_asset_events (
  id              uuid primary key default gen_random_uuid(),
  asset_id        uuid not null references public.coach_assets(id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_type      text not null,                                       -- logged | status_change | assessment
  actor           text,                                                -- non-reversible caller tag
  from_status     text,
  to_status       text,
  verdict         text,                                                -- pass|needs_work|fail (assessment)
  scores          jsonb,
  summary         text,
  recommendations text,
  notes           text,
  created_at      timestamptz not null default now()
);

comment on table public.coach_asset_events is
  'Append-only change log for coach_assets: logged / status_change / assessment events. Backs get_asset_history.';

create index if not exists idx_coach_asset_events_asset
  on public.coach_asset_events (asset_id, created_at);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.coach_assets enable row level security;
alter table public.coach_asset_events enable row level security;

drop policy if exists coach_assets_select_own on public.coach_assets;
drop policy if exists coach_assets_insert_own on public.coach_assets;
drop policy if exists coach_assets_update_own on public.coach_assets;
create policy coach_assets_select_own on public.coach_assets
  for select using (user_id = auth.uid());
create policy coach_assets_insert_own on public.coach_assets
  for insert with check (user_id = auth.uid());
create policy coach_assets_update_own on public.coach_assets
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- No delete policy: the ledger is append/supersede, never hard-deleted by callers.

drop policy if exists coach_asset_events_select_own on public.coach_asset_events;
drop policy if exists coach_asset_events_insert_own on public.coach_asset_events;
create policy coach_asset_events_select_own on public.coach_asset_events
  for select using (user_id = auth.uid());
create policy coach_asset_events_insert_own on public.coach_asset_events
  for insert with check (user_id = auth.uid());

-- ── updated_at trigger ────────────────────────────────────────────────────────
create or replace function public.coach_assets_set_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_coach_assets_updated_at on public.coach_assets;
create trigger trg_coach_assets_updated_at
  before update on public.coach_assets
  for each row execute function public.coach_assets_set_updated_at();
