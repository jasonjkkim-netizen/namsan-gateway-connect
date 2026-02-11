
-- Add market column to distinguish Korean (KR) vs US stocks
ALTER TABLE public.weekly_stock_picks ADD COLUMN market TEXT NOT NULL DEFAULT 'KR';

-- Insert US stock picks
INSERT INTO public.weekly_stock_picks (stock_name, stock_code, recommendation_date, price_reference_date, closing_price_at_recommendation, current_closing_price, display_order, is_active, market)
VALUES
  ('NVIDIA', 'NVDA', '2026-02-11', '2026-02-11', 0, NULL, 1, true, 'US'),
  ('Rocket Lab', 'RKLB', '2026-02-11', '2026-02-11', 0, NULL, 2, true, 'US'),
  ('AST SpaceMobile', 'AST', '2026-02-11', '2026-02-11', 0, NULL, 3, true, 'US'),
  ('Western Digital', 'SNDK', '2026-02-11', '2026-02-11', 0, NULL, 4, true, 'US');
