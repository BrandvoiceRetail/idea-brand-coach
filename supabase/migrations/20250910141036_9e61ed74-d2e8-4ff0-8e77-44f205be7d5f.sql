-- Fix security issue: Remove overly permissive RLS policy for beta_testers table
-- Currently any authenticated user can view all beta tester personal information

-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view all beta testers" ON public.beta_testers;

-- Create a more restrictive policy that only allows users to view their own beta tester records
-- This allows users to view beta tester records only if the email matches their profile email
CREATE POLICY "Users can view their own beta tester records" 
ON public.beta_testers 
FOR SELECT 
USING (
  email IS NOT NULL AND 
  email = (SELECT email FROM public.profiles WHERE id = auth.uid())
);

-- Note: The INSERT policy remains unchanged as it allows beta tester registration
-- Edge functions will continue to work as they use the service role key