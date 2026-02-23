ALTER TABLE investment_products DROP CONSTRAINT investment_products_status_check;
ALTER TABLE investment_products ADD CONSTRAINT investment_products_status_check 
  CHECK (status = ANY (ARRAY['draft'::text, 'pending'::text, 'open'::text, 'closed'::text, 'coming_soon'::text, 'archived'::text]));