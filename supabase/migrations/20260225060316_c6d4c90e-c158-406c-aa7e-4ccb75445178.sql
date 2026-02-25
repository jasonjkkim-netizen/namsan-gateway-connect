
-- Add image_url column to investment_products
ALTER TABLE public.investment_products ADD COLUMN IF NOT EXISTS image_url text DEFAULT NULL;

-- Create public storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow admins to upload product images
CREATE POLICY "Admins can manage product images" ON storage.objects
FOR ALL USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Allow public read access to product images
CREATE POLICY "Anyone can view product images" ON storage.objects
FOR SELECT USING (bucket_id = 'product-images');
