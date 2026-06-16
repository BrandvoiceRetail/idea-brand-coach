-- ============================================
-- Decision Trigger™ results
-- Stores the derived dominant (and, at Beta, supporting) Decision Trigger for a
-- diagnostic session: the named psychological mechanism that makes the customer
-- act, with verbatim review evidence and a placement instruction.
-- Source: identify-decision-trigger edge function (Trust Gap scores + review corpus).
-- Spec: Decision Trigger Developer Brief v2.20 §4.2.
-- ============================================

CREATE TABLE IF NOT EXISTS public.decision_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  avatar_id UUID,
  -- Dominant trigger (Alpha)
  dominant_type TEXT NOT NULL
    CHECK (dominant_type IN ('Identity', 'Belonging', 'Permission', 'Fear-of-Loss', 'Recognition', 'Momentum')),
  brand_anchor TEXT NOT NULL,
  evidence_phrases JSONB NOT NULL DEFAULT '[]'::jsonb,  -- 2-3 verbatim review/listing quotes
  placement_instruction TEXT NOT NULL,                  -- <= 2 sentences, names a CAPTURE element
  dominant_confidence NUMERIC(4, 3),                    -- INTERNAL ONLY — never returned to the client panel
  -- Supporting trigger (Beta — columns present but unpopulated at Alpha)
  supporting_type TEXT
    CHECK (supporting_type IS NULL OR supporting_type IN ('Identity', 'Belonging', 'Permission', 'Fear-of-Loss', 'Recognition', 'Momentum')),
  supporting_confidence NUMERIC(4, 3),
  why_this_trigger TEXT,                                -- secondary expansion, plain language
  model_version TEXT,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.decision_triggers ENABLE ROW LEVEL SECURITY;

-- RLS Policies (owner-scoped, mirrors user_products)
CREATE POLICY "Users can view their own decision triggers"
ON public.decision_triggers FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own decision triggers"
ON public.decision_triggers FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own decision triggers"
ON public.decision_triggers FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own decision triggers"
ON public.decision_triggers FOR DELETE
USING (auth.uid() = user_id);

-- Latest trigger per session, newest-first
CREATE INDEX IF NOT EXISTS idx_decision_triggers_user_session
ON public.decision_triggers(user_id, session_id, generated_at DESC);

-- Auto-update updated_at (shared trigger fn, same as user_products)
DROP TRIGGER IF EXISTS update_decision_triggers_updated_at ON public.decision_triggers;
CREATE TRIGGER update_decision_triggers_updated_at
  BEFORE UPDATE ON public.decision_triggers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.decision_triggers TO authenticated;
