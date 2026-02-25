
-- Allow sales users to insert commission rates for their downline or themselves
CREATE POLICY "Sales users can insert rates for downline"
ON public.commission_rates
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND is_override = true
  AND (
    override_user_id = auth.uid()
    OR is_in_subtree(auth.uid(), override_user_id)
  )
  AND set_by = auth.uid()
);

-- Allow sales users to update commission rates they set for downline
CREATE POLICY "Sales users can update own set rates"
ON public.commission_rates
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND is_override = true
  AND set_by = auth.uid()
  AND (
    override_user_id = auth.uid()
    OR is_in_subtree(auth.uid(), override_user_id)
  )
);

-- Allow sales users to delete their own override rates
CREATE POLICY "Sales users can delete own set rates"
ON public.commission_rates
FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND is_override = true
  AND set_by = auth.uid()
  AND (
    override_user_id = auth.uid()
    OR is_in_subtree(auth.uid(), override_user_id)
  )
);
