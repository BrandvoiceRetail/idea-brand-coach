-- Server-side free-trial gate on brand_assets inserts.
--
-- The UI (V4Fix) and service layer (fixService.addPiece) already hold a non-member
-- to ONE funnel piece, but those are bypassable by calling the DB directly. This
-- trigger enforces the same limit at the source so the trial is a real boundary.
--
-- Mirrors src/lib/entitlement.ts: a "member" is a user with an active/trialing row
-- in user_subscriptions; FREE_TRIAL_PIECE_LIMIT = 1 distinct touchpoint per brand.
--
-- Rules:
--   • Re-versioning an EXISTING piece (same touchpoint — the supersede+re-insert
--     flow, re-audits, copy updates) is ALWAYS allowed, even for a brand that is
--     already over the limit from before this gate existed (grandfathered rows).
--   • Only a NET-NEW touchpoint that would push a non-member brand past the limit
--     is blocked.
--   • Members are unlimited. Non-user contexts (service-role / migrations / seed,
--     where auth.uid() is null) bypass — the gate is for end-user inserts.
--
-- SECURITY DEFINER so the membership read + the brand-wide piece count see through
-- RLS (the count must consider all of the brand's pieces, not just the caller's
-- row-visible subset).

create or replace function public.enforce_trial_piece_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand_id uuid;
  v_owner uuid;
  v_member boolean;
  v_is_reversion boolean;
  v_distinct int;
begin
  -- Enforce only for real end-user inserts; service-role / seed / migrations bypass.
  if auth.uid() is null then
    return new;
  end if;

  -- Resolve the brand order-independently (works whether brand_id is set directly
  -- or only via the avatar, regardless of trigger order vs trg_sync_brand_id).
  v_brand_id := new.brand_id;
  if v_brand_id is null and new.avatar_id is not null then
    select brand_id into v_brand_id from public.avatars where id = new.avatar_id;
  end if;
  if v_brand_id is null then
    return new; -- unscoped insert; leave to other constraints
  end if;

  -- Members are unlimited.
  select user_id into v_owner from public.brands where id = v_brand_id;
  select exists (
    select 1 from public.user_subscriptions s
    where s.user_id = coalesce(v_owner, auth.uid())
      and s.status in ('active', 'trialing')
  ) into v_member;
  if v_member then
    return new;
  end if;

  -- Re-versioning a touchpoint that already exists on the brand is always allowed.
  select exists (
    select 1 from public.brand_assets
    where brand_id = v_brand_id
      and superseded_by is null
      and touchpoint_id = new.touchpoint_id
  ) into v_is_reversion;
  if v_is_reversion then
    return new;
  end if;

  -- Net-new touchpoint: block if the brand already has the trial limit of pieces.
  select count(distinct touchpoint_id) into v_distinct
  from public.brand_assets
  where brand_id = v_brand_id
    and superseded_by is null;

  if v_distinct >= 1 then  -- FREE_TRIAL_PIECE_LIMIT
    raise exception
      'trial_piece_limit: your free trial covers one funnel piece; become a member to map your whole funnel'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- Runs alongside trg_sync_brand_id (BEFORE INSERT). Name sorts after it, and the
-- function resolves brand_id itself, so ordering is not load-bearing.
drop trigger if exists trg_trial_piece_limit on public.brand_assets;
create trigger trg_trial_piece_limit
  before insert on public.brand_assets
  for each row execute function public.enforce_trial_piece_limit();
