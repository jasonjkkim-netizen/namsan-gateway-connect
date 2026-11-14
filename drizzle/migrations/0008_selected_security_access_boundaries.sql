CREATE OR REPLACE FUNCTION public.is_in_subtree(_ancestor_id uuid, _descendant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE tree AS (
    SELECT p.user_id, 0 AS depth FROM public.profiles p
    WHERE p.parent_id = _ancestor_id AND p.sales_role IS NOT NULL
    UNION ALL
    SELECT p.user_id, t.depth + 1 FROM public.profiles p
    JOIN tree t ON p.parent_id = t.user_id
    WHERE p.sales_role IS NOT NULL AND t.depth < 5
  ) SELECT EXISTS (SELECT 1 FROM tree WHERE user_id = _descendant_id);
$$;
CREATE OR REPLACE FUNCTION public.get_sales_subtree(_user_id uuid)
RETURNS TABLE(user_id uuid, full_name text, sales_role text, sales_level integer, parent_id uuid, depth integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE authorized AS (
    SELECT 1 WHERE auth.role() = 'service_role'
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR (auth.uid() IS NOT NULL AND (_user_id = auth.uid() OR public.is_in_subtree(auth.uid(), _user_id)))
  ), tree AS (
    SELECT p.user_id, p.full_name, p.sales_role, p.sales_level, p.parent_id, 0 AS depth
    FROM public.profiles p
    WHERE p.parent_id = _user_id AND p.sales_role IS NOT NULL AND EXISTS (SELECT 1 FROM authorized)
    UNION ALL
    SELECT p.user_id, p.full_name, p.sales_role, p.sales_level, p.parent_id, t.depth + 1
    FROM public.profiles p JOIN tree t ON p.parent_id = t.user_id
    WHERE p.sales_role IS NOT NULL AND t.depth < 5
  ) SELECT * FROM tree;
$$;
REVOKE EXECUTE ON FUNCTION public.get_sales_subtree(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sales_subtree(uuid) TO authenticated, service_role;
ALTER POLICY "Authenticated users can read stock pick news" ON public.stock_pick_news TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_approved IS TRUE
    AND p.is_deleted IS NOT TRUE AND p.is_rejected IS NOT TRUE
));
ALTER POLICY "Authenticated users can read app settings" ON public.app_settings TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR (
  key IN ('commission_display_currency', 'cio_commentary', 'hk_insurance_benchmark', 'flagship_config') AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_approved IS TRUE
      AND p.is_deleted IS NOT TRUE AND p.is_rejected IS NOT TRUE
  )
));
ALTER POLICY "Anyone can view product images" ON storage.objects TO authenticated
USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Anyone can view blog images" ON storage.objects TO authenticated
USING (bucket_id = 'blog-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Anyone can view viewpoint images" ON storage.objects TO authenticated
USING (bucket_id = 'viewpoint-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));