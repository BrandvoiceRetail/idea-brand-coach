-- Create avatar_field_values table for persisting extracted and manual field values
CREATE TABLE IF NOT EXISTS avatar_field_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avatar_id UUID REFERENCES avatars(id) ON DELETE CASCADE,
    field_id TEXT NOT NULL,
    field_value TEXT,
    field_source TEXT CHECK (field_source IN ('ai', 'manual')),
    is_locked BOOLEAN DEFAULT false,
    confidence_score FLOAT,
    extracted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    chapter_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(avatar_id, field_id)
);

-- Create indexes for performance
CREATE INDEX idx_avatar_field_values_avatar_id ON avatar_field_values(avatar_id);
CREATE INDEX idx_avatar_field_values_field_id ON avatar_field_values(field_id);
CREATE INDEX idx_avatar_field_values_chapter_id ON avatar_field_values(chapter_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_avatar_field_values
BEFORE UPDATE ON avatar_field_values
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Add RLS policies
ALTER TABLE avatar_field_values ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own avatar fields
CREATE POLICY "Users can manage their own avatar fields" ON avatar_field_values
    FOR ALL
    USING (
        avatar_id IN (
            SELECT a.id FROM avatars a
            JOIN brands b ON a.brand_id = b.id
            WHERE b.user_id = auth.uid()
        )
    )
    WITH CHECK (
        avatar_id IN (
            SELECT a.id FROM avatars a
            JOIN brands b ON a.brand_id = b.id
            WHERE b.user_id = auth.uid()
        )
    );