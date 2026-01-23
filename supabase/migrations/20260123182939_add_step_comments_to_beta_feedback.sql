-- Add step_comments column to beta_feedback table
-- This stores the step-by-step comments collected during beta testing journey
-- Format: Array of objects with stepId, pageUrl, comment, and timestamp

ALTER TABLE public.beta_feedback
ADD COLUMN step_comments JSONB DEFAULT '[]'::jsonb;

-- Add a comment for documentation
COMMENT ON COLUMN public.beta_feedback.step_comments IS 'Step-by-step comments collected during beta testing journey. Format: [{stepId, pageUrl, comment, timestamp}]';
