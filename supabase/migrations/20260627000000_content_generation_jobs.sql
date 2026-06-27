-- Content Generation Jobs — the provider-agnostic spine for generating/updating
-- any funnel piece's content from the Brand Funnel Tracker.
--
-- One row per generation attempt, keyed by (user, avatar/brand, touchpoint). This
-- is what lets EACH piece of the funnel be generated and updated through a single
-- interface, regardless of which engine produced it:
--   * provider = 'pixii'   → async image generation (listing_builder / a_plus / scale)
--   * provider = 'claude'  → synchronous on-brand copy (e.g. email) via the in-house
--                            brand-copy-generator edge function.
--   * provider = 'palmier' → async short-form video via the LOCAL Palmier MCP app
--                            (palmier-generate); parks a ready brief when unreachable.
--   * provider = 'fal'     → async short-form video via the fal.ai cloud queue
--                            (fal-video-generate); persists the MP4 to brand-assets.
--
-- Pixii is async (~2 min) and its output URLs expire after 7 days, so the
-- pixii-generate edge function downloads completed images into the existing
-- `brand-assets` storage bucket and records their storage paths in `output`.
-- The frontend never reads this table directly — it goes through the edge
-- functions — so `src/integrations/supabase/types.ts` does not need regenerating
-- for the app to compile.

create table if not exists public.content_generation_jobs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  brand_id        uuid references public.brands(id) on delete cascade,
  avatar_id       uuid references public.avatars(id) on delete cascade,
  touchpoint_id   text not null,
  provider        text not null check (provider in ('pixii', 'claude', 'palmier', 'fal')),
  -- The specific capability used, e.g. listing_images / a_plus / main_image /
  -- scale (pixii), email_copy / generic_copy (claude), or social_video /
  -- ugc_video (fal cloud video + palmier local video). Free-text so the registry
  -- can evolve without a schema change.
  capability      text not null,
  output_kind     text not null check (output_kind in ('image', 'copy', 'video')),
  -- Pixii's job_id; null for synchronous copy generations.
  external_job_id text,
  status          text not null default 'pending'
                    check (status in ('pending', 'processing', 'completed', 'failed')),
  -- The request inputs (asin, country_code, listing_type, prompt, …) for audit/repro.
  request         jsonb not null default '{}'::jsonb,
  -- The result: { images: [{ storage_path, slot, modules? }] } or { copy, alternatives? }.
  output          jsonb,
  -- The failure, when status = 'failed': { code, message, detail? }.
  error           jsonb,
  -- Set once the user saves the generation onto a funnel piece (brand_assets row).
  brand_asset_id  uuid references public.brand_assets(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.content_generation_jobs is
  'Per-funnel-piece content generation jobs (Pixii images / Claude copy / Palmier video). The durable spine behind the Funnel Tracker generate-content interface.';

alter table public.content_generation_jobs enable row level security;

-- Owner-only. Edge functions use the service-role client and stamp user_id from
-- the verified JWT; this policy governs any direct client reads of own history.
drop policy if exists "content_generation_jobs_owner" on public.content_generation_jobs;
create policy "content_generation_jobs_owner"
  on public.content_generation_jobs
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists content_generation_jobs_scope_idx
  on public.content_generation_jobs (user_id, avatar_id, touchpoint_id, created_at desc);
create index if not exists content_generation_jobs_external_idx
  on public.content_generation_jobs (external_job_id)
  where external_job_id is not null;

-- Keep updated_at fresh on status/output transitions.
create or replace function public.touch_content_generation_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists content_generation_jobs_touch on public.content_generation_jobs;
create trigger content_generation_jobs_touch
  before update on public.content_generation_jobs
  for each row execute function public.touch_content_generation_jobs_updated_at();
