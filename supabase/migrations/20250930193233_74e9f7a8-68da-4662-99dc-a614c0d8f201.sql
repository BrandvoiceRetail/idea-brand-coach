-- Create table for storing IDEA framework submissions
CREATE TABLE public.idea_framework_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_intent TEXT,
  motivation TEXT,
  triggers TEXT,
  shopper_type TEXT,
  demographics TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.idea_framework_submissions ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own submissions" 
ON public.idea_framework_submissions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own submissions" 
ON public.idea_framework_submissions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own submissions" 
ON public.idea_framework_submissions 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own submissions" 
ON public.idea_framework_submissions 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_idea_framework_submissions_updated_at
BEFORE UPDATE ON public.idea_framework_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();