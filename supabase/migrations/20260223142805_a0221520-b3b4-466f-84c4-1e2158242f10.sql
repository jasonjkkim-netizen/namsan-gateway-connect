
ALTER TABLE commission_distributions DROP CONSTRAINT chk_cd_status;
ALTER TABLE commission_distributions ADD CONSTRAINT chk_cd_status 
  CHECK (status = ANY (ARRAY['pending'::text, 'available'::text, 'paid'::text, 'voided'::text]));
