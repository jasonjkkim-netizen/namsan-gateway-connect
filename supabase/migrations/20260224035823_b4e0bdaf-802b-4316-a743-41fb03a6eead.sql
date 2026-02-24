
-- Alert settings: per-category toggle
CREATE TABLE public.alert_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL UNIQUE,
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.alert_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage alert settings"
  ON public.alert_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone authenticated can read alert settings"
  ON public.alert_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Seed default categories
INSERT INTO public.alert_settings (category, is_enabled) VALUES
  ('viewpoint', true),
  ('blog', true),
  ('stock_pick', true),
  ('video', true),
  ('investment', true),
  ('commission', true);

-- Alert log: record of every sent alert
CREATE TABLE public.alert_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  recipient_user_id uuid NOT NULL,
  recipient_name text,
  recipient_email text,
  subject text NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  sent_by uuid,
  is_manual boolean NOT NULL DEFAULT false
);

ALTER TABLE public.alert_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage alert log"
  ON public.alert_log FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
