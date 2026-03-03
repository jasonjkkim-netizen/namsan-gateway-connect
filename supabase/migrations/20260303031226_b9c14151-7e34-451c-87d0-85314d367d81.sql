
-- Create board_posts table
CREATE TABLE public.board_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'other',
  title text NOT NULL,
  content text NOT NULL,
  is_public boolean NOT NULL DEFAULT true,
  is_resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create board_comments table
CREATE TABLE public.board_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.board_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  is_admin_reply boolean NOT NULL DEFAULT false,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.board_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_comments ENABLE ROW LEVEL SECURITY;

-- board_posts policies
CREATE POLICY "Anyone authenticated can view public posts"
  ON public.board_posts FOR SELECT
  USING (auth.uid() IS NOT NULL AND (is_public = true OR user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Users can create posts"
  ON public.board_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
  ON public.board_posts FOR UPDATE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete own posts or admin"
  ON public.board_posts FOR DELETE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Deny anonymous access to board_posts"
  ON public.board_posts FOR SELECT
  USING (false);

-- board_comments policies
CREATE POLICY "Anyone authenticated can view public comments"
  ON public.board_comments FOR SELECT
  USING (auth.uid() IS NOT NULL AND (is_public = true OR user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Users can create comments"
  ON public.board_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments or admin"
  ON public.board_comments FOR DELETE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Deny anonymous access to board_comments"
  ON public.board_comments FOR SELECT
  USING (false);

-- Trigger for updated_at
CREATE TRIGGER update_board_posts_updated_at
  BEFORE UPDATE ON public.board_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
