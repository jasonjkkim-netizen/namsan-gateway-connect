-- Add explicit deny for non-admin SELECT on newsletters table
CREATE POLICY "Deny non-admin access to newsletters"
ON public.newsletters
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));