-- Update KR stock picks to Feb 6, 2026 closing prices
UPDATE weekly_stock_picks SET price_reference_date = '2026-02-06', current_closing_price = 839000 WHERE stock_code = '000660' AND is_active = true;
UPDATE weekly_stock_picks SET price_reference_date = '2026-02-06', current_closing_price = 158600 WHERE stock_code = '005930' AND is_active = true;
UPDATE weekly_stock_picks SET price_reference_date = '2026-02-06', current_closing_price = 136100 WHERE stock_code = '058610' AND is_active = true;
UPDATE weekly_stock_picks SET price_reference_date = '2026-02-06', current_closing_price = 256500 WHERE stock_code = '278470' AND is_active = true;
-- Update remaining stocks with Feb 26 or Feb 11 dates to Feb 6
UPDATE weekly_stock_picks SET price_reference_date = '2026-02-06' WHERE price_reference_date IN ('2026-02-26', '2026-02-11') AND is_active = true;