-- Create user diagnostic results table
CREATE TABLE public.user_diagnostic_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  overall_score integer NOT NULL,
  category_scores jsonb,
  diagnostic_completion_date timestamp with time zone NOT NULL DEFAULT now(),
  beta_tester_id uuid REFERENCES public.beta_testers(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_diagnostic_results ENABLE ROW LEVEL SECURITY;

-- Create policies for user diagnostic results
CREATE POLICY "Users can view their own diagnostic results" 
ON public.user_diagnostic_results 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own diagnostic results" 
ON public.user_diagnostic_results 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_diagnostic_results_updated_at
BEFORE UPDATE ON public.user_diagnostic_results
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to link beta tester data to new user accounts
CREATE OR REPLACE FUNCTION public.link_beta_tester_to_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Look for existing beta_testers records with the same email
  INSERT INTO public.user_diagnostic_results (
    user_id,
    overall_score,
    category_scores,
    diagnostic_completion_date,
    beta_tester_id
  )
  SELECT 
    NEW.id,
    bt.overall_score,
    bt.category_scores,
    bt.diagnostic_completion_date,
    bt.id
  FROM public.beta_testers bt
  WHERE bt.email = NEW.email
  AND bt.overall_score IS NOT NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;