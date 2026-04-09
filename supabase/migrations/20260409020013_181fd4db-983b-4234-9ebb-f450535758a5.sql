
CREATE TABLE public.notion_sync_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  direction text NOT NULL,
  tables text[] NOT NULL DEFAULT '{}',
  results jsonb NOT NULL DEFAULT '[]',
  total_created integer NOT NULL DEFAULT 0,
  total_updated integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  duration_ms integer,
  triggered_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notion_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sync log"
  ON public.notion_sync_log
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Deny anonymous access to notion_sync_log"
  ON public.notion_sync_log
  FOR SELECT
  USING (false);
