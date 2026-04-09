
-- 1. Fix: Scope DM profile SELECT to their subtree only
DROP POLICY IF EXISTS "DM can view all profiles" ON public.profiles;
CREATE POLICY "DM can view subtree profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    is_district_manager(auth.uid())
    AND (
      user_id = auth.uid()
      OR is_in_subtree(auth.uid(), user_id)
    )
  );

-- 2. Fix: is_district_manager() should check approval/deletion status
CREATE OR REPLACE FUNCTION public.is_district_manager(_user_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = _user_id
    AND sales_role = 'district_manager'
    AND is_approved = true
    AND (is_deleted IS NULL OR is_deleted = false)
    AND (is_rejected IS NULL OR is_rejected = false)
  );
$$;

-- 3. Fix: Restrict commission_rates visibility to users with a sales_role
DROP POLICY IF EXISTS "Sales users can view relevant rates" ON public.commission_rates;
CREATE POLICY "Sales users can view relevant rates" ON public.commission_rates
  FOR SELECT TO authenticated
  USING (
    (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.user_id = auth.uid()
        AND p.sales_role IS NOT NULL
        AND p.is_approved = true
        AND (p.is_deleted IS NULL OR p.is_deleted = false)
      )
      AND (
        NOT is_override
        OR (is_override AND override_user_id = auth.uid())
      )
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  );
