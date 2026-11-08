-- Public pages expose only active editorial and market content, never member data.
DO $migration$
DECLARE policy_row record; table_row record; function_row record;
  public_tables text[] := ARRAY['blog_posts','interest_news','namsan_viewpoints','market_indices','market_overview_items','weekly_stock_picks'];
BEGIN
  FOR policy_row IN SELECT tablename,policyname,roles,qual,with_check FROM pg_policies WHERE schemaname='public' AND (roles @> ARRAY['public']::name[] OR roles @> ARRAY['anon']::name[]) LOOP
    IF policy_row.qual = 'false' AND (policy_row.with_check IS NULL OR policy_row.with_check = 'false') THEN
      EXECUTE format('DROP POLICY %I ON public.%I',policy_row.policyname,policy_row.tablename);
    ELSIF policy_row.tablename = ANY(public_tables) AND policy_row.qual = '(is_active = true)' THEN
      EXECUTE format('ALTER POLICY %I ON public.%I TO anon, authenticated',policy_row.policyname,policy_row.tablename);
    ELSIF coalesce(policy_row.qual,policy_row.with_check,'') LIKE '%service_role%' THEN
      EXECUTE format('ALTER POLICY %I ON public.%I TO service_role',policy_row.policyname,policy_row.tablename);
    ELSE
      EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated',policy_row.policyname,policy_row.tablename);
    END IF;
  END LOOP;
  FOR table_row IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f') LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, PUBLIC',table_row.relname);
    IF table_row.relname = ANY(public_tables) THEN
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon',table_row.relname);
    END IF;
  END LOOP;
  FOR function_row IN SELECT fn.oid::regprocedure AS signature FROM pg_proc fn JOIN pg_namespace n ON n.oid=fn.pronamespace WHERE n.nspname='public' AND fn.prokind='f' LOOP
    IF has_function_privilege('authenticated',function_row.signature,'EXECUTE') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',function_row.signature);
    END IF;
    IF has_function_privilege('service_role',function_row.signature,'EXECUTE') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',function_row.signature);
    END IF;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, PUBLIC',function_row.signature);
  END LOOP;
END
$migration$;