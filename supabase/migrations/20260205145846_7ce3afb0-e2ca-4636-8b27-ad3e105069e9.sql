-- Add PERMISSIVE policies for profiles table
CREATE POLICY "Users can view own profile permissive"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles permissive"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add PERMISSIVE policies for client_investments table
CREATE POLICY "Users can view own investments permissive"
ON public.client_investments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all investments permissive"
ON public.client_investments
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));