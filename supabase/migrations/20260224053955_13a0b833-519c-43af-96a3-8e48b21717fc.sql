-- Allow district_manager and deputy_district_manager to update profiles of their downline
CREATE POLICY "Sales managers can update downline profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  (auth.uid() IS NOT NULL)
  AND (
    EXISTS (
      SELECT 1 FROM profiles AS mgr
      WHERE mgr.user_id = auth.uid()
      AND mgr.sales_role IN ('district_manager', 'deputy_district_manager')
    )
  )
  AND is_in_subtree(auth.uid(), profiles.user_id)
);