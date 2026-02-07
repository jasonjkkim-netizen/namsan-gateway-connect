-- Add a PERMISSIVE policy for admin-only access to client_investments
-- This ensures only administrators can access the financial data

CREATE POLICY "Admins can view all investments"
ON public.client_investments
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert investments"
ON public.client_investments
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update investments"
ON public.client_investments
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete investments"
ON public.client_investments
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));