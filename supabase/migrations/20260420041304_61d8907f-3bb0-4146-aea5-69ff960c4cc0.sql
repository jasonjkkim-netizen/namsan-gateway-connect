-- Fix 1: Scope app_settings policies to authenticated role
DROP POLICY IF EXISTS "Authenticated users can read app settings" ON public.app_settings;
CREATE POLICY "Authenticated users can read app settings"
ON public.app_settings FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can manage app settings" ON public.app_settings;
CREATE POLICY "Admins can manage app settings"
ON public.app_settings FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Scope alert_settings policies to authenticated role
DROP POLICY IF EXISTS "Anyone authenticated can read alert settings" ON public.alert_settings;
CREATE POLICY "Anyone authenticated can read alert settings"
ON public.alert_settings FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can manage alert settings" ON public.alert_settings;
CREATE POLICY "Admins can manage alert settings"
ON public.alert_settings FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Fix 3: Scope commission_distributions admin policy + add explicit WITH CHECK
DROP POLICY IF EXISTS "Admins can manage commission distributions" ON public.commission_distributions;
CREATE POLICY "Admins can manage commission distributions"
ON public.commission_distributions FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Convert anonymous deny to RESTRICTIVE for stronger guarantees
DROP POLICY IF EXISTS "Deny anonymous access to commission_distributions" ON public.commission_distributions;
CREATE POLICY "Deny anonymous access to commission_distributions"
ON public.commission_distributions AS RESTRICTIVE
FOR ALL TO anon
USING (false) WITH CHECK (false);

-- Fix 4: Hide admin_note from non-admins on research_reports via column-level enforcement
-- Use a trigger-like approach: create a SELECT policy split for admins (full) vs others (must filter)
-- Simplest: add a RESTRICTIVE policy that prevents non-admin SELECT from returning rows where admin_note matters
-- Actually safest: revoke admin_note column-level SELECT from non-admin roles
REVOKE SELECT (admin_note) ON public.research_reports FROM authenticated, anon;
GRANT SELECT (admin_note) ON public.research_reports TO service_role;
-- Admins query through the service role/has_role check; the column is now hidden from authenticated users
-- Re-grant SELECT on all OTHER columns explicitly to authenticated
GRANT SELECT (id, title_ko, title_en, summary_ko, summary_en, category, publication_date, pdf_url, external_url, is_active, created_at) ON public.research_reports TO authenticated;

-- Fix 5: Scope notifications update/delete policies to authenticated
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Fix 6: Add DELETE policy for popup_dismissals
CREATE POLICY "Users can delete own dismissals"
ON public.popup_dismissals FOR DELETE TO authenticated
USING (auth.uid() = user_id);