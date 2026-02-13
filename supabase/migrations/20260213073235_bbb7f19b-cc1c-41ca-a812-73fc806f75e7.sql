
-- Create popup_ads table
CREATE TABLE public.popup_ads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title_en TEXT NOT NULL DEFAULT '',
  title_ko TEXT NOT NULL DEFAULT '',
  description_en TEXT DEFAULT '',
  description_ko TEXT DEFAULT '',
  image_url TEXT DEFAULT NULL,
  button_text_en TEXT DEFAULT 'Learn More',
  button_text_ko TEXT DEFAULT '자세히 보기',
  button_link TEXT DEFAULT '/products',
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.popup_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active popup ads"
  ON public.popup_ads FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage popup ads"
  ON public.popup_ads FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Track dismissals (once per day logic in app)
CREATE TABLE public.popup_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  popup_id UUID NOT NULL REFERENCES public.popup_ads(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, popup_id)
);

ALTER TABLE public.popup_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dismissals"
  ON public.popup_dismissals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dismissals"
  ON public.popup_dismissals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dismissals"
  ON public.popup_dismissals FOR UPDATE
  USING (auth.uid() = user_id);
