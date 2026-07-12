-- PPC capability (WS1): first-party per-seller search-term storage + a total-sales metric.
--
-- WHY: campaign_metrics stops at brand_asset_id × channel × metric_name — there is no
-- keyword/search-term grain, so search-term harvesting / negation and per-keyword ACOS are
-- impossible. And TACoS (ad spend ÷ TOTAL organic+paid sales) was un-derivable because only
-- ad-attributed `revenue` is stored. This migration adds:
--   1) ad_search_terms — the seller's OWN Amazon Ads search-term report grain (per-seller,
--      pulled host-side through Windsor amazon_ads, source='windsor'; same host-driven pattern
--      as campaign_metrics). Restatable data (Amazon revises terms), so upsert-on-conflict.
--   2) campaign_metrics.metric_name gains `total_sales` (SP-API/Seller-Central total sales per
--      period) so TACoS = spend ÷ total_sales becomes derivable at read time.
--
-- Additive + reversible. RLS-scoped to user_id = auth.uid(); registered in _shared/gdprData.ts.
-- DO NOT apply to prod from this worktree.

-- ── 1. total_sales metric (for TACoS) ──────────────────────────────────────────
alter table public.campaign_metrics
  drop constraint if exists campaign_metrics_metric_name_check;
alter table public.campaign_metrics
  add constraint campaign_metrics_metric_name_check
    check (metric_name in (
      'impressions','sessions','clicks','opens','ctr','cvr','aov','spend',
      'orders','revenue','engagement','calls_booked','views',
      'new_to_brand','repeat_rate','return_rate','units_sold','subscribe_save',
      -- total (organic + paid) sales per period — enables TACoS = spend / total_sales
      'total_sales'));

-- ── 2. ad_search_terms (the seller's own search-term report grain) ─────────────
create table if not exists public.ad_search_terms (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  brand_id       uuid references public.brands(id) on delete cascade,          -- server-resolved, nullable
  brand_asset_id uuid references public.brand_assets(id) on delete cascade,    -- the funnel piece / listing, nullable
  campaign_id    uuid references public.campaigns(id) on delete set null,      -- nullable
  search_term    text not null,
  match_type     text not null default 'unknown'
                 check (match_type in ('exact','phrase','broad','auto','unknown')),
  measured_date  date not null,
  impressions    numeric not null default 0,
  clicks         numeric not null default 0,
  spend          numeric not null default 0,                                   -- currency, seller's own
  orders         numeric not null default 0,
  sales          numeric not null default 0,                                   -- ad-attributed sales for the term
  source         text not null default 'windsor'
                 check (source in ('manual','spreadsheet','warehouse','windsor')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.ad_search_terms is
  'Per-seller Amazon Ads SEARCH-TERM report rows (first-party; pulled host-side via Windsor amazon_ads). RLS-scoped to user_id = auth.uid(). Feeds run_ppc_audit (harvest/negate + per-keyword ACOS). Restatable — upserted on the natural key.';

create index if not exists idx_ad_search_terms_asset_date
  on public.ad_search_terms (brand_asset_id, measured_date desc);
create index if not exists idx_ad_search_terms_user
  on public.ad_search_terms (user_id, measured_date desc);
create index if not exists idx_ad_search_terms_term
  on public.ad_search_terms (user_id, search_term);

-- Idempotent re-ingest: one row per (user, piece, campaign, term, match, date). campaign_id +
-- brand_asset_id are nullable → NULLS NOT DISTINCT (PG15+; prod PG17) so null-scoped rows dedupe.
-- user_id is IN the key because campaign_id is nullable (unlike campaign_metrics, whose non-null
-- campaign_id implicitly scopes to the owner) — without it, two sellers' null-scoped rows collide.
create unique index if not exists uq_ad_search_terms_natural
  on public.ad_search_terms
  (user_id, brand_asset_id, campaign_id, search_term, match_type, measured_date)
  nulls not distinct;

-- ── cross-user FK-attribution firewall (defense in depth, mirrors campaign_metrics) ──
-- brand_assets has NO user_id; ownership is brand_assets.brand_id -> brands.user_id. The RLS
-- INSERT policy only checks user_id = auth.uid(), NOT that an attached brand_asset_id is the
-- caller's. This trigger enforces it independently of the app-layer requireOwnedBrandAssets gate.
create or replace function public.ad_search_terms_brand_asset_owner_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.brand_asset_id is not null
     and not exists (
       select 1
       from public.brand_assets ba
       join public.brands b on b.id = ba.brand_id
       where ba.id = new.brand_asset_id
         and b.user_id = new.user_id
     ) then
    raise exception 'brand_asset_id % is not owned by user %', new.brand_asset_id, new.user_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ad_search_terms_brand_asset_owner on public.ad_search_terms;
create trigger trg_ad_search_terms_brand_asset_owner
  before insert or update of brand_asset_id, user_id on public.ad_search_terms
  for each row execute function public.ad_search_terms_brand_asset_owner_guard();

-- ── RLS: select / insert / update own (upsert needs update — search terms are restatable) ──
alter table public.ad_search_terms enable row level security;
drop policy if exists ad_search_terms_select_own on public.ad_search_terms;
drop policy if exists ad_search_terms_insert_own on public.ad_search_terms;
drop policy if exists ad_search_terms_update_own on public.ad_search_terms;
create policy ad_search_terms_select_own on public.ad_search_terms
  for select using (user_id = auth.uid());
create policy ad_search_terms_insert_own on public.ad_search_terms
  for insert with check (user_id = auth.uid());
create policy ad_search_terms_update_own on public.ad_search_terms
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update on public.ad_search_terms to authenticated;
