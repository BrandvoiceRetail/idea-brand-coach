-- Create beta_comments table for immediate comment saving
-- Each comment is saved individually as it's entered during beta testing

CREATE TABLE public.beta_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  beta_tester_id UUID REFERENCES public.beta_testers(id),
  step_id TEXT NOT NULL,
  page_url TEXT,
  comment TEXT NOT NULL,
  commented_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.beta_comments ENABLE ROW LEVEL SECURITY;

-- Create policies for beta_comments table
CREATE POLICY "Anyone can insert beta comments"
ON public.beta_comments
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can view all beta comments"
ON public.beta_comments
FOR SELECT
USING (auth.role() = 'authenticated'::text);

-- Add index for faster queries by beta_tester_id
CREATE INDEX idx_beta_comments_beta_tester_id ON public.beta_comments(beta_tester_id);
CREATE INDEX idx_beta_comments_step_id ON public.beta_comments(step_id);

-- Add a comment for documentation
COMMENT ON TABLE public.beta_comments IS 'Stores individual beta tester comments as they are entered, before final feedback submission';
