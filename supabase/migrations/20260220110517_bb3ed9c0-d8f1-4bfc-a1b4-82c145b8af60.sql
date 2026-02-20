
-- Fix 1: Make research-documents bucket private
UPDATE storage.buckets SET public = false WHERE id = 'research-documents';

-- Fix 2: Drop overly permissive product-documents storage SELECT policy and replace with access-checked one
DROP POLICY IF EXISTS "Authenticated users can download product documents" ON storage.objects;

CREATE POLICY "Users can download product documents they have access to"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'product-documents' AND auth.uid() IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM public.product_documents pd
        JOIN public.client_product_access cpa ON cpa.product_id = pd.product_id
        WHERE pd.file_url LIKE '%' || storage.objects.name
        AND cpa.user_id = auth.uid()
      )
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );
