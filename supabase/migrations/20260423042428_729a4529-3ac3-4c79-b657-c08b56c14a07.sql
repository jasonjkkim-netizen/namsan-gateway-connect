DROP POLICY IF EXISTS "Anyone authenticated can read alert settings" ON public.alert_settings;

DROP POLICY IF EXISTS "DM can view subtree profiles" ON public.profiles;

DROP POLICY IF EXISTS "Sales users can view downline investments" ON public.client_investments;
DROP POLICY IF EXISTS "DM can view all investments" ON public.client_investments;

CREATE OR REPLACE FUNCTION public.get_manager_subtree_profiles(_manager_id uuid)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  full_name_ko text,
  sales_role text,
  sales_status text,
  sales_level integer,
  parent_id uuid,
  is_approved boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id,
         p.full_name,
         p.full_name_ko,
         p.sales_role,
         p.sales_status,
         p.sales_level,
         p.parent_id,
         p.is_approved,
         p.created_at
  FROM public.profiles p
  WHERE (
    auth.uid() = _manager_id
    AND EXISTS (
      SELECT 1
      FROM public.profiles mgr
      WHERE mgr.user_id = auth.uid()
        AND mgr.sales_role = ANY (ARRAY['webmaster'::text, 'district_manager'::text, 'deputy_district_manager'::text, 'principal_agent'::text, 'agent'::text])
    )
    AND (p.user_id = _manager_id OR public.is_in_subtree(_manager_id, p.user_id))
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

REVOKE ALL ON FUNCTION public.get_manager_subtree_profiles(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_manager_subtree_profiles(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_manager_subtree_investment_summaries(_manager_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  product_id uuid,
  product_name_en text,
  product_name_ko text,
  status text,
  start_date date,
  maturity_date date,
  invested_currency character varying,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ci.id,
         ci.user_id,
         ci.product_id,
         ci.product_name_en,
         ci.product_name_ko,
         ci.status,
         ci.start_date,
         ci.maturity_date,
         ci.invested_currency,
         ci.created_at
  FROM public.client_investments ci
  WHERE (
    auth.uid() = _manager_id
    AND EXISTS (
      SELECT 1
      FROM public.profiles mgr
      WHERE mgr.user_id = auth.uid()
        AND mgr.sales_role = ANY (ARRAY['webmaster'::text, 'district_manager'::text, 'deputy_district_manager'::text, 'principal_agent'::text, 'agent'::text])
    )
    AND public.is_in_subtree(_manager_id, ci.user_id)
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

REVOKE ALL ON FUNCTION public.get_manager_subtree_investment_summaries(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_manager_subtree_investment_summaries(uuid) TO authenticated;