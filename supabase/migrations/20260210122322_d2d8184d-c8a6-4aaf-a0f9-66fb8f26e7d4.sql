
DROP POLICY IF EXISTS "Admins can upload viewpoint images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update viewpoint images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete viewpoint images" ON storage.objects;

CREATE POLICY "Admins can upload viewpoint images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'viewpoint-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update viewpoint images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'viewpoint-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete viewpoint images"
ON storage.objects FOR DELETE
USING (bucket_id = 'viewpoint-images' AND has_role(auth.uid(), 'admin'::app_role));
