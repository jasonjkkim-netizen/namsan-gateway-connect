
-- Add price columns to market_overview_items
ALTER TABLE public.market_overview_items 
ADD COLUMN current_value numeric,
ADD COLUMN change_value numeric,
ADD COLUMN change_percent numeric;
