DROP POLICY "Users can create comments" ON public.board_comments;
CREATE POLICY "Users can create comments"
ON public.board_comments FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  (
    is_admin_reply = false OR
    has_role(auth.uid(), 'admin'::app_role)
  )
);