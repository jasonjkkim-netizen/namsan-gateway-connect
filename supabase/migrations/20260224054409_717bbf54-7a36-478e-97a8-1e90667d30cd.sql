-- Helper function: check if user is a district_manager
CREATE OR REPLACE FUNCTION public.is_district_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = _user_id
    AND sales_role = 'district_manager'
  );
$$;

-- DM can view ALL profiles (not just subtree)
CREATE POLICY "DM can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (is_district_manager(auth.uid()));

-- DM can update ALL profiles (not just subtree)
CREATE POLICY "DM can update all profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (is_district_manager(auth.uid()));

-- DM can view ALL client investments
CREATE POLICY "DM can view all investments"
ON public.client_investments FOR SELECT TO authenticated
USING (is_district_manager(auth.uid()));

-- DM can insert investments for any client
CREATE POLICY "DM can insert investments"
ON public.client_investments FOR INSERT TO authenticated
WITH CHECK (is_district_manager(auth.uid()));

-- DM can update any investment
CREATE POLICY "DM can update investments"
ON public.client_investments FOR UPDATE TO authenticated
USING (is_district_manager(auth.uid()));