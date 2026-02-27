
DROP POLICY "Users can view own commission distributions" ON public.commission_distributions;

CREATE POLICY "Users can view own commission distributions"
ON public.commission_distributions
FOR SELECT
TO authenticated
USING (
  (to_user_id = auth.uid()) OR
  (from_user_id = auth.uid()) OR
  has_role(auth.uid(), 'admin'::app_role)
);
