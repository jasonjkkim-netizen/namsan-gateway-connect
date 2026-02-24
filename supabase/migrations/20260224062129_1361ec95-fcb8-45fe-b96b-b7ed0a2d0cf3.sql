CREATE OR REPLACE FUNCTION public.validate_hierarchy_depth()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  parent_level integer;
  parent_role text;
  new_role_level integer;
  parent_role_level integer;
BEGIN
  -- Skip if no sales_role or no parent
  IF NEW.sales_role IS NULL OR NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- If this is an UPDATE and only the role changed (not parent_id), skip hierarchy validation
  IF TG_OP = 'UPDATE' AND OLD.parent_id IS NOT DISTINCT FROM NEW.parent_id THEN
    SELECT sales_level INTO parent_level FROM profiles WHERE user_id = NEW.parent_id;
    NEW.sales_level := COALESCE(parent_level, 0) + 1;
    RETURN NEW;
  END IF;

  -- Prevent self-referencing
  IF NEW.parent_id = NEW.user_id THEN
    RAISE EXCEPTION 'A user cannot be their own parent';
  END IF;

  -- Define role hierarchy levels (webmaster is highest at 0)
  new_role_level := CASE NEW.sales_role
    WHEN 'webmaster' THEN 0
    WHEN 'district_manager' THEN 1
    WHEN 'deputy_district_manager' THEN 2
    WHEN 'principal_agent' THEN 3
    WHEN 'agent' THEN 4
    WHEN 'client' THEN 5
    ELSE 0
  END;

  -- Get parent info
  SELECT sales_role, sales_level INTO parent_role, parent_level
  FROM profiles WHERE user_id = NEW.parent_id;

  IF parent_role IS NULL THEN
    RAISE EXCEPTION 'Sponsor does not have a sales role';
  END IF;

  parent_role_level := CASE parent_role
    WHEN 'webmaster' THEN 0
    WHEN 'district_manager' THEN 1
    WHEN 'deputy_district_manager' THEN 2
    WHEN 'principal_agent' THEN 3
    WHEN 'agent' THEN 4
    WHEN 'client' THEN 5
    ELSE 0
  END;

  -- Enforce: sponsor role level must be strictly less than new user's role level
  IF parent_role_level >= new_role_level THEN
    RAISE EXCEPTION 'Sponsor role (%) cannot sponsor a user with role (%). Sponsors can only sponsor roles below their level.', parent_role, NEW.sales_role;
  END IF;

  -- Clients cannot sponsor anyone
  IF parent_role = 'client' THEN
    RAISE EXCEPTION 'Clients cannot sponsor other users';
  END IF;

  -- Compute sales_level from parent
  NEW.sales_level := COALESCE(parent_level, 0) + 1;

  -- Enforce max 5 sub-layers
  IF NEW.sales_level > 5 THEN
    RAISE EXCEPTION 'Maximum hierarchy depth of 5 levels exceeded';
  END IF;

  -- Prevent cycles
  IF public.is_in_subtree(NEW.user_id, NEW.parent_id) THEN
    RAISE EXCEPTION 'Hierarchy cycle detected';
  END IF;

  RETURN NEW;
END;
$function$;