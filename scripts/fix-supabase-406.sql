-- Fix for 406 "Not Acceptable" error
-- Run this in your Supabase SQL Editor at:
-- https://supabase.com/dashboard/project/ecdrxtbclxfpkknasmrw/sql/new

-- Step 1: Check if the table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'user_knowledge_base'
);

-- If the above returns false, run the full migration below.
-- If it returns true, skip to Step 2 to check columns.

-- Full migration (run if table doesn't exist):
-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the main user_knowledge_base table
CREATE TABLE IF NOT EXISTS public.user_knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Category & identification
    category TEXT NOT NULL CHECK (category IN ('diagnostic', 'avatar', 'insights', 'canvas', 'copy')),
    subcategory TEXT,
    field_identifier TEXT NOT NULL,

    -- Content storage
    content TEXT NOT NULL,
    structured_data JSONB,

    -- Vector embedding for semantic search (optional, generated async)
    embedding vector(1536), -- OpenAI ada-002 embeddings

    -- Metadata
    metadata JSONB,
    source_page TEXT,
    version INTEGER DEFAULT 1 NOT NULL,
    is_current BOOLEAN DEFAULT true,

    -- Sync tracking
    last_synced_at TIMESTAMP WITH TIME ZONE,
    local_changes BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_knowledge_user_id ON public.user_knowledge_base(user_id);
CREATE INDEX IF NOT EXISTS idx_user_knowledge_field_identifier ON public.user_knowledge_base(field_identifier);
CREATE INDEX IF NOT EXISTS idx_user_knowledge_user_field ON public.user_knowledge_base(user_id, field_identifier);
CREATE INDEX IF NOT EXISTS idx_user_knowledge_user_category ON public.user_knowledge_base(user_id, category);
CREATE INDEX IF NOT EXISTS idx_user_knowledge_is_current ON public.user_knowledge_base(is_current);
CREATE INDEX IF NOT EXISTS idx_user_knowledge_user_current ON public.user_knowledge_base(user_id, is_current);

-- Row Level Security (RLS)
ALTER TABLE public.user_knowledge_base ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own knowledge entries
CREATE POLICY "Users can view own knowledge" ON public.user_knowledge_base
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own knowledge entries
CREATE POLICY "Users can insert own knowledge" ON public.user_knowledge_base
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own knowledge entries
CREATE POLICY "Users can update own knowledge" ON public.user_knowledge_base
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own knowledge entries (soft delete via is_current flag recommended)
CREATE POLICY "Users can delete own knowledge" ON public.user_knowledge_base
    FOR DELETE
    USING (auth.uid() = user_id);

-- Step 2: Verify columns exist
-- Check that all required columns are present
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'user_knowledge_base'
ORDER BY ordinal_position;

-- Step 3: Test the table with a simple query
-- Replace 'YOUR_USER_ID' with your actual user ID from auth.users
SELECT * FROM public.user_knowledge_base
WHERE user_id = 'd5868b7d-11aa-4c3b-b19b-28853d5d5923'
LIMIT 5;

-- Step 4: If you still get 406 errors after this, check RLS is enabled
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM
    pg_tables
WHERE
    schemaname = 'public'
    AND tablename = 'user_knowledge_base';

-- If rowsecurity is false, enable it:
-- ALTER TABLE public.user_knowledge_base ENABLE ROW LEVEL SECURITY;