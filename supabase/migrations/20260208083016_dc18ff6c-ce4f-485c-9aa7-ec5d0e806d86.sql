-- Deny anonymous access to client_product_access table
CREATE POLICY "Deny anonymous access to client_product_access"
ON public.client_product_access FOR SELECT
TO anon
USING (false);

-- Deny anonymous access to distributions table (also contains sensitive financial data)
CREATE POLICY "Deny anonymous access to distributions"
ON public.distributions FOR SELECT
TO anon
USING (false);