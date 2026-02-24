
ALTER TABLE public.alert_log ADD COLUMN channel text NOT NULL DEFAULT 'email';
ALTER TABLE public.alert_settings ADD COLUMN channel text NOT NULL DEFAULT 'email';
ALTER TABLE public.alert_settings ADD CONSTRAINT alert_settings_category_channel_unique UNIQUE (category, channel);
