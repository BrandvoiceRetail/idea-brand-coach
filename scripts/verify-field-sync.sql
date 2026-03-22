-- Verify Field Sync Setup
-- Run this in Supabase SQL Editor to check if everything is ready

-- 1. Check if avatar_field_values table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'avatar_field_values'
) as table_exists;

-- 2. Check table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'avatar_field_values'
ORDER BY ordinal_position;

-- 3. Check RLS policies
SELECT policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'avatar_field_values';

-- 4. Check if current user has an avatar
SELECT
    a.id as avatar_id,
    a.name as avatar_name,
    a.created_at,
    COUNT(afv.id) as field_count
FROM avatars a
LEFT JOIN avatar_field_values afv ON a.id = afv.avatar_id
WHERE a.user_id = auth.uid()
GROUP BY a.id, a.name, a.created_at
ORDER BY a.created_at DESC;

-- 5. View any existing field values
SELECT
    field_id,
    field_value,
    field_source,
    is_locked,
    updated_at
FROM avatar_field_values
WHERE avatar_id IN (
    SELECT id FROM avatars WHERE user_id = auth.uid()
)
ORDER BY updated_at DESC
LIMIT 20;

-- 6. Clean up duplicate avatars (if needed - uncomment to run)
-- DELETE FROM avatars
-- WHERE user_id = auth.uid()
-- AND id NOT IN (
--     SELECT MIN(id)
--     FROM avatars
--     WHERE user_id = auth.uid()
-- );