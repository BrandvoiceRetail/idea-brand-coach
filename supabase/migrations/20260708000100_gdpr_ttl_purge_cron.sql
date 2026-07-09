-- GDPR Art. 5(1)(e) storage limitation: the TTL columns existed but nothing
-- ever deleted expired rows, so "cached until expires_at" silently became
-- "kept forever". Nightly purge of:
--   - competitor_asin_cache: scraped Amazon listing/review payloads (may quote
--     third-party reviewers) past their TTL
--   - scrape_rate_usage: pseudonymous per-user rate buckets past their TTL
-- pg_cron is already in use (scrape-drain-safety-net).

select cron.schedule(
  'gdpr-ttl-purge',
  '17 3 * * *',
  $$
    delete from public.competitor_asin_cache where expires_at < now();
    delete from public.scrape_rate_usage where expires_at < now();
  $$
);
