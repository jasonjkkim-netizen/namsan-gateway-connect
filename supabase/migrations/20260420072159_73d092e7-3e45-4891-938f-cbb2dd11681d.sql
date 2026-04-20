CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow full changes for server-side / privileged callers:
  -- - service_role (admin edge functions)
  -- - postgres / supabase_admin (DB-level operations, migrations, scheduled jobs)
  -- - any call without an authenticated end user (auth.uid() IS NULL)
  IF auth.role() = 'service_role'
     OR auth.uid() IS NULL
     OR current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  -- If the caller is an admin, allow all changes
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- District managers: keep all sensitive fields locked
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

  -- Regular users: revert all sensitive fields
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