-- Diagnostic script for 406 error
-- Run this in Supabase SQL Editor to diagnose the issue

-- 1. Check table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'user_knowledge_base'
ORDER BY ordinal_position;

-- 2. Check if RLS is enabled
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM
    pg_tables
WHERE
    schemaname = 'public'
    AND tablename = 'user_knowledge_base';

-- 3. Check existing policies
SELECT
    pol.polname as policy_name,
    pol.polcmd as command,
    pol.polroles::text as roles,
    CASE
        WHEN pol.polpermissive THEN 'PERMISSIVE'
        ELSE 'RESTRICTIVE'
    END as type
FROM pg_policy pol
JOIN pg_class cls ON pol.polrelid = cls.oid
JOIN pg_namespace nsp ON cls.relnamespace = nsp.oid
WHERE nsp.nspname = 'public'
AND cls.relname = 'user_knowledge_base';

-- 4. Test a simple INSERT (replace with your actual user ID)
-- This will help identify if the issue is with INSERT permissions
INSERT INTO public.user_knowledge_base (
    user_id,
    category,
    field_identifier,
    content,
    is_current
) VALUES (
    auth.uid(),  -- Uses current authenticated user
    'avatar',
    'test_field_' || NOW()::text,
    'Test content',
    true
);

-- 5. Test a simple SELECT
-- This tests if SELECT works properly
SELECT
    id,
    user_id,
    field_identifier,
    content,
    category,
    is_current
FROM public.user_knowledge_base
WHERE user_id = auth.uid()
LIMIT 5;

-- 6. Check if auth.uid() returns a value
SELECT auth.uid() as current_user_id;

-- 7. Check for any existing data
SELECT COUNT(*) as total_records
FROM public.user_knowledge_base;

-- 8. Try the exact query that's failing (from the error log)
-- This replicates what the app is trying to do
SELECT content
FROM public.user_knowledge_base
WHERE user_id = 'd5868b7d-11aa-4c3b-b19b-28853d5d5923'
AND field_identifier = 'avatar_name'
AND is_current = true;

-- 9. Check if the user exists in auth.users
SELECT id, email
FROM auth.users
WHERE id = 'd5868b7d-11aa-4c3b-b19b-28853d5d5923';

-- 10. IMPORTANT: Check if there are any API restrictions
-- The 406 error might be from PostgREST configuration
SELECT * FROM pg_settings WHERE name LIKE '%pgrst%';