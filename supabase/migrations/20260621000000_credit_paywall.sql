-- Credit-metered paywall — foundation (Step 1 of docs/PAYWALL_CREDIT_METERING_DESIGN.md).
--
-- DARK + ADDITIVE + REVERSIBLE: 4 new tables + 2 RPCs. No app code references these yet and both
-- paywall flags ship OFF, so this changes nothing for current users or testers. Credits can ONLY be
-- written by the SECURITY DEFINER RPCs (granted to service_role); users may read only their own rows.
--
-- Cost model: 1 credit is backed by COST_PER_CREDIT_USD = $0.004 of raw model cost.
--   creditsDebited(op) = max(1, ceil( rawCostUSD / 0.004 ))
--   rawCostUSD = (input_tokens*inRate + output_tokens*outRate) / 1e6,  rates per model in model_rates.
--
-- APPLIED TO LIVE (project ecdrxtbclxfpkknasmrw) 2026-06-21 and recorded in schema_migrations.
-- VERIFIED live: debit math (Sonnet 6k/1k→9, Haiku 2k/0.5k→2, unknown→sonnet fallback, min-1 floor),
-- grant idempotency (dup stripe_event_id no-ops, 1 ledger row), ledger SUM(delta)==balance,
-- RLS read-own, EXECUTE granted to service_role only (anon/authenticated denied).

-- ── 1. model_rates — per-model token pricing (authoritative; editable without redeploy) ──────────────
create table if not exists public.model_rates (
  model               text primary key,
  input_per_mtok_usd  numeric(10,4) not null check (input_per_mtok_usd  >= 0),
  output_per_mtok_usd numeric(10,4) not null check (output_per_mtok_usd >= 0),
  updated_at          timestamptz   not null default now()
);
comment on table public.model_rates is 'Per-model Anthropic token rates (USD per million tokens). Keyed by short family; the meter util maps a full model id to a family. Verify against live billing.';

insert into public.model_rates (model, input_per_mtok_usd, output_per_mtok_usd) values
  ('haiku',  1.00,  5.00),
  ('sonnet', 3.00, 15.00),
  ('opus',  15.00, 75.00)
on conflict (model) do nothing;

-- ── 2. user_subscriptions — which tier a user is on (one row per user) ────────────────────────────────
create table if not exists public.user_subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  tier                   text not null check (tier in ('starter','pro','studio','scale')),
  status                 text not null default 'active' check (status in ('active','trialing','past_due','canceled')),
  interval               text not null default 'month'  check (interval in ('month','year')),
  stripe_customer_id     text,
  stripe_subscription_id text,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
comment on table public.user_subscriptions is 'Stripe subscription state per user. Written only by the stripe-webhook (service_role).';

-- ── 3. credit_wallets — cached balance (truth = SUM(ledger); kept atomic by the RPCs) ─────────────────
create table if not exists public.credit_wallets (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  balance    integer not null default 0,
  updated_at timestamptz not null default now()
);
comment on table public.credit_wallets is 'Cached credit balance. Balance may briefly go slightly negative (bounded by one op) before lockout. Written only by grant_credits/debit_credits.';

-- ── 4. credit_ledger — append-only; every grant (+) and debit (-) ─────────────────────────────────────
create table if not exists public.credit_ledger (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  delta         integer not null,                                  -- +grant / -debit
  reason        text not null check (reason in ('grant','debit','refund','adjustment')),
  op_name       text,
  model         text,
  input_tokens  integer,
  output_tokens integer,
  raw_cost_usd  numeric(12,6),
  stripe_event_id text,                                            -- set on grants → webhook idempotency
  balance_after integer not null,
  created_at    timestamptz not null default now()
);
comment on table public.credit_ledger is 'Append-only credit ledger. SUM(delta) per user reconciles credit_wallets.balance.';

create unique index if not exists credit_ledger_stripe_event_uidx
  on public.credit_ledger (stripe_event_id) where stripe_event_id is not null;
create index if not exists credit_ledger_user_created_idx
  on public.credit_ledger (user_id, created_at desc);

-- ── RLS: read-own; NO client write policy (only the SECURITY DEFINER RPCs / service_role write) ───────
alter table public.model_rates        enable row level security;  -- no policy → service_role only
alter table public.user_subscriptions enable row level security;
alter table public.credit_wallets     enable row level security;
alter table public.credit_ledger      enable row level security;

drop policy if exists "own subscription read" on public.user_subscriptions;
drop policy if exists "own wallet read"       on public.credit_wallets;
drop policy if exists "own ledger read"       on public.credit_ledger;
create policy "own subscription read" on public.user_subscriptions for select using (auth.uid() = user_id);
create policy "own wallet read"       on public.credit_wallets      for select using (auth.uid() = user_id);
create policy "own ledger read"       on public.credit_ledger       for select using (auth.uid() = user_id);

