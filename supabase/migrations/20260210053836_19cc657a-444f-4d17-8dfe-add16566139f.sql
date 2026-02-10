
-- Create newsletters table to track sent newsletters
CREATE TABLE public.newsletters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_ko TEXT NOT NULL DEFAULT '',
  subject_en TEXT NOT NULL DEFAULT '',
  content_ko TEXT NOT NULL DEFAULT '',
  content_en TEXT NOT NULL DEFAULT '',
  blog_post_id UUID REFERENCES public.blog_posts(id) ON DELETE SET NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_by UUID,
  recipient_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.newsletters ENABLE ROW LEVEL SECURITY;

-- Only admins can manage newsletters
CREATE POLICY "Admins can manage newsletters"
  ON public.newsletters FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
