CREATE OR REPLACE FUNCTION public.is_in_subtree(_ancestor_id uuid, _descendant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH RECURSIVE tree AS (
    SELECT p.user_id, 0 AS depth FROM public.profiles p
    WHERE p.parent_id = _ancestor_id AND p.sales_role IS NOT NULL
      AND (auth.role() = 'service_role'
        OR pg_trigger_depth() > 0
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR (auth.uid() IS NOT NULL AND _ancestor_id = auth.uid()))
    UNION ALL
    SELECT p.user_id, t.depth + 1 FROM public.profiles p
    JOIN tree t ON p.parent_id = t.user_id
    WHERE p.sales_role IS NOT NULL AND t.depth < 5
  ) SELECT EXISTS (SELECT 1 FROM tree WHERE user_id = _descendant_id);
$function$;
REVOKE EXECUTE ON FUNCTION public.is_in_subtree(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_in_subtree(uuid,uuid) TO authenticated, service_role;
-- This helper is used only by the privileged commission sanitation trigger.
-- It is not a browser API, so authenticated callers must not execute it directly.
REVOKE EXECUTE ON FUNCTION public.get_commission_recipient_depth(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_commission_recipient_depth(uuid,uuid) TO service_role;
COMMENT ON FUNCTION public.is_in_subtree(uuid,uuid) IS 'Caller-scoped boolean traversal: own root, admin, service role, or nested validation triggers; no arbitrary client hierarchy probing.';
COMMENT ON FUNCTION public.get_commission_recipient_depth(uuid,uuid) IS 'Internal commission sanitation helper; direct client execution prohibited.';