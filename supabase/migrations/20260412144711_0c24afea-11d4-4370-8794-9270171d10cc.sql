
-- Re-grant to authenticated so RLS policies continue to work
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_district_manager(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_in_subtree(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sales_subtree(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sales_ancestors(uuid) TO authenticated;
