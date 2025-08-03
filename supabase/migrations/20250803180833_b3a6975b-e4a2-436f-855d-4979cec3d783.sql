-- Create beta_testers table for capturing contact info from diagnostics
CREATE TABLE public.beta_testers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  email TEXT,
  company TEXT,
  diagnostic_completion_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  overall_score INTEGER,
  category_scores JSONB,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.beta_testers ENABLE ROW LEVEL SECURITY;

-- Create policies - for now, allow authenticated users to view all (admin access)
-- and anyone to insert (for the free diagnostic)
CREATE POLICY "Anyone can insert beta tester data" 
ON public.beta_testers 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can view all beta testers" 
ON public.beta_testers 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_beta_testers_updated_at
BEFORE UPDATE ON public.beta_testers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();