-- Drop the overly permissive policy that allows any authenticated user to see all profiles
DROP POLICY IF EXISTS "Require authentication for profiles" ON public.profiles;