
-- Create product_documents table
CREATE TABLE public.product_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.investment_products(id) ON DELETE CASCADE,
  name_ko TEXT NOT NULL DEFAULT '',
  name_en TEXT NOT NULL DEFAULT '',
  document_type TEXT NOT NULL DEFAULT 'other',
  file_url TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_documents ENABLE ROW LEVEL SECURITY;

-- Admins can manage all documents
CREATE POLICY "Admins can manage product documents"
  ON public.product_documents
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can view documents for products they have access to
CREATE POLICY "Users can view documents for accessible products"
  ON public.product_documents
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM client_product_access
        WHERE client_product_access.product_id = product_documents.product_id
        AND client_product_access.user_id = auth.uid()
      )
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- Create storage bucket for product documents
INSERT INTO storage.buckets (id, name, public) VALUES ('product-documents', 'product-documents', false);

-- Storage policies: admins can upload
CREATE POLICY "Admins can upload product documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-documents' AND has_role(auth.uid(), 'admin'::app_role));

-- Admins can update product documents
CREATE POLICY "Admins can update product documents"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-documents' AND has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete product documents
CREATE POLICY "Admins can delete product documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'product-documents' AND has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can download product documents
CREATE POLICY "Authenticated users can download product documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-documents' AND auth.uid() IS NOT NULL);
