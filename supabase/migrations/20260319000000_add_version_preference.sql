-- Add version_preference column to profiles table
-- Stores user's preferred app version (v1 = Classic, v2 = Brand Coach)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS version_preference TEXT DEFAULT NULL
  CHECK (version_preference IS NULL OR version_preference IN ('v1', 'v2'));

COMMENT ON COLUMN public.profiles.version_preference IS 'User preferred app version: v1 (Classic) or v2 (Brand Coach)';
