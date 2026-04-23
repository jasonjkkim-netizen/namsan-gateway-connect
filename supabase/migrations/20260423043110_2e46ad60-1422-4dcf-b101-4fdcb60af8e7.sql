CREATE OR REPLACE FUNCTION public.get_commission_recipient_depth(_investment_id uuid, _recipient_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.depth
  FROM public.client_investments ci
  JOIN public.get_sales_ancestors(ci.user_id) a ON true
  WHERE ci.id = _investment_id
    AND a.user_id = _recipient_id
  ORDER BY a.depth
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_commission_recipient_depth(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_commission_recipient_depth(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.sanitize_commission_distribution_chain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  valid_depth integer;
  investment_owner uuid;
BEGIN
  SELECT ci.user_id
  INTO investment_owner
  FROM public.client_investments ci
  WHERE ci.id = NEW.investment_id;

  IF investment_owner IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT public.get_commission_recipient_depth(NEW.investment_id, NEW.to_user_id)
  INTO valid_depth;

  IF valid_depth IS NULL THEN
    RETURN NULL;
  END IF;

  NEW.from_user_id := investment_owner;
  NEW.layer := valid_depth;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sanitize_commission_distribution_chain_trigger ON public.commission_distributions;
CREATE TRIGGER sanitize_commission_distribution_chain_trigger
BEFORE INSERT OR UPDATE ON public.commission_distributions
FOR EACH ROW
EXECUTE FUNCTION public.sanitize_commission_distribution_chain();