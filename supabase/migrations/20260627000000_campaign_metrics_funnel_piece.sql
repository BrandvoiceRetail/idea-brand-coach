-- Attach campaign_metrics to the FUNNEL PIECE (decision #1: a funnel piece = a campaign =
-- an active brand asset — ONE entity that traffic moves through; metrics attach to THAT
-- brand_asset). Closes the gap: campaign_metrics had NO link to a funnel piece, and its
-- funnel_stage enum (channel purchase funnel: visibility|clicks|orders|revenue|profitability)
-- is NOT brand_assets.stage (the customer journey: awareness…advocacy). This migration adds
-- the brand_asset link + a customer-journey stage so the coach can show "metrics at each piece".
--
-- Additive + reversible. RLS already scopes campaign_metrics by user_id = auth.uid(); the new
-- brand_asset_id is owner-scoped through that same policy (no policy change needed — a caller can
-- only attach metrics to a brand_asset they own because the metric row itself is theirs).
--
-- DO NOT apply to prod from this worktree.

-- ── funnel-piece link + customer-journey stage ─────────────────────────────────
alter table public.campaign_metrics
  add column if not exists brand_asset_id uuid
    references public.brand_assets(id) on delete cascade,           -- the funnel piece (decision #1)
  add column if not exists journey_stage text
    check (journey_stage in
      ('awareness','consideration','purchase_decision','retention','advocacy'));  -- brand_assets.stage vocab

comment on column public.campaign_metrics.brand_asset_id is
  'The funnel piece (public.brand_assets) this metric measures. Decision #1: a funnel piece = a campaign = an active brand asset — one entity; metrics attach here. Nullable (brand/campaign-level metrics have no piece).';
comment on column public.campaign_metrics.journey_stage is
  'Customer-journey stage of the funnel piece (awareness|consideration|purchase_decision|retention|advocacy) — mirrors brand_assets.stage. Distinct from funnel_stage (the channel purchase funnel).';

-- ── windsor source (host-Claude reads Windsor get_data, then calls Brand Coach ingest) ──
alter table public.campaign_metrics
  drop constraint if exists campaign_metrics_source_check;
alter table public.campaign_metrics
  add constraint campaign_metrics_source_check
    check (source in ('manual','spreadsheet','warehouse','windsor'));

-- ── index: one piece's metrics, newest first ───────────────────────────────────
create index if not exists idx_campaign_metrics_brand_asset_date
  on public.campaign_metrics (brand_asset_id, measured_date desc);

-- ── cross-user FK-attribution firewall (defense in depth) ──────────────────────
-- The campaign_metrics INSERT/UPDATE RLS policy only checks user_id = auth.uid();
-- it does NOT verify the attached brand_asset_id belongs to the same user. A caller
-- with a valid JWT hitting PostgREST directly could otherwise attach metrics to a
-- FOREIGN user's brand_asset (an integrity violation, and the ON DELETE CASCADE means
-- that user deleting their asset would wipe the attacker's rows). This trigger enforces
-- that brand_asset_id (when set) is owned by the inserting user — independent of the
-- app-layer requireOwnedBrandAssets() gate. Reversible: drop the trigger + function.
create or replace function public.campaign_metrics_brand_asset_owner_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- brand_assets has NO user_id column; ownership is brand_assets.brand_id -> brands.user_id.
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

drop trigger if exists trg_campaign_metrics_brand_asset_owner on public.campaign_metrics;
create trigger trg_campaign_metrics_brand_asset_owner
  before insert or update of brand_asset_id, user_id on public.campaign_metrics
  for each row execute function public.campaign_metrics_brand_asset_owner_guard();

-- ── extend the natural-key for clean per-piece upserts ─────────────────────────
-- Adds brand_asset_id so a piece's metric reconciles on re-upload rather than duping. Keep
-- NULLS NOT DISTINCT (PG15+; prod PG17) so null brand_asset_id / funnel_stage rows still dedupe.
-- Plain-column key so supabase-js upsert onConflict (column NAMES) matches exactly. The conflict
-- target constant in campaignTypes.ts (CAMPAIGN_METRICS_CONFLICT_TARGET) is updated in lockstep.
drop index if exists public.uq_campaign_metrics_natural;
create unique index if not exists uq_campaign_metrics_natural
  on public.campaign_metrics
  (campaign_id, brand_asset_id, metric_name, measured_date, granularity, funnel_stage)
  nulls not distinct;
