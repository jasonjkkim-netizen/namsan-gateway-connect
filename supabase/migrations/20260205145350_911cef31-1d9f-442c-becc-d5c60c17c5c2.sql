-- Drop existing permissive policies on investment_products
DROP POLICY IF EXISTS "Authenticated users can view active products" ON public.investment_products;
DROP POLICY IF EXISTS "Require authentication for investment_products" ON public.investment_products;

-- Create policy that restricts product visibility to users with access via client_product_access
CREATE POLICY "Users can view products they have access to"
ON public.investment_products
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    -- User has explicit access via client_product_access
    EXISTS (
      SELECT 1 FROM public.client_product_access
      WHERE client_product_access.product_id = investment_products.id
      AND client_product_access.user_id = auth.uid()
    )
    OR
    -- Or user is an admin
    has_role(auth.uid(), 'admin'::app_role)
  )
);