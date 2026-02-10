
-- Create namsan_viewpoints table for admin blog-like posts
CREATE TABLE public.namsan_viewpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title_ko TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  content_ko TEXT NOT NULL DEFAULT '',
  content_en TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.namsan_viewpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active viewpoints"
ON public.namsan_viewpoints FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage viewpoints"
ON public.namsan_viewpoints FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_namsan_viewpoints_updated_at
BEFORE UPDATE ON public.namsan_viewpoints
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for viewpoint images
INSERT INTO storage.buckets (id, name, public) VALUES ('viewpoint-images', 'viewpoint-images', true);

CREATE POLICY "Anyone can view viewpoint images"
ON storage.objects FOR SELECT
USING (bucket_id = 'viewpoint-images');

CREATE POLICY "Admins can upload viewpoint images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'viewpoint-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update viewpoint images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'viewpoint-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete viewpoint images"
ON storage.objects FOR DELETE
USING (bucket_id = 'viewpoint-images' AND auth.uid() IS NOT NULL);
