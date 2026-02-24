
CREATE OR REPLACE FUNCTION public.get_sales_subtree(_user_id uuid)
 RETURNS TABLE(user_id uuid, full_name text, sales_role text, sales_level integer, parent_id uuid, depth integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH RECURSIVE tree AS (
    SELECT p.user_id, p.full_name, p.sales_role, p.sales_level, p.parent_id, 0 AS depth
    FROM profiles p
    WHERE p.parent_id = _user_id AND p.sales_role IS NOT NULL
    
    UNION ALL
    
    SELECT p.user_id, p.full_name, p.sales_role, p.sales_level, p.parent_id, t.depth + 1
    FROM profiles p
    JOIN tree t ON p.parent_id = t.user_id
    WHERE p.sales_role IS NOT NULL AND t.depth < 5
  )
  SELECT * FROM tree;
$function$;
