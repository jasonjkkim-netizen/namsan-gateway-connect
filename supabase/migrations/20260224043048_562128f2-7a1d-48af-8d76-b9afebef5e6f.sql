
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage app settings" ON public.app_settings
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can read app settings" ON public.app_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

INSERT INTO public.app_settings (key, value) VALUES 
  ('commission_display_currency', '"KRW"'::jsonb)
ON CONFLICT (key) DO NOTHING;
