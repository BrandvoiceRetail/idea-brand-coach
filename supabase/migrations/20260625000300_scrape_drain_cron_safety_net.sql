-- pg_cron safety-net for the bulk review-scrape drainer: periodically resume a stalled
-- drain (e.g. it backed off on a rate limit and no user is nudging it). NOTE: the
-- drain-only secret ('drain_cron_secret') is created out-of-band via vault.create_secret
-- (it is NOT in this migration — secrets never live in git). The worker reads the same
-- value from its DRAIN_CRON_SECRET env. process-scrape-jobs is deployed verify_jwt=false
-- (config.toml) so this hex secret reaches the fn's own auth gate instead of the platform.
create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function public.kick_scrape_drain()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_url text := 'https://ecdrxtbclxfpkknasmrw.supabase.co/functions/v1/process-scrape-jobs';
begin
  if not exists (select 1 from public.scrape_job_items where status = 'pending') then
    return;  -- nothing to do → no HTTP call
  end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'drain_cron_secret' limit 1;
  if v_secret is null then
    return;  -- no secret configured → no-op
  end if;
  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret)
  );
end;
$$;

revoke all on function public.kick_scrape_drain() from public, anon, authenticated;

-- Every 3 minutes; a no-op (no HTTP) whenever the queue has no pending items.
select cron.schedule('scrape-drain-safety-net', '*/3 * * * *', $$select public.kick_scrape_drain()$$);
