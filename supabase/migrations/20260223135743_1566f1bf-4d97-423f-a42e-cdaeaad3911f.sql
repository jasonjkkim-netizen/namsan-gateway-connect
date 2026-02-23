
-- Role hierarchy levels: DM=1, PA=2, Agent=3, Client=4
-- A sponsor's role level must be LESS than the new user's role level

CREATE OR REPLACE FUNCTION public.validate_hierarchy_depth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Prevent self-referencing
  IF NEW.parent_id = NEW.user_id THEN
    RAISE EXCEPTION 'A user cannot be their own parent';
  END IF;

  -- Define role hierarchy levels
  -- district_manager=1, principal_agent=2, agent=3, client=4
  new_role_level := CASE NEW.sales_role
    WHEN 'district_manager' THEN 1
    WHEN 'principal_agent' THEN 2
    WHEN 'agent' THEN 3
    WHEN 'client' THEN 4
    ELSE 0
  END;

  -- Get parent info
  SELECT sales_role, sales_level INTO parent_role, parent_level
  FROM profiles WHERE user_id = NEW.parent_id;

  IF parent_role IS NULL THEN
    RAISE EXCEPTION 'Sponsor does not have a sales role';
  END IF;

  parent_role_level := CASE parent_role
    WHEN 'district_manager' THEN 1
    WHEN 'principal_agent' THEN 2
    WHEN 'agent' THEN 3
    WHEN 'client' THEN 4
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

  -- Enforce max 4 sub-layers
  IF NEW.sales_level > 4 THEN
    RAISE EXCEPTION 'Maximum hierarchy depth of 4 levels exceeded';
  END IF;

  -- Prevent cycles
  IF public.is_in_subtree(NEW.user_id, NEW.parent_id) THEN
    RAISE EXCEPTION 'Hierarchy cycle detected';
  END IF;

  RETURN NEW;
END;
$$;
