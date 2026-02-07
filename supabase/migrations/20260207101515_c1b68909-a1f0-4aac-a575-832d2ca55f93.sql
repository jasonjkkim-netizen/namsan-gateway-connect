-- Fix investment_products table - remove conflicting policy
DROP POLICY IF EXISTS "Require authentication for investment_products" ON public.investment_products;