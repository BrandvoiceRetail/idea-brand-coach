-- Cross-tenant scrape rate limiter for the Firecrawl chokepoint (review-scraper).
-- Counts only ACTUAL Firecrawl fetches (cache hits are free). Service-role-only, like
-- competitor_asin_cache. Buckets self-expire by period-scoped key; expires_at drives cleanup.
create table if not exists public.scrape_rate_usage (
  bucket text primary key,
  count integer not null default 0,
  expires_at timestamptz not null
);
alter table public.scrape_rate_usage enable row level security;  -- no policies → service-role only
create index if not exists idx_scrape_rate_usage_expires on public.scrape_rate_usage (expires_at);

-- Atomically consume ONE fetch unit against three caps (per-user/day, global/day = budget
-- ceiling, global/60s-window = burst/concurrency ceiling). Increment-then-check, fail-closed:
-- a denied request still consumes, so a sustained overage keeps the breaker open until the
-- window/day rolls. Counts are a cost guard, not a to-the-cent ledger.
create or replace function public.consume_scrape_quota(
  p_user uuid,
  p_user_daily_max integer,
  p_global_daily_max integer,
  p_global_window_max integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day  text := to_char((now() at time zone 'utc'), 'YYYY-MM-DD');
  v_win  text := floor(extract(epoch from now()) / 60)::bigint::text;  -- 60s window
  v_day_exp timestamptz := date_trunc('day', now()) + interval '2 days';
  v_user_ct integer;
  v_gday_ct integer;
  v_gwin_ct integer;
begin
  insert into scrape_rate_usage (bucket, count, expires_at)
    values ('user:' || coalesce(p_user::text, 'anon') || ':' || v_day, 1, v_day_exp)
    on conflict (bucket) do update set count = scrape_rate_usage.count + 1
    returning count into v_user_ct;

  insert into scrape_rate_usage (bucket, count, expires_at)
    values ('global:' || v_day, 1, v_day_exp)
    on conflict (bucket) do update set count = scrape_rate_usage.count + 1
    returning count into v_gday_ct;

  insert into scrape_rate_usage (bucket, count, expires_at)
    values ('gwin:' || v_win, 1, now() + interval '5 minutes')
    on conflict (bucket) do update set count = scrape_rate_usage.count + 1
    returning count into v_gwin_ct;

  if v_user_ct > p_user_daily_max then
    return jsonb_build_object('allowed', false, 'reason', 'per-user daily scrape limit reached');
  elsif v_gday_ct > p_global_daily_max then
    return jsonb_build_object('allowed', false, 'reason', 'global daily scrape budget reached');
  elsif v_gwin_ct > p_global_window_max then
    return jsonb_build_object('allowed', false, 'reason', 'scrape rate limit — try again shortly');
  end if;
  return jsonb_build_object('allowed', true);
end;
$$;

revoke all on function public.consume_scrape_quota(uuid, integer, integer, integer) from public;
revoke all on function public.consume_scrape_quota(uuid, integer, integer, integer) from anon, authenticated;
