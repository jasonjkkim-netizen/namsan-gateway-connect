CREATE OR REPLACE FUNCTION public.protect_commission_distribution_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role) OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.to_user_id IS DISTINCT FROM OLD.to_user_id
     OR NEW.from_user_id IS DISTINCT FROM OLD.from_user_id
     OR NEW.investment_id IS DISTINCT FROM OLD.investment_id
     OR NEW.layer IS DISTINCT FROM OLD.layer
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.upfront_amount IS DISTINCT FROM OLD.upfront_amount
     OR NEW.performance_amount IS DISTINCT FROM OLD.performance_amount
     OR NEW.currency IS DISTINCT FROM OLD.currency THEN
    RAISE EXCEPTION 'Only admins can modify payout fields of commission distributions';
  END IF;

  NEW.set_by_user_id := auth.uid();
  RETURN NEW;
END;
$function$;