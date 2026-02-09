-- Add price_reference_date column to store the base price date (e.g., Jan 30)
-- This is separate from recommendation_date which tracks when stock was added
ALTER TABLE public.weekly_stock_picks 
ADD COLUMN price_reference_date date;

-- Update existing records to use Jan 30, 2025 as the price reference date
UPDATE public.weekly_stock_picks 
SET price_reference_date = '2025-01-30'
WHERE recommendation_date = '2025-02-08';

-- For any other records, default to their recommendation_date
UPDATE public.weekly_stock_picks 
SET price_reference_date = recommendation_date
WHERE price_reference_date IS NULL;