DROP POLICY "Anyone can view active flagship items" ON public.flagship_portfolio_items;
CREATE POLICY "Authenticated users can view active flagship items"
ON public.flagship_portfolio_items FOR SELECT
USING (auth.uid() IS NOT NULL AND is_active = true);