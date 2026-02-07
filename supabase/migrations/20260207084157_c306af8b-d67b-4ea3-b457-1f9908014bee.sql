-- Add explicit deny policies for anonymous access to sensitive tables

-- 1. PROFILES TABLE - Deny anonymous SELECT access
DROP POLICY IF EXISTS "Deny anonymous access to profiles" ON public.profiles;
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);

-- 2. CLIENT_INVESTMENTS TABLE - Deny anonymous SELECT access
DROP POLICY IF EXISTS "Deny anonymous access to client_investments" ON public.client_investments;
CREATE POLICY "Deny anonymous access to client_investments"
ON public.client_investments
FOR SELECT
TO anon
USING (false);

-- 3. CLIENT_PRODUCT_ACCESS TABLE - Deny anonymous SELECT access
DROP POLICY IF EXISTS "Deny anonymous access to client_product_access" ON public.client_product_access;
CREATE POLICY "Deny anonymous access to client_product_access"
ON public.client_product_access
FOR SELECT
TO anon
USING (false);

-- 4. DISTRIBUTIONS TABLE - Deny anonymous SELECT access (for consistency)
DROP POLICY IF EXISTS "Deny anonymous access to distributions" ON public.distributions;
CREATE POLICY "Deny anonymous access to distributions"
ON public.distributions
FOR SELECT
TO anon
USING (false);

-- 5. USER_ROLES TABLE - Deny anonymous SELECT access
DROP POLICY IF EXISTS "Deny anonymous access to user_roles" ON public.user_roles;
CREATE POLICY "Deny anonymous access to user_roles"
ON public.user_roles
FOR SELECT
TO anon
USING (false);