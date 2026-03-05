
-- Remove the subtree visibility policy from base profiles table
-- Subtree access should go through profiles_safe view instead (no phone/address/birthday)
DROP POLICY IF EXISTS "Authenticated profile visibility boundary" ON public.profiles;
