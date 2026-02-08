-- Create table for market overview items
CREATE TABLE public.market_overview_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  title_ko text NOT NULL,
  title_en text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.market_overview_items ENABLE ROW LEVEL SECURITY;

-- Everyone can view active items
CREATE POLICY "Anyone can view active market items"
ON public.market_overview_items
FOR SELECT
USING (is_active = true);

-- Admins can manage all items
CREATE POLICY "Admins can manage market items"
ON public.market_overview_items
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default items (NKY, SPY, DJI)
INSERT INTO public.market_overview_items (symbol, title_ko, title_en, display_order) VALUES
  ('TVC:NI225', '니케이 225', 'Nikkei 225', 1),
  ('AMEX:SPY', 'S&P 500 ETF', 'S&P 500 ETF', 2),
  ('TVC:DJI', '다우존스', 'Dow Jones', 3);