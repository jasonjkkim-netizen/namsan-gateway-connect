
ALTER TABLE public.weekly_stock_picks
ADD COLUMN sold_date date DEFAULT NULL,
ADD COLUMN sold_price numeric DEFAULT NULL;
