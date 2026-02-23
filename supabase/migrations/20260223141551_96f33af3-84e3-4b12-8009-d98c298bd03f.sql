-- Allow sales users to view investments from their downline
CREATE POLICY "Sales users can view downline investments"
  ON public.client_investments
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND is_in_subtree(auth.uid(), user_id)
  );