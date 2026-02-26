-- Tighten profile visibility to self/admin/management subtree only
DROP POLICY IF EXISTS "Authenticated profile visibility boundary" ON public.profiles;
CREATE POLICY "Authenticated profile visibility boundary"
ON public.profiles
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_in_subtree(auth.uid(), user_id)
);

-- Add explicit restrictive read policy for alert log PII
DROP POLICY IF EXISTS "Authenticated alert log visibility boundary" ON public.alert_log;
CREATE POLICY "Authenticated alert log visibility boundary"
ON public.alert_log
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);