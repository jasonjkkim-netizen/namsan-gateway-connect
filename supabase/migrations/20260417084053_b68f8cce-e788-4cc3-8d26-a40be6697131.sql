-- Fix 1: Scope alert_log admin policy to authenticated role only
DROP POLICY IF EXISTS "Admins can manage alert log" ON public.alert_log;
CREATE POLICY "Admins can manage alert log"
ON public.alert_log
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Prevent sales users from creating commission rate overrides for themselves
-- Self-overrides must be set by an upline manager, not by the user themselves
DROP POLICY IF EXISTS "Sales users can insert rates for downline" ON public.commission_rates;
CREATE POLICY "Sales users can insert rates for downline"
ON public.commission_rates
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND is_override = true
  AND set_by = auth.uid()
  -- Override target must be a strict subtree descendant, NOT the inserter themselves
  AND override_user_id <> auth.uid()
  AND is_in_subtree(auth.uid(), override_user_id)
);

DROP POLICY IF EXISTS "Sales users can update own set rates" ON public.commission_rates;
CREATE POLICY "Sales users can update own set rates"
ON public.commission_rates
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND is_override = true
  AND set_by = auth.uid()
  AND override_user_id <> auth.uid()
  AND is_in_subtree(auth.uid(), override_user_id)
);

DROP POLICY IF EXISTS "Sales users can delete own set rates" ON public.commission_rates;
CREATE POLICY "Sales users can delete own set rates"
ON public.commission_rates
FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND is_override = true
  AND set_by = auth.uid()
  AND override_user_id <> auth.uid()
  AND is_in_subtree(auth.uid(), override_user_id)
);

-- Fix 3: Convert permissive false-deny policies to RESTRICTIVE so they actually block anonymous access
DROP POLICY IF EXISTS "Deny anonymous access to board_posts" ON public.board_posts;
CREATE POLICY "Deny anonymous access to board_posts"
ON public.board_posts
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Deny anonymous access to board_comments" ON public.board_comments;
CREATE POLICY "Deny anonymous access to board_comments"
ON public.board_comments
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);