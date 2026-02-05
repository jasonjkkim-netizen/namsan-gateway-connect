-- Add authentication requirement policy for profiles table
CREATE POLICY "Require authentication for profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);