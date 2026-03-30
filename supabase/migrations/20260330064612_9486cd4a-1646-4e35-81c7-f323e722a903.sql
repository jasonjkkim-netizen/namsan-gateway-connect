-- Fix 2: Replace public read policy on research-documents with authenticated-only
DROP POLICY IF EXISTS "Anyone can view research documents" ON storage.objects;

CREATE POLICY "Authenticated users can download research documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'research-documents');