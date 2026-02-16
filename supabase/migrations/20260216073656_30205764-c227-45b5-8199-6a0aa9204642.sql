
-- Create interest_news table for simple news article links
CREATE TABLE public.interest_news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title_ko TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.interest_news ENABLE ROW LEVEL SECURITY;

-- Admins can manage
CREATE POLICY "Admins can manage interest news"
  ON public.interest_news
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone authenticated can view active
CREATE POLICY "Anyone can view active interest news"
  ON public.interest_news
  FOR SELECT
  USING (is_active = true);

-- Timestamp trigger
CREATE TRIGGER update_interest_news_updated_at
  BEFORE UPDATE ON public.interest_news
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
