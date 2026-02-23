
-- Fix the overly permissive INSERT policy - only allow service role or the user themselves
DROP POLICY "Service role can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users can receive notifications"
ON public.notifications FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
