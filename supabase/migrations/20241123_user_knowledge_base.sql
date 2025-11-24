-- Migration: Create user_knowledge_base table for local-first architecture
-- Created: 2024-11-23
-- Description: Stores user knowledge entries with support for versioning, syncing, and vector embeddings

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
CREATE INDEX idx_user_knowledge_user_id ON public.user_knowledge_base(user_id);
CREATE INDEX idx_user_knowledge_field_identifier ON public.user_knowledge_base(field_identifier);
CREATE INDEX idx_user_knowledge_user_field ON public.user_knowledge_base(user_id, field_identifier);
CREATE INDEX idx_user_knowledge_user_category ON public.user_knowledge_base(user_id, category);
CREATE INDEX idx_user_knowledge_is_current ON public.user_knowledge_base(is_current);
CREATE INDEX idx_user_knowledge_user_current ON public.user_knowledge_base(user_id, is_current);

-- Create vector similarity search index (for RAG)
CREATE INDEX idx_user_knowledge_embedding ON public.user_knowledge_base
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

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

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update the updated_at column
CREATE TRIGGER update_user_knowledge_base_updated_at
    BEFORE UPDATE ON public.user_knowledge_base
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle versioned updates
CREATE OR REPLACE FUNCTION public.update_knowledge_entry(
    p_user_id UUID,
    p_field_identifier TEXT,
    p_category TEXT,
    p_new_content TEXT,
    p_new_structured_data JSONB DEFAULT NULL,
    p_new_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
    v_current_version INTEGER;
BEGIN
    -- Get current version number
    SELECT COALESCE(MAX(version), 0) INTO v_current_version
    FROM public.user_knowledge_base
    WHERE user_id = p_user_id
        AND field_identifier = p_field_identifier;

    -- Mark old versions as not current
    UPDATE public.user_knowledge_base
    SET is_current = false
    WHERE user_id = p_user_id
        AND field_identifier = p_field_identifier
        AND is_current = true;

    -- Insert new version
    INSERT INTO public.user_knowledge_base (
        user_id,
        field_identifier,
        category,
        content,
        structured_data,
        metadata,
        version,
        is_current
    ) VALUES (
        p_user_id,
        p_field_identifier,
        p_category,
        p_new_content,
        p_new_structured_data,
        p_new_metadata,
        v_current_version + 1,
        true
    ) RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for semantic search across user's knowledge base
CREATE OR REPLACE FUNCTION public.match_user_knowledge(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10,
    p_user_id UUID DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    category TEXT,
    field_identifier TEXT,
    similarity FLOAT,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ukb.id,
        ukb.content,
        ukb.category,
        ukb.field_identifier,
        1 - (ukb.embedding <=> query_embedding) AS similarity,
        ukb.metadata
    FROM public.user_knowledge_base ukb
    WHERE
        ukb.embedding IS NOT NULL
        AND ukb.is_current = true
        AND (p_user_id IS NULL OR ukb.user_id = p_user_id)
        AND (p_categories IS NULL OR ukb.category = ANY(p_categories))
        AND 1 - (ukb.embedding <=> query_embedding) > match_threshold
    ORDER BY ukb.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.user_knowledge_base TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_knowledge_entry TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_user_knowledge TO authenticated;

-- Create a view for easy access to current entries only
CREATE OR REPLACE VIEW public.user_knowledge_current AS
SELECT * FROM public.user_knowledge_base
WHERE is_current = true;

-- Grant access to the view
GRANT SELECT ON public.user_knowledge_current TO authenticated;

-- Add comment documentation
COMMENT ON TABLE public.user_knowledge_base IS 'Stores all user knowledge entries with versioning support for local-first architecture';
COMMENT ON COLUMN public.user_knowledge_base.category IS 'Knowledge category: diagnostic, avatar, insights, canvas, or copy';
COMMENT ON COLUMN public.user_knowledge_base.field_identifier IS 'Unique identifier for the field (e.g., avatar_demographics_age)';
COMMENT ON COLUMN public.user_knowledge_base.embedding IS 'Vector embedding for semantic search (RAG)';
COMMENT ON COLUMN public.user_knowledge_base.is_current IS 'Whether this is the current version of the field';
COMMENT ON COLUMN public.user_knowledge_base.version IS 'Version number for this field entry';