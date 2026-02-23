
-- Allow sales users to insert investments for their downline clients
CREATE POLICY "Sales users can insert downline investments"
ON public.client_investments
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by = auth.uid()
  AND is_in_subtree(auth.uid(), user_id)
);

-- Allow sales users to view products they can sell (all active products)
CREATE POLICY "Sales users can view active products"
ON public.investment_products
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND is_active = true
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.sales_role IS NOT NULL
  )
);
