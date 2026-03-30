-- Fix 1: Make profiles_safe view use SECURITY INVOKER so it inherits caller's RLS
ALTER VIEW public.profiles_safe SET (security_invoker = true);