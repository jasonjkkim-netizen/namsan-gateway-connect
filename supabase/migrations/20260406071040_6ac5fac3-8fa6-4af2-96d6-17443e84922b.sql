
-- 1. Drop the overly permissive DM update policy
DROP POLICY IF EXISTS "DM can update all profiles" ON public.profiles;

-- 2. Recreate with WITH CHECK that blocks sensitive field changes
CREATE POLICY "DM can update non-privileged profile fields"
  ON public.profiles FOR UPDATE TO authenticated
  USING (is_district_manager(auth.uid()))
  WITH CHECK (
    is_district_manager(auth.uid())
    AND sales_role IS NOT DISTINCT FROM (SELECT p.sales_role FROM profiles p WHERE p.user_id = profiles.user_id)
    AND is_admin IS NOT DISTINCT FROM (SELECT p.is_admin FROM profiles p WHERE p.user_id = profiles.user_id)
    AND parent_id IS NOT DISTINCT FROM (SELECT p.parent_id FROM profiles p WHERE p.user_id = profiles.user_id)
    AND sales_level IS NOT DISTINCT FROM (SELECT p.sales_level FROM profiles p WHERE p.user_id = profiles.user_id)
    AND sales_status IS NOT DISTINCT FROM (SELECT p.sales_status FROM profiles p WHERE p.user_id = profiles.user_id)
    AND is_approved IS NOT DISTINCT FROM (SELECT p.is_approved FROM profiles p WHERE p.user_id = profiles.user_id)
    AND approved_at IS NOT DISTINCT FROM (SELECT p.approved_at FROM profiles p WHERE p.user_id = profiles.user_id)
    AND approved_by IS NOT DISTINCT FROM (SELECT p.approved_by FROM profiles p WHERE p.user_id = profiles.user_id)
    AND is_rejected IS NOT DISTINCT FROM (SELECT p.is_rejected FROM profiles p WHERE p.user_id = profiles.user_id)
    AND rejected_at IS NOT DISTINCT FROM (SELECT p.rejected_at FROM profiles p WHERE p.user_id = profiles.user_id)
    AND rejected_by IS NOT DISTINCT FROM (SELECT p.rejected_by FROM profiles p WHERE p.user_id = profiles.user_id)
    AND is_deleted IS NOT DISTINCT FROM (SELECT p.is_deleted FROM profiles p WHERE p.user_id = profiles.user_id)
    AND deleted_at IS NOT DISTINCT FROM (SELECT p.deleted_at FROM profiles p WHERE p.user_id = profiles.user_id)
    AND deleted_by IS NOT DISTINCT FROM (SELECT p.deleted_by FROM profiles p WHERE p.user_id = profiles.user_id)
  );

-- 3. Drop the overly permissive sales managers update policy
DROP POLICY IF EXISTS "Sales managers can update downline profiles" ON public.profiles;

-- 4. Recreate with WITH CHECK that blocks sensitive field changes
CREATE POLICY "Sales managers can update downline non-privileged fields"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    (auth.uid() IS NOT NULL)
    AND (EXISTS (
      SELECT 1 FROM profiles mgr
      WHERE mgr.user_id = auth.uid()
      AND mgr.sales_role = ANY (ARRAY['district_manager','deputy_district_manager'])
    ))
    AND is_in_subtree(auth.uid(), user_id)
  )
  WITH CHECK (
    sales_role IS NOT DISTINCT FROM (SELECT p.sales_role FROM profiles p WHERE p.user_id = profiles.user_id)
    AND is_admin IS NOT DISTINCT FROM (SELECT p.is_admin FROM profiles p WHERE p.user_id = profiles.user_id)
    AND parent_id IS NOT DISTINCT FROM (SELECT p.parent_id FROM profiles p WHERE p.user_id = profiles.user_id)
    AND sales_level IS NOT DISTINCT FROM (SELECT p.sales_level FROM profiles p WHERE p.user_id = profiles.user_id)
    AND sales_status IS NOT DISTINCT FROM (SELECT p.sales_status FROM profiles p WHERE p.user_id = profiles.user_id)
    AND is_approved IS NOT DISTINCT FROM (SELECT p.is_approved FROM profiles p WHERE p.user_id = profiles.user_id)
    AND approved_at IS NOT DISTINCT FROM (SELECT p.approved_at FROM profiles p WHERE p.user_id = profiles.user_id)
    AND approved_by IS NOT DISTINCT FROM (SELECT p.approved_by FROM profiles p WHERE p.user_id = profiles.user_id)
    AND is_rejected IS NOT DISTINCT FROM (SELECT p.is_rejected FROM profiles p WHERE p.user_id = profiles.user_id)
    AND rejected_at IS NOT DISTINCT FROM (SELECT p.rejected_at FROM profiles p WHERE p.user_id = profiles.user_id)
    AND rejected_by IS NOT DISTINCT FROM (SELECT p.rejected_by FROM profiles p WHERE p.user_id = profiles.user_id)
    AND is_deleted IS NOT DISTINCT FROM (SELECT p.is_deleted FROM profiles p WHERE p.user_id = profiles.user_id)
    AND deleted_at IS NOT DISTINCT FROM (SELECT p.deleted_at FROM profiles p WHERE p.user_id = profiles.user_id)
    AND deleted_by IS NOT DISTINCT FROM (SELECT p.deleted_by FROM profiles p WHERE p.user_id = profiles.user_id)
  );

-- 5. Also harden the trigger to block DMs from changing all sensitive fields
CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- If the caller is an admin or service_role, allow all changes
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- If the caller is a district_manager, allow changes but protect all sensitive fields
  IF public.is_district_manager(auth.uid()) THEN
    NEW.is_admin := OLD.is_admin;
    NEW.sales_role := OLD.sales_role;
    NEW.sales_level := OLD.sales_level;
    NEW.parent_id := OLD.parent_id;
    NEW.is_approved := OLD.is_approved;
    NEW.approved_at := OLD.approved_at;
    NEW.approved_by := OLD.approved_by;
    NEW.is_rejected := OLD.is_rejected;
    NEW.rejected_at := OLD.rejected_at;
    NEW.rejected_by := OLD.rejected_by;
    NEW.is_deleted := OLD.is_deleted;
    NEW.deleted_at := OLD.deleted_at;
    NEW.deleted_by := OLD.deleted_by;
    NEW.sales_status := OLD.sales_status;
    RETURN NEW;
  END IF;

  -- For regular users updating their own profile, revert all sensitive fields to old values
  NEW.sales_role := OLD.sales_role;
  NEW.sales_level := OLD.sales_level;
  NEW.is_admin := OLD.is_admin;
  NEW.parent_id := OLD.parent_id;
  NEW.is_approved := OLD.is_approved;
  NEW.approved_at := OLD.approved_at;
  NEW.approved_by := OLD.approved_by;
  NEW.is_rejected := OLD.is_rejected;
  NEW.rejected_at := OLD.rejected_at;
  NEW.rejected_by := OLD.rejected_by;
  NEW.is_deleted := OLD.is_deleted;
  NEW.deleted_at := OLD.deleted_at;
  NEW.deleted_by := OLD.deleted_by;
  NEW.sales_status := OLD.sales_status;

  RETURN NEW;
END;
$function$;
