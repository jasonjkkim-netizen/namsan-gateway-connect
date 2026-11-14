ALTER TABLE public.finance_monthly_actuals ADD COLUMN actual_deposit_paid numeric(18,2) NOT NULL DEFAULT 0 CHECK (actual_deposit_paid >= 0);
CREATE OR REPLACE FUNCTION public.finance_validate_money() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ DECLARE r jsonb := to_jsonb(NEW); field text; value numeric; BEGIN
IF r->>'currency' = 'KRW' THEN FOREACH field IN ARRAY ARRAY['amount','actual_paid','actual_received','actual_deposit_paid'] LOOP IF r ? field THEN value := (r->>field)::numeric; IF value <> trunc(value) THEN RAISE EXCEPTION 'KRW amounts must be whole integers'; END IF; END IF; END LOOP; END IF;
IF r ? 'actual_deposit_paid' AND (r->>'actual_deposit_paid')::numeric > (r->>'actual_paid')::numeric THEN RAISE EXCEPTION 'Deposit paid cannot exceed total actual paid'; END IF;
IF TG_TABLE_NAME = 'finance_monthly_actuals' AND extract(day FROM NEW.month) <> 1 THEN RAISE EXCEPTION 'Monthly records must use the first day of the month'; END IF;
RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.finance_validate_invoice() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ DECLARE item jsonb; BEGIN
IF NEW.snapshot->>'currency' NOT IN ('KRW','USD') OR NEW.snapshot->>'currency' IS NULL THEN RAISE EXCEPTION 'Invoice currency must be KRW or USD'; END IF;
IF jsonb_typeof(NEW.snapshot->'line_items') IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.snapshot->'line_items') = 0 THEN RAISE EXCEPTION 'Invoice needs line items'; END IF;
FOR item IN SELECT value FROM jsonb_array_elements(NEW.snapshot->'line_items') LOOP
IF (item->>'unit_price')::numeric < 0 OR (item->>'quantity')::numeric <= 0 THEN RAISE EXCEPTION 'Invalid invoice line amount'; END IF;
IF NEW.snapshot->>'currency' = 'KRW' AND ((item->>'unit_price')::numeric <> trunc((item->>'unit_price')::numeric) OR (item->>'quantity')::numeric <> trunc((item->>'quantity')::numeric)) THEN RAISE EXCEPTION 'KRW invoice amounts and quantities must be integers'; END IF;
END LOOP;
IF (NEW.snapshot->>'vat_rate')::numeric < 0 OR (NEW.snapshot->>'vat_rate')::numeric > 100 THEN RAISE EXCEPTION 'Invalid invoice VAT'; END IF;
IF TG_OP = 'UPDATE' AND NEW.invoice_number IS DISTINCT FROM OLD.invoice_number THEN RAISE EXCEPTION 'Invoice numbers cannot change'; END IF;
RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.finance_validate_invoice() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER finance_invoice_validate BEFORE INSERT OR UPDATE ON public.finance_invoices FOR EACH ROW EXECUTE FUNCTION public.finance_validate_invoice();