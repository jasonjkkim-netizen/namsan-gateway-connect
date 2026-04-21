-- Drop the existing permissive policy and replace with a restrictive one
DROP POLICY IF EXISTS "No direct access to KIS tokens" ON public.kis_token_cache;

-- Create a RESTRICTIVE policy that ensures deny-by-default
CREATE POLICY "No direct access to KIS tokens"
ON public.kis_token_cache
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);