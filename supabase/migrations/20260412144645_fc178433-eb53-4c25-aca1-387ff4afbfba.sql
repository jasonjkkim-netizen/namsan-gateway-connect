
-- 1. Revoke public EXECUTE on security helper functions to prevent RPC enumeration
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_district_manager(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_in_subtree(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_sales_subtree(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_sales_ancestors(uuid) FROM PUBLIC, anon, authenticated;

-- Grant to service_role so RLS evaluation and edge functions still work
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_district_manager(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_in_subtree(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_sales_subtree(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_sales_ancestors(uuid) TO service_role;

-- 2. Fix commission_rates admin policy: scope to authenticated only
DROP POLICY IF EXISTS "Admins can manage commission rates" ON public.commission_rates;
CREATE POLICY "Admins can manage commission rates"
  ON public.commission_rates
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
