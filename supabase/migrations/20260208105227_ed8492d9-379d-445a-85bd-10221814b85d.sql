-- Add explicit deny policy for anonymous users on investment_products table
CREATE POLICY "Deny anonymous access to investment_products"
ON public.investment_products
FOR SELECT
TO anon
USING (false);