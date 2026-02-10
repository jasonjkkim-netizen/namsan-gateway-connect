-- Fix blog_posts RLS: change restrictive policies to permissive
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Anyone can view active blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins can manage blog posts" ON public.blog_posts;

-- Recreate as PERMISSIVE (default)
CREATE POLICY "Anyone can view active blog posts"
ON public.blog_posts
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage blog posts"
ON public.blog_posts
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));