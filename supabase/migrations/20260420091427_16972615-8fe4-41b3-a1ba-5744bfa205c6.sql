-- Allow upline members to update their own layer in commission distributions
-- (金額/상태만 변경 가능, 다른 필드는 트리거로 보호)

CREATE POLICY "Recipients can update their own commission rows"
ON public.commission_distributions
FOR UPDATE
TO authenticated
USING (to_user_id = auth.uid())
WITH CHECK (to_user_id = auth.uid());

-- Trigger to prevent recipients from changing structural fields
CREATE OR REPLACE FUNCTION public.protect_commission_distribution_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins can change anything
  IF has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Non-admins (recipients) cannot change structural fields
  IF NEW.to_user_id IS DISTINCT FROM OLD.to_user_id
     OR NEW.from_user_id IS DISTINCT FROM OLD.from_user_id
     OR NEW.investment_id IS DISTINCT FROM OLD.investment_id
     OR NEW.layer IS DISTINCT FROM OLD.layer THEN
    RAISE EXCEPTION 'Only admins can modify structural fields of commission distributions';
  END IF;

  -- Track who set this
  NEW.set_by_user_id := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_commission_distribution_fields_trg ON public.commission_distributions;
CREATE TRIGGER protect_commission_distribution_fields_trg
BEFORE UPDATE ON public.commission_distributions
FOR EACH ROW
EXECUTE FUNCTION public.protect_commission_distribution_fields();