-- Add explicit authentication requirement policy
CREATE POLICY "Require authentication for investment_products"
ON public.investment_products
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);