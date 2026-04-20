CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow full changes when called from service_role (e.g., admin edge functions)
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- If the caller is an admin, allow all changes
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