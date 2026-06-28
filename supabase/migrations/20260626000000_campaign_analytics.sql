-- Campaign + numeric-analytics + email-sequence model for the brand-coach MCP.
--
-- Closes the context gap: NO campaign entity, NO numeric analytics ingestion
-- (CTR/CVR/AOV/spend/revenue), NO email sequences. The coach must reason over real
-- numbers and NEVER fabricate metrics — honest no_data everywhere.
--
-- Four tables, all following the coach_assets template exactly:
--   campaigns         — brand-level campaign records (owner-scoped)
--   campaign_metrics  — append-only numeric store-of-record (the metrics facts)
--   email_sequences   — brand-level email-sequence records
--   email_steps       — child of email_sequences (one row per step)
--
-- RLS: every row is scoped to its owner via user_id = auth.uid(). The MCP reads/writes
-- through the per-request JWT-bound client (supabaseUser.ts), so RLS evaluates the caller
-- as auth.uid() — no service-role, no cross-user bleed. brand_id is resolved server-side
-- (resolveBrandId), never caller-supplied. ENUMs are text + CHECK constraints (matches the
-- coach_assets convention — keeps additive migrations cheap).
--
-- Conventions reused: approval_status-style vocab via CHECK, campaign_id / created_at /
-- updated_at naming, UTC timestamptz/date, updated_at maintained by the existing
-- public.coach_assets_set_updated_at() trigger function (table-agnostic: new.updated_at = now()).
--
-- DO NOT apply to prod from this worktree.

-- ── campaigns ─────────────────────────────────────────────────────────────────
create table if not exists public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  brand_id    uuid not null references public.brands(id) on delete cascade,   -- server-resolved
  name        text not null,
  channel     text not null
              check (channel in ('blog','social','email','tiktok','amazon','paid','content')),
  status      text not null default 'draft'
              check (status in ('draft','active','paused','completed')),
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.campaigns is
  'Brand-level campaign records (brand-coach MCP). RLS-scoped to user_id = auth.uid(); brand_id resolved server-side, never caller-supplied.';

create index if not exists idx_campaigns_user_status_created
  on public.campaigns (user_id, status, created_at desc);
create index if not exists idx_campaigns_brand
  on public.campaigns (brand_id);

-- ── campaign_metrics (append-only numeric store-of-record) ─────────────────────
create table if not exists public.campaign_metrics (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  channel      text not null
               check (channel in ('blog','social','email','tiktok','amazon','paid','content')),
  metric_name  text not null
               check (metric_name in (
                 'impressions','sessions','clicks','opens','ctr','cvr','aov','spend',
                 'orders','revenue','engagement','calls_booked','views')),
  metric_value numeric not null,                              -- rate metrics (ctr,cvr) stored as fractions 0–1
  funnel_stage text
               check (funnel_stage in ('visibility','clicks','orders','revenue','profitability')),
  measured_date date not null,
  granularity  text not null default 'daily'
               check (granularity in ('daily','hourly','snapshot')),
  source       text not null default 'manual'
               check (source in ('manual','spreadsheet','warehouse')),
  created_at   timestamptz not null default now()            -- no updated_at: metrics are append-only facts
);

comment on table public.campaign_metrics is
  'Append-only numeric metrics for campaigns (impressions/ctr/cvr/aov/spend/revenue/...). RLS-scoped to user_id = auth.uid(). Coach reasons over these; never fabricates absent metrics.';

create index if not exists idx_campaign_metrics_campaign_date
  on public.campaign_metrics (campaign_id, measured_date desc);
create index if not exists idx_campaign_metrics_channel_date
  on public.campaign_metrics (channel, measured_date desc);
create index if not exists idx_campaign_metrics_user
  on public.campaign_metrics (user_id, created_at desc);

-- Idempotency (re-upload safety, mirrors uq_coach_assets_user_external): one metric per
-- (campaign, metric_name, measured_date, granularity, funnel_stage). funnel_stage is nullable;
-- NULLS NOT DISTINCT (PG15+; prod is PG17) treats null stages as equal so non-funnel metrics
-- dedupe too. Plain-column key so the supabase-js upsert onConflict (which takes column NAMES,
-- not expressions) matches this index exactly — re-uploading a workbook reconciles, never dupes.
create unique index if not exists uq_campaign_metrics_natural
  on public.campaign_metrics
  (campaign_id, metric_name, measured_date, granularity, funnel_stage)
  nulls not distinct;

