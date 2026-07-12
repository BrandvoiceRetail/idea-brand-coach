-- Atomically claim up to p_limit pending items (SKIP LOCKED → parallel drainers grab
-- disjoint sets). Returns the claimed rows, now marked 'processing'.
create or replace function public.claim_scrape_items(p_limit integer)
returns setof public.scrape_job_items
language sql
security definer
set search_path = public
as $$
  update public.scrape_job_items
  set status = 'processing', attempts = attempts + 1, updated_at = now()
  where id in (
    select id from public.scrape_job_items
    where status = 'pending'
    order by created_at
    limit greatest(1, p_limit)
    for update skip locked
  )
  returning *;
$$;

-- Recompute a job's counts + status from its items (called after a drain batch).
create or replace function public.refresh_scrape_job(p_job uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.scrape_jobs j set
    done   = (select count(*) from public.scrape_job_items where job_id = p_job and status = 'done'),
    failed = (select count(*) from public.scrape_job_items where job_id = p_job and status = 'failed'),
    status = case
      when exists (select 1 from public.scrape_job_items where job_id = p_job and status in ('pending','processing')) then 'running'
      when (select count(*) from public.scrape_job_items where job_id = p_job and status = 'failed') > 0
           and (select count(*) from public.scrape_job_items where job_id = p_job and status = 'done') = 0 then 'failed'
      else 'done'
    end,
    updated_at = now()
  where j.id = p_job;
$$;

revoke all on function public.claim_scrape_items(integer) from public, anon, authenticated;
revoke all on function public.refresh_scrape_job(uuid) from public, anon, authenticated;
