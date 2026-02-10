
-- Create blog_posts table
CREATE TABLE public.blog_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title_ko TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  content_ko TEXT NOT NULL DEFAULT '',
  content_en TEXT NOT NULL DEFAULT '',
  summary_ko TEXT,
  summary_en TEXT,
  thumbnail_url TEXT,
  author TEXT NOT NULL DEFAULT 'Namsan Capital',
  is_active BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Anyone can view active blog posts
CREATE POLICY "Anyone can view active blog posts"
  ON public.blog_posts FOR SELECT
  USING (is_active = true);

-- Admins can manage blog posts
CREATE POLICY "Admins can manage blog posts"
  ON public.blog_posts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for blog images
INSERT INTO storage.buckets (id, name, public) VALUES ('blog-images', 'blog-images', true);

-- Storage policies for blog images
CREATE POLICY "Anyone can view blog images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'blog-images');

CREATE POLICY "Admins can upload blog images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'blog-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update blog images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'blog-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete blog images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'blog-images' AND has_role(auth.uid(), 'admin'::app_role));