-- ── 5. grant_credits — idempotent on stripe_event_id; called by the Stripe webhook (service_role) ─────
-- p_set_to_allotment=true  → refill balance to p_credits (use-it-or-lose-it cycle).
-- p_set_to_allotment=false → additive top-up (balance + p_credits).
-- The ledger records the REAL delta so SUM(delta) stays equal to balance.
create or replace function public.grant_credits(
  p_user             uuid,
  p_credits          integer,
  p_reason           text    default 'grant',
  p_stripe_event_id  text    default null,
  p_set_to_allotment boolean default true
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old integer;
  v_new integer;
begin
  if p_credits < 0 then raise exception 'grant_credits: p_credits must be >= 0'; end if;

  -- Lock the wallet row if present (serialises concurrent grants); coalesce to 0 if new.
  select balance into v_old from public.credit_wallets where user_id = p_user for update;
  v_old := coalesce(v_old, 0);
  v_new := case when p_set_to_allotment then p_credits else v_old + p_credits end;

  insert into public.credit_wallets (user_id, balance, updated_at)
    values (p_user, v_new, now())
  on conflict (user_id) do update set balance = v_new, updated_at = now();

  -- Unique(stripe_event_id) makes a duplicate webhook abort here → the whole function rolls back.
  insert into public.credit_ledger (user_id, delta, reason, stripe_event_id, balance_after)
    values (p_user, v_new - v_old, p_reason, p_stripe_event_id, v_new);

  return v_new;
exception when unique_violation then
  -- Duplicate stripe_event_id: the wallet change above is rolled back; return the committed balance.
  select coalesce(balance, 0) into v_new from public.credit_wallets where user_id = p_user;
  return coalesce(v_new, 0);
end;
$$;

-- ── 6. debit_credits — meter a paid op against actual token usage; atomic, race-safe ──────────────────
-- Returns {credits, balance, raw_cost_usd, locked}. Debits even past zero (bounded by one op); the
-- server-side gate (assertCredits, edge fn) decides whether to START an op. Unknown model → sonnet
-- fallback so a metering miss never breaks the user's feature.
create or replace function public.debit_credits(
  p_user    uuid,
  p_op      text,
  p_model   text,
  p_in_tok  integer,
  p_out_tok integer
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  c_cost_per_credit constant numeric := 0.004;  -- 1 credit = $0.004 of raw model cost
  v_in_rate  numeric;
  v_out_rate numeric;
  v_raw      numeric;
  v_credits  integer;
  v_new      integer;
begin
  if p_in_tok < 0 or p_out_tok < 0 then raise exception 'debit_credits: tokens must be >= 0'; end if;

  select input_per_mtok_usd, output_per_mtok_usd into v_in_rate, v_out_rate
    from public.model_rates where model = p_model;
  if v_in_rate is null then  -- unknown model → fall back to sonnet (don't break the op)
    select input_per_mtok_usd, output_per_mtok_usd into v_in_rate, v_out_rate
      from public.model_rates where model = 'sonnet';
  end if;
  if v_in_rate is null then raise exception 'debit_credits: no rate for % and no sonnet fallback', p_model; end if;

  v_raw     := (p_in_tok::numeric * v_in_rate + p_out_tok::numeric * v_out_rate) / 1000000.0;
  v_credits := greatest(1, ceil(v_raw / c_cost_per_credit))::integer;

  insert into public.credit_wallets (user_id, balance, updated_at) values (p_user, 0, now())
    on conflict (user_id) do nothing;
  -- Atomic decrement (single statement = race-safe; concurrent debits serialise on the row).
  update public.credit_wallets set balance = balance - v_credits, updated_at = now()
    where user_id = p_user returning balance into v_new;

  insert into public.credit_ledger
    (user_id, delta, reason, op_name, model, input_tokens, output_tokens, raw_cost_usd, balance_after)
    values (p_user, -v_credits, 'debit', p_op, p_model, p_in_tok, p_out_tok, v_raw, v_new);

  return json_build_object('credits', v_credits, 'balance', v_new, 'raw_cost_usd', v_raw, 'locked', v_new <= 0);
end;
$$;

-- ── 7. Lock down execute: ONLY service_role may call the credit RPCs (never anon/authenticated) ───────
revoke all on function public.grant_credits(uuid, integer, text, text, boolean) from public, anon, authenticated;
revoke all on function public.debit_credits(uuid, text, text, integer, integer)  from public, anon, authenticated;
grant execute on function public.grant_credits(uuid, integer, text, text, boolean) to service_role;
grant execute on function public.debit_credits(uuid, text, text, integer, integer)  to service_role;
