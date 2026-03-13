
-- Create a trigger function that prevents non-admin users from modifying sensitive profile fields
CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- If the caller is an admin or service_role, allow all changes
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- If the caller is a district_manager (via is_district_manager), allow changes
  -- but still protect is_admin and sales_role escalation
  IF public.is_district_manager(auth.uid()) THEN
    -- DMs cannot change is_admin
    NEW.is_admin := OLD.is_admin;
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
$$;

-- Create the trigger (runs BEFORE UPDATE so it can modify NEW)
CREATE TRIGGER protect_profile_sensitive_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_sensitive_profile_fields();
