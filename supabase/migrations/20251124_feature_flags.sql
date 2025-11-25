-- Feature Flags Table
-- Supports dynamic feature flags with targeting rules and real-time updates

-- Create feature_flags table
CREATE TABLE IF NOT EXISTS public.feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT false,
    targeting_rules JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON public.feature_flags(name);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON public.feature_flags(enabled);
CREATE INDEX IF NOT EXISTS idx_feature_flags_created_at ON public.feature_flags(created_at);

-- Add comment
COMMENT ON TABLE public.feature_flags IS 'Dynamic feature flags with targeting rules';
COMMENT ON COLUMN public.feature_flags.name IS 'Unique feature flag name (e.g., "brand_analytics")';
COMMENT ON COLUMN public.feature_flags.description IS 'Human-readable description of the feature';
COMMENT ON COLUMN public.feature_flags.enabled IS 'Global on/off switch for the feature';
COMMENT ON COLUMN public.feature_flags.targeting_rules IS 'JSON rules for targeting specific users/sessions (userIds, percentage, sessionPercentage)';
COMMENT ON COLUMN public.feature_flags.metadata IS 'Additional metadata (owner, tags, etc.)';

-- Create feature_flag_evaluations table for analytics
CREATE TABLE IF NOT EXISTS public.feature_flag_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_name TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT,
    evaluated_to BOOLEAN NOT NULL,
    context JSONB DEFAULT '{}',
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for evaluations
CREATE INDEX IF NOT EXISTS idx_feature_flag_evaluations_flag_name ON public.feature_flag_evaluations(flag_name);
CREATE INDEX IF NOT EXISTS idx_feature_flag_evaluations_user_id ON public.feature_flag_evaluations(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_flag_evaluations_evaluated_at ON public.feature_flag_evaluations(evaluated_at);

-- Add comment
COMMENT ON TABLE public.feature_flag_evaluations IS 'Feature flag evaluation history for analytics';

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.update_feature_flag_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for updated_at
CREATE TRIGGER update_feature_flags_updated_at
    BEFORE UPDATE ON public.feature_flags
    FOR EACH ROW
    EXECUTE FUNCTION public.update_feature_flag_updated_at();

-- RLS Policies

-- Enable RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_evaluations ENABLE ROW LEVEL SECURITY;

-- Feature flags policies
-- Anyone can read feature flags
CREATE POLICY "Anyone can read feature flags"
    ON public.feature_flags
    FOR SELECT
    TO authenticated, anon
    USING (true);

-- Only admins can insert/update/delete feature flags
CREATE POLICY "Only admins can insert feature flags"
    ON public.feature_flags
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Only admins can update feature flags"
    ON public.feature_flags
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Only admins can delete feature flags"
    ON public.feature_flags
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Feature flag evaluations policies
-- Users can insert their own evaluations
CREATE POLICY "Users can insert their own evaluations"
    ON public.feature_flag_evaluations
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Users can read their own evaluations
CREATE POLICY "Users can read their own evaluations"
    ON public.feature_flag_evaluations
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR user_id IS NULL);

-- Admins can read all evaluations
CREATE POLICY "Admins can read all evaluations"
    ON public.feature_flag_evaluations
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Insert some initial feature flags
INSERT INTO public.feature_flags (name, description, enabled, targeting_rules, metadata)
VALUES
    ('brand_analytics', 'Advanced brand analytics and insights', false, '{"percentage": 0}', '{"phase": "P2"}'),
    ('brand_canvas_export', 'Export brand canvas to PDF', false, '{"percentage": 0}', '{"phase": "P1"}'),
    ('team_collaboration', 'Team collaboration features', false, '{"percentage": 0}', '{"phase": "P1"}'),
    ('competitive_analysis', 'AI-powered competitive analysis', false, '{"percentage": 0}', '{"phase": "P2"}'),
    ('ai_workshop_facilitator', 'AI-guided brand workshops', false, '{"percentage": 0}', '{"phase": "P2"}')
ON CONFLICT (name) DO NOTHING;
