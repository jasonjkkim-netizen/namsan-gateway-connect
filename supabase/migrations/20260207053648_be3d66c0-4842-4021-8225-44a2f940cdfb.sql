-- Add PERMISSIVE policies for the profiles table
-- These ensure only authenticated users can access profile data

-- Users can view their own profile (PERMISSIVE)
CREATE POLICY "Users can select own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all profiles (PERMISSIVE)
CREATE POLICY "Admins can select all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert profiles (PERMISSIVE)
CREATE POLICY "Admins can insert profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users can insert their own profile (PERMISSIVE) - needed for profile creation on signup
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);