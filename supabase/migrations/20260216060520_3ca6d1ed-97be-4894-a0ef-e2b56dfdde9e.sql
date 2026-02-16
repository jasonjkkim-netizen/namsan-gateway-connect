
-- Create storage bucket for research PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('research-documents', 'research-documents', true);

-- Allow authenticated users to view research documents
CREATE POLICY "Anyone can view research documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'research-documents');

-- Only admins can upload research documents
CREATE POLICY "Admins can upload research documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'research-documents' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Only admins can delete research documents
CREATE POLICY "Admins can delete research documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'research-documents' AND public.has_role(auth.uid(), 'admin'::public.app_role));
