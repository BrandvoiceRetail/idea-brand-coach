-- Funnel tracker gap fixes: text assets, before/after score, stage integrity.
ALTER TABLE public.brand_assets
  ADD COLUMN IF NOT EXISTS content_text TEXT,        -- paste-text asset alternative to a screenshot
  ADD COLUMN IF NOT EXISTS previous_score INT;       -- prior overall_score, set on re-audit (before/after)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'brand_assets_stage_chk') THEN
    ALTER TABLE public.brand_assets
      ADD CONSTRAINT brand_assets_stage_chk
      CHECK (stage IN ('awareness','consideration','purchase_decision','retention','advocacy'));
  END IF;
END $$;
