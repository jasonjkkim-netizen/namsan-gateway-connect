-- Add policy requiring authentication for profiles table
CREATE POLICY "Require authentication for profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Add same policy for investment_products to fix the related warning
CREATE POLICY "Require authentication for investment_products"
ON public.investment_products
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);