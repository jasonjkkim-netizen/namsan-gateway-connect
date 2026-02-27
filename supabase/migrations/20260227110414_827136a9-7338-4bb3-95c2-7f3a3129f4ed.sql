
-- 1. Add anonymous denial for alert_log
CREATE POLICY "Deny anonymous access to alert_log"
ON public.alert_log
FOR SELECT
TO public
USING (false);

-- 2. Add anonymous denial for commission_rates
CREATE POLICY "Deny anonymous access to commission_rates"
ON public.commission_rates
FOR SELECT
TO public
USING (false);

-- 3. Add anonymous denial for commission_distributions
CREATE POLICY "Deny anonymous access to commission_distributions"
ON public.commission_distributions
FOR SELECT
TO public
USING (false);

-- 4. Fix notifications INSERT policy - drop permissive and add restrictive one
DROP POLICY IF EXISTS "Authenticated users can receive notifications" ON public.notifications;

CREATE POLICY "Admins can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
