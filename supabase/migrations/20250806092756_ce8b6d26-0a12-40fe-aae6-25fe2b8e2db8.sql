-- Create beta_feedback table to store detailed feedback responses
CREATE TABLE public.beta_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  beta_tester_id UUID REFERENCES public.beta_testers(id),
  overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
  liked_most TEXT,
  improvements TEXT,
  issues TEXT,
  areas_tested TEXT[] DEFAULT '{}',
  would_recommend TEXT CHECK (would_recommend IN ('definitely', 'probably', 'maybe', 'unlikely')),
  contact_email TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

-- Create policies for beta_feedback table
CREATE POLICY "Anyone can insert beta feedback"
ON public.beta_feedback
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can view all beta feedback"
ON public.beta_feedback
FOR SELECT
USING (auth.role() = 'authenticated'::text);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_beta_feedback_updated_at
BEFORE UPDATE ON public.beta_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();