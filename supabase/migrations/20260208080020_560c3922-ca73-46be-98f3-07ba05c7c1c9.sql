-- Create table for weekly stock picks
CREATE TABLE public.weekly_stock_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_name text NOT NULL,
  stock_code text,
  recommendation_date date NOT NULL,
  closing_price_at_recommendation numeric NOT NULL,
  current_closing_price numeric,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.weekly_stock_picks ENABLE ROW LEVEL SECURITY;

-- Anyone can view active items
CREATE POLICY "Anyone can view active stock picks"
ON public.weekly_stock_picks
FOR SELECT
USING (is_active = true);

-- Admins can manage all items
CREATE POLICY "Admins can manage stock picks"
ON public.weekly_stock_picks
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert initial data (Feb 1, 2025)
INSERT INTO public.weekly_stock_picks (stock_name, recommendation_date, closing_price_at_recommendation, current_closing_price, display_order) VALUES
  ('SK하이닉스', '2025-02-01', 200000, 200000, 1),
  ('삼성전자', '2025-02-01', 53000, 53000, 2),
  ('현대일렉트릭', '2025-02-01', 450000, 450000, 3),
  ('한화솔루션', '2025-02-01', 25000, 25000, 4),
  ('에이피알', '2025-02-01', 85000, 85000, 5);