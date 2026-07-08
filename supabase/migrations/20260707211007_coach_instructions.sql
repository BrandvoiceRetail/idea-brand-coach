-- Phase B coach_instructions substrate
-- Stores versioned instruction blocks for MCP coach grounding and edge function prompts
-- Supports per-instruction versioning with exactly one published version per instruction_id

CREATE TABLE IF NOT EXISTS public.coach_instructions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instruction_id text NOT NULL, -- Stable key like 'build_avatar_stage.s3', 'generate_listing_image_brief', 'global.tier_a_terminology'
  surface text NOT NULL CHECK (surface IN ('preamble', 'edge-fn', 'both')), -- Where this instruction applies
  when_to_use text, -- Human-readable description of when to apply this instruction
  body text NOT NULL, -- The actual instruction text
  input_keys text[], -- Optional: which input parameters this instruction references
  version int NOT NULL DEFAULT 1, -- Version number for this instruction_id
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enforce exactly one published version per instruction_id
CREATE UNIQUE INDEX idx_coach_instructions_one_published
  ON public.coach_instructions(instruction_id)
  WHERE status = 'published';

-- Index for fast lookups of active instructions
CREATE INDEX idx_coach_instructions_active
  ON public.coach_instructions(status, surface)
  WHERE status = 'published';

-- RLS policies
ALTER TABLE public.coach_instructions ENABLE ROW LEVEL SECURITY;

-- Read: anyone authenticated can read published instructions
CREATE POLICY "Published instructions are public to authenticated users"
  ON public.coach_instructions
  FOR SELECT
  USING (
    status = 'published'
    AND auth.uid() IS NOT NULL
  );

-- Write: admin-only for now (needs decision on admin-gate mechanism)
-- Temporary: only specific users can write (will be replaced with proper admin check)
CREATE POLICY "Admin users can manage instructions"
  ON public.coach_instructions
  FOR ALL
  USING (
    auth.uid() IN (
      -- Placeholder: replace with actual admin check mechanism
      -- This needs to be resolved per Matthew's decision on admin-gate
      SELECT id FROM public.profiles WHERE email IN (
        'trevor@brandvoice.co.uk',
        'matthew@arisegroup.ai'
      )
    )
  );

-- Function to auto-update published_at when status changes to published
CREATE OR REPLACE FUNCTION public.update_coach_instructions_published_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' AND OLD.status != 'published' THEN
    NEW.published_at = now();
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER coach_instructions_published_at_trigger
  BEFORE UPDATE ON public.coach_instructions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_coach_instructions_published_at();

-- Grant permissions
GRANT SELECT ON public.coach_instructions TO authenticated;
GRANT ALL ON public.coach_instructions TO service_role;