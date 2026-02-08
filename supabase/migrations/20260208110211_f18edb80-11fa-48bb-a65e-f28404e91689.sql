-- Add safeguards against privilege escalation in user_roles table
-- Prevent users from inserting roles for themselves (only admins can assign roles)

-- Drop existing INSERT policy if it exists (we'll create a more restrictive one)
DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;

-- Create a restrictive INSERT policy - only existing admins can create new roles
CREATE POLICY "Only admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Prevent DELETE of admin roles to maintain at least one admin
-- (Admins can still manage roles but this adds an audit trail concern)
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

-- Create a DELETE policy that only allows admins to delete non-admin roles
-- or their own non-admin roles (prevents complete lockout)
CREATE POLICY "Admins can delete roles with restrictions"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND (
    -- Cannot delete the last admin role
    role != 'admin'::app_role 
    OR (
      SELECT COUNT(*) FROM public.user_roles WHERE role = 'admin'::app_role
    ) > 1
  )
);

-- Prevent users from updating their own role to admin (self-escalation)
DROP POLICY IF EXISTS "Users can update own roles" ON public.user_roles;

-- Create UPDATE policy - only admins can update roles, and they can't demote the last admin
CREATE POLICY "Only admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND (
    -- If updating to non-admin, always allowed
    role != 'admin'::app_role 
    OR 
    -- If keeping as admin, ensure at least one admin remains
    (SELECT COUNT(*) FROM public.user_roles WHERE role = 'admin'::app_role) >= 1
  )
);

-- Add explicit deny for anonymous users on user_roles
DROP POLICY IF EXISTS "Deny anonymous access to user_roles" ON public.user_roles;
CREATE POLICY "Deny anonymous access to user_roles"
ON public.user_roles
FOR SELECT
TO anon
USING (false);