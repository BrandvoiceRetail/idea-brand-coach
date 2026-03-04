-- ============================================
-- Add brand_id to existing avatars table
-- Keeps all existing columns, adds brand association
-- ============================================

-- Add brand_id as optional column (nullable for backward compatibility)
ALTER TABLE public.avatars
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL;

-- Add persona_data column if not exists
ALTER TABLE public.avatars
  ADD COLUMN IF NOT EXISTS persona_data JSONB;

-- Indexes for brand_id lookups
CREATE INDEX IF NOT EXISTS idx_avatars_brand_id_updated_at
ON public.avatars(brand_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_avatars_brand_id
ON public.avatars(brand_id);

-- Trigger to auto-update avatars.updated_at (re-create idempotently)
DROP TRIGGER IF EXISTS update_avatars_updated_at ON public.avatars;
CREATE TRIGGER update_avatars_updated_at
  BEFORE UPDATE ON public.avatars
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.avatars TO authenticated;
