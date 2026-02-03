-- Create client_product_access table to control which products each client can see
CREATE TABLE public.client_product_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.investment_products(id) ON DELETE CASCADE,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  granted_by UUID,
  UNIQUE(user_id, product_id)
);

-- Enable RLS
ALTER TABLE public.client_product_access ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own product access
CREATE POLICY "Users can view their own product access"
ON public.client_product_access
FOR SELECT
USING (auth.uid() = user_id);

-- Create user_roles table for admin functionality
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Policy: Users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Admins can manage all roles
CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Policy: Admins can manage client_product_access
CREATE POLICY "Admins can manage product access"
ON public.client_product_access
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Policy: Admins can manage all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Policy: Admins can manage all investments
CREATE POLICY "Admins can manage all investments"
ON public.client_investments
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Policy: Admins can manage all distributions
CREATE POLICY "Admins can manage all distributions"
ON public.distributions
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Policy: Admins can manage investment products
CREATE POLICY "Admins can manage products"
ON public.investment_products
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Policy: Admins can manage research reports
CREATE POLICY "Admins can manage research"
ON public.research_reports
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Policy: Admins can manage videos
CREATE POLICY "Admins can manage videos"
ON public.videos
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));