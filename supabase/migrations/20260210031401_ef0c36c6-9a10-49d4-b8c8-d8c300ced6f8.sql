
CREATE TABLE public.research_memos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT 'Admin',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

ALTER TABLE public.research_memos ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read memos
CREATE POLICY "Authenticated users can view memos"
  ON public.research_memos FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admins can manage memos
CREATE POLICY "Admins can insert memos"
  ON public.research_memos FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update memos"
  ON public.research_memos FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete memos"
  ON public.research_memos FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Deny anonymous
CREATE POLICY "Deny anonymous access to research_memos"
  ON public.research_memos FOR SELECT
  USING (false);

-- Timestamp trigger
CREATE TRIGGER update_research_memos_updated_at
  BEFORE UPDATE ON public.research_memos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
