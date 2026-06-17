-- Add 'failed' so a failed audit is a visible state (not a silent 'pending').
ALTER TABLE public.brand_assets DROP CONSTRAINT IF EXISTS brand_assets_status_check;
ALTER TABLE public.brand_assets
  ADD CONSTRAINT brand_assets_status_check
  CHECK (status IN ('pending','aligned','stale','misaligned','missing','failed'));
