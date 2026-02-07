-- Fix client_investments RLS: Allow only administrators to access financial data
-- Drop all existing overlapping SELECT policies
DROP POLICY IF EXISTS "Users can view their own investments" ON public.client_investments;
DROP POLICY IF EXISTS "Users can view own investments permissive" ON public.client_investments;
DROP POLICY IF EXISTS "Admins can manage all investments" ON public.client_investments;
DROP POLICY IF EXISTS "Admins can manage all investments permissive" ON public.client_investments;
DROP POLICY IF EXISTS "Admins can view all investments" ON public.client_investments;
DROP POLICY IF EXISTS "Admins can insert investments" ON public.client_investments;
DROP POLICY IF EXISTS "Admins can update investments" ON public.client_investments;
DROP POLICY IF EXISTS "Admins can delete investments" ON public.client_investments;

-- Create single consolidated admin-only policies (PERMISSIVE by default)
CREATE POLICY "Admins can select all investments"
ON public.client_investments
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert investments"
ON public.client_investments
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update investments"
ON public.client_investments
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete investments"
ON public.client_investments
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));