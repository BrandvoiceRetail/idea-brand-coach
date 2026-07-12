-- Stamp the EXPERIMENT-LIFECYCLE milestone dates the tester journey needs onto
-- public.brand_tests. brand_tests already stores status (draft|running|won|no_lift|
-- completed|inconclusive) + baseline/result, but NOT the dates that start the
-- re-measure clock and form the case-study record:
--   * asset_created_at — when the split-test ASSET was produced (IDEA → ASSET_CREATED).
--   * asset_live_at    — when the asset went LIVE (ASSET_LIVE) — this date starts the
--                        re-measure clock.
-- The lifecycle is IDEA (the row exists) → ASSET_CREATED → ASSET_LIVE; a NULL column
-- means that milestone has not been reached yet.
--
-- Additive + reversible (drop the two columns to undo). RLS unchanged: brand_tests is
-- already owner-scoped (asset_id → brand_assets → avatars → user), so these columns are
-- read/written only by the owning caller under the existing policies.
--
-- DO NOT apply to prod from this worktree.

alter table public.brand_tests
  add column if not exists asset_created_at timestamptz null,
  add column if not exists asset_live_at timestamptz null;

comment on column public.brand_tests.asset_created_at is
  'When the split-test asset was produced (IDEA → ASSET_CREATED milestone). NULL = not reached.';
comment on column public.brand_tests.asset_live_at is
  'When the split-test asset went live (ASSET_LIVE milestone) — starts the re-measure clock. NULL = not reached.';
