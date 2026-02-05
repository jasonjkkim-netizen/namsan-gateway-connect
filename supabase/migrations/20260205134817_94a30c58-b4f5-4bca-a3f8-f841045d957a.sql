-- Fix RLS Policies Missing Authentication Verification
-- Add explicit auth.uid() IS NOT NULL check to all user-scoped policies

-- 1. Fix profiles table policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 2. Fix client_investments table policy
DROP POLICY IF EXISTS "Users can view their own investments" ON public.client_investments;
CREATE POLICY "Users can view their own investments" ON public.client_investments
  FOR SELECT USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 3. Fix distributions table policy
DROP POLICY IF EXISTS "Users can view their own distributions" ON public.distributions;
CREATE POLICY "Users can view their own distributions" ON public.distributions
  FOR SELECT USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 4. Fix client_product_access table policy
DROP POLICY IF EXISTS "Users can view their own product access" ON public.client_product_access;
CREATE POLICY "Users can view their own product access" ON public.client_product_access
  FOR SELECT USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 5. Fix user_roles table policy
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);