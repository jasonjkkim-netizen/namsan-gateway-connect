-- Create market indices table for storing major index values
CREATE TABLE public.market_indices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  name_ko TEXT NOT NULL,
  name_en TEXT NOT NULL,
  current_value NUMERIC(12, 2) NOT NULL,
  change_value NUMERIC(12, 2) DEFAULT 0,
  change_percent NUMERIC(6, 2) DEFAULT 0,
  external_link TEXT,
  color_class TEXT DEFAULT 'from-blue-500 to-blue-600',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.market_indices ENABLE ROW LEVEL SECURITY;

-- Everyone can read active indices
CREATE POLICY "Anyone can view active market indices"
ON public.market_indices FOR SELECT
USING (is_active = true);

-- Only admins can modify
CREATE POLICY "Only admins can insert market indices"
ON public.market_indices FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update market indices"
ON public.market_indices FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete market indices"
ON public.market_indices FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Deny anonymous access
CREATE POLICY "Deny anonymous access to market indices"
ON public.market_indices FOR ALL TO anon
USING (false);

-- Create trigger for updated_at
CREATE TRIGGER update_market_indices_updated_at
BEFORE UPDATE ON public.market_indices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial data for major indices
INSERT INTO public.market_indices (symbol, name_ko, name_en, current_value, change_value, change_percent, external_link, color_class, display_order) VALUES
('KOSPI', 'KOSPI 지수', 'KOSPI Index', 2650.00, 15.30, 0.58, 'https://www.investing.com/indices/kospi', 'from-blue-500 to-blue-600', 1),
('KOSDAQ', '코스닥 지수', 'KOSDAQ Index', 870.00, -5.20, -0.59, 'https://www.investing.com/indices/kosdaq', 'from-emerald-500 to-emerald-600', 2),
('NDX', '나스닥 100', 'NASDAQ 100', 21500.00, 125.50, 0.59, 'https://www.investing.com/indices/nq-100', 'from-purple-500 to-purple-600', 3),
('SPX', 'S&P 500', 'S&P 500', 6050.00, 28.75, 0.48, 'https://www.investing.com/indices/us-spx-500', 'from-orange-500 to-orange-600', 4);