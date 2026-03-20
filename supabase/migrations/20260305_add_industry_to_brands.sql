-- Add industry column to brands table if it doesn't exist
ALTER TABLE brands
ADD COLUMN IF NOT EXISTS industry TEXT;

-- Add description column if it doesn't exist (also used by SupabaseBrandService)
ALTER TABLE brands
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add metadata column if it doesn't exist
ALTER TABLE brands
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN brands.industry IS 'Industry or sector the brand operates in';
COMMENT ON COLUMN brands.description IS 'Brief description of the brand';
COMMENT ON COLUMN brands.metadata IS 'Additional brand metadata in JSON format';