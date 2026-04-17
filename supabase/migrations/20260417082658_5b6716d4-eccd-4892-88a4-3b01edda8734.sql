-- Allow approved authenticated members to download research documents from the private bucket
CREATE POLICY "Approved members can download research documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'research-documents'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.is_approved = true
      AND (p.is_deleted IS NULL OR p.is_deleted = false)
      AND (p.is_rejected IS NULL OR p.is_rejected = false)
  )
);