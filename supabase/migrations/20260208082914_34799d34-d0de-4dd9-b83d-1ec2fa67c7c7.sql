-- Deny anonymous access to client_investments table
CREATE POLICY "Deny anonymous access to client_investments"
ON public.client_investments FOR SELECT
TO anon
USING (false);