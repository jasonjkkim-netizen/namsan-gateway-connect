-- Fix profiles table RLS policies
-- Drop conflicting RESTRICTIVE SELECT policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Deny anonymous access to profiles" ON public.profiles;

-- Create a single PERMISSIVE SELECT policy that allows authenticated users to view their own profile or admins to view all
CREATE POLICY "Authenticated users can view own profile or admins all"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix client_investments table RLS policies
-- Drop conflicting RESTRICTIVE SELECT policies
DROP POLICY IF EXISTS "Users can view own investments" ON public.client_investments;
DROP POLICY IF EXISTS "Admins can select all investments" ON public.client_investments;
DROP POLICY IF EXISTS "Deny anonymous access to client_investments" ON public.client_investments;

-- Create a single PERMISSIVE SELECT policy
CREATE POLICY "Authenticated users can view own investments or admins all"
ON public.client_investments
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Similarly fix distributions table for consistency
DROP POLICY IF EXISTS "Users can view their own distributions" ON public.distributions;
DROP POLICY IF EXISTS "Deny anonymous access to distributions" ON public.distributions;

CREATE POLICY "Authenticated users can view own distributions or admins all"
ON public.distributions
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix client_product_access table
DROP POLICY IF EXISTS "Users can view their own product access" ON public.client_product_access;
DROP POLICY IF EXISTS "Deny anonymous access to client_product_access" ON public.client_product_access;

CREATE POLICY "Authenticated users can view own product access or admins all"
ON public.client_product_access
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix user_roles table
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Deny anonymous access to user_roles" ON public.user_roles;

CREATE POLICY "Authenticated users can view own roles or admins all"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'admin'::app_role)
);