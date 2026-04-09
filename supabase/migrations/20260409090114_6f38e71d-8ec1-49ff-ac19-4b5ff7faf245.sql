
-- 1. Remove notifications from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications;

-- 2. Fix research-documents storage: drop existing SELECT policies and restrict to admins
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname ILIKE '%research%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Only admins can download research documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'research-documents'
  AND has_role(auth.uid(), 'admin'::public.app_role)
);

-- 3. Fix commission_audit_log: only service_role can insert
DROP POLICY IF EXISTS "Only admins can insert audit log" ON public.commission_audit_log;

CREATE POLICY "Only service role can insert audit log"
ON public.commission_audit_log
FOR INSERT
WITH CHECK (auth.role() = 'service_role');