-- ── email_sequences ───────────────────────────────────────────────────────────
create table if not exists public.email_sequences (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  brand_id      uuid not null references public.brands(id) on delete cascade,   -- server-resolved
  campaign_id   uuid references public.campaigns(id) on delete set null,        -- nullable link
  sequence_type text not null
                check (sequence_type in (
                  'welcome','nurture','newsletter','upsell','downsell','abandoned_cart')),
  name          text not null,
  status        text not null default 'draft'
                check (status in ('draft','active','paused')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.email_sequences is
  'Brand-level email-sequence records (content + structure only; no ESP/sending in Alpha). RLS-scoped to user_id = auth.uid().';

create index if not exists idx_email_sequences_user_brand
  on public.email_sequences (user_id, brand_id);

-- ── email_steps (child of email_sequences) ─────────────────────────────────────
create table if not exists public.email_steps (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,  -- denormalised so steps are directly RLS-scoped
  sequence_id   uuid not null references public.email_sequences(id) on delete cascade,
  step_number   integer not null,                            -- 1-based ordinal
  subject       text not null,
  body          text not null,
  delay_hours   integer not null default 0,                  -- offset from prior step / trigger
  email_type    text,                                        -- freeform tag (e.g. value, offer)
  trigger_event text,                                        -- e.g. signup, cart_abandoned
  created_at    timestamptz not null default now()
);

comment on table public.email_steps is
  'Steps belonging to an email_sequence. user_id denormalised for direct RLS scoping. Unique on (sequence_id, step_number).';

create unique index if not exists uq_email_steps_seq_number
  on public.email_steps (sequence_id, step_number);
create index if not exists idx_email_steps_sequence
  on public.email_steps (sequence_id, step_number);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.campaigns        enable row level security;
alter table public.campaign_metrics enable row level security;
alter table public.email_sequences  enable row level security;
alter table public.email_steps      enable row level security;

-- campaigns: select / insert / update own (no delete — campaigns are status-driven, not hard-deleted)
drop policy if exists campaigns_select_own on public.campaigns;
drop policy if exists campaigns_insert_own on public.campaigns;
drop policy if exists campaigns_update_own on public.campaigns;
create policy campaigns_select_own on public.campaigns
  for select using (user_id = auth.uid());
create policy campaigns_insert_own on public.campaigns
  for insert with check (user_id = auth.uid());
create policy campaigns_update_own on public.campaigns
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- campaign_metrics: select + insert only (append-only facts; no update/delete policy)
drop policy if exists campaign_metrics_select_own on public.campaign_metrics;
drop policy if exists campaign_metrics_insert_own on public.campaign_metrics;
create policy campaign_metrics_select_own on public.campaign_metrics
  for select using (user_id = auth.uid());
create policy campaign_metrics_insert_own on public.campaign_metrics
  for insert with check (user_id = auth.uid());

-- email_sequences: select / insert / update own (no delete)
drop policy if exists email_sequences_select_own on public.email_sequences;
drop policy if exists email_sequences_insert_own on public.email_sequences;
drop policy if exists email_sequences_update_own on public.email_sequences;
create policy email_sequences_select_own on public.email_sequences
  for select using (user_id = auth.uid());
create policy email_sequences_insert_own on public.email_sequences
  for insert with check (user_id = auth.uid());
create policy email_sequences_update_own on public.email_sequences
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- email_steps: select / insert / update own (no delete)
drop policy if exists email_steps_select_own on public.email_steps;
drop policy if exists email_steps_insert_own on public.email_steps;
drop policy if exists email_steps_update_own on public.email_steps;
create policy email_steps_select_own on public.email_steps
  for select using (user_id = auth.uid());
create policy email_steps_insert_own on public.email_steps
  for insert with check (user_id = auth.uid());
create policy email_steps_update_own on public.email_steps
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── updated_at triggers (reuse the table-agnostic coach_assets trigger fn) ──────
drop trigger if exists trg_campaigns_updated_at on public.campaigns;
create trigger trg_campaigns_updated_at
  before update on public.campaigns
  for each row execute function public.coach_assets_set_updated_at();

drop trigger if exists trg_email_sequences_updated_at on public.email_sequences;
create trigger trg_email_sequences_updated_at
  before update on public.email_sequences
  for each row execute function public.coach_assets_set_updated_at();

-- ── grants (mirror brands / coach_assets) ──────────────────────────────────────
grant select, insert, update on public.campaigns        to authenticated;
grant select, insert         on public.campaign_metrics to authenticated;  -- append-only facts (no update/delete)
grant select, insert, update on public.email_sequences  to authenticated;
grant select, insert, update on public.email_steps      to authenticated;
