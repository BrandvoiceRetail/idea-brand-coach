-- Durable async queue for bulk review scraping. A job = one bulk_ingest_evidence
-- submission; items = one URL each. Users own their rows (RLS); the worker drains via
-- service-role. Status: queued/running/done/failed (job); pending/processing/done/failed (item).
create table if not exists public.scrape_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null default 'queued',
  total integer not null default 0,
  done integer not null default 0,
  failed integer not null default 0,
  marketplace text,
  product_id text,
  avatar_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scrape_job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.scrape_jobs(id) on delete cascade,
  user_id uuid not null,
  asin text,
  url text not null,
  status text not null default 'pending',
  reviews_count integer not null default 0,
  error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_scrape_jobs_user on public.scrape_jobs (user_id, created_at desc);
create index if not exists idx_scrape_job_items_job on public.scrape_job_items (job_id);
create index if not exists idx_scrape_job_items_pending on public.scrape_job_items (created_at)
  where status = 'pending';

alter table public.scrape_jobs enable row level security;
alter table public.scrape_job_items enable row level security;

create policy scrape_jobs_select_own on public.scrape_jobs
  for select using (user_id = auth.uid());
create policy scrape_jobs_insert_own on public.scrape_jobs
  for insert with check (user_id = auth.uid());
create policy scrape_job_items_select_own on public.scrape_job_items
  for select using (user_id = auth.uid());
create policy scrape_job_items_insert_own on public.scrape_job_items
  for insert with check (user_id = auth.uid());
