-- Scope helper-function-based policies to authenticated only, so the anon role
-- never evaluates public.has_role() (EXECUTE was revoked from anon).

DROP POLICY IF EXISTS "Admins can manage blog posts" ON public.blog_posts;
CREATE POLICY "Admins can manage blog posts" ON public.blog_posts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone authenticated can view public comments" ON public.board_comments;
CREATE POLICY "Anyone authenticated can view public comments" ON public.board_comments FOR SELECT TO authenticated
  USING ((auth.uid() IS NOT NULL) AND ((is_public = true) OR (user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Users can create comments" ON public.board_comments;
CREATE POLICY "Users can create comments" ON public.board_comments FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id) AND ((is_admin_reply = false) OR public.has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Users can delete own comments or admin" ON public.board_comments;
CREATE POLICY "Users can delete own comments or admin" ON public.board_comments FOR DELETE TO authenticated
  USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone authenticated can view public posts" ON public.board_posts;
CREATE POLICY "Anyone authenticated can view public posts" ON public.board_posts FOR SELECT TO authenticated
  USING ((auth.uid() IS NOT NULL) AND ((is_public = true) OR (user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Users can delete own posts or admin" ON public.board_posts;
CREATE POLICY "Users can delete own posts or admin" ON public.board_posts FOR DELETE TO authenticated
  USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can update own posts" ON public.board_posts;
CREATE POLICY "Users can update own posts" ON public.board_posts FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage product access" ON public.client_product_access;
CREATE POLICY "Admins can manage product access" ON public.client_product_access FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Only admins can view audit log" ON public.commission_audit_log;
CREATE POLICY "Only admins can view audit log" ON public.commission_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage all distributions" ON public.distributions;
CREATE POLICY "Admins can manage all distributions" ON public.distributions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage flagship items" ON public.flagship_portfolio_items;
CREATE POLICY "Admins can manage flagship items" ON public.flagship_portfolio_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage interest news" ON public.interest_news;
CREATE POLICY "Admins can manage interest news" ON public.interest_news FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage products" ON public.investment_products;
CREATE POLICY "Admins can manage products" ON public.investment_products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view products they have access to" ON public.investment_products;
CREATE POLICY "Users can view products they have access to" ON public.investment_products FOR SELECT TO authenticated
  USING ((auth.uid() IS NOT NULL) AND ((EXISTS (
      SELECT 1 FROM public.client_product_access
      WHERE client_product_access.product_id = investment_products.id
        AND client_product_access.user_id = auth.uid()
    )) OR public.has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Admins can manage market items" ON public.market_overview_items;
CREATE POLICY "Admins can manage market items" ON public.market_overview_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage viewpoints" ON public.namsan_viewpoints;
CREATE POLICY "Admins can manage viewpoints" ON public.namsan_viewpoints FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage newsletters" ON public.newsletters;
CREATE POLICY "Admins can manage newsletters" ON public.newsletters FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Deny non-admin access to newsletters" ON public.newsletters;
CREATE POLICY "Deny non-admin access to newsletters" ON public.newsletters FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage sync log" ON public.notion_sync_log;
CREATE POLICY "Admins can manage sync log" ON public.notion_sync_log FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage popup ads" ON public.popup_ads;
CREATE POLICY "Admins can manage popup ads" ON public.popup_ads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage product documents" ON public.product_documents;
CREATE POLICY "Admins can manage product documents" ON public.product_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view documents for accessible products" ON public.product_documents;
CREATE POLICY "Users can view documents for accessible products" ON public.product_documents FOR SELECT TO authenticated
  USING ((auth.uid() IS NOT NULL) AND ((EXISTS (
      SELECT 1 FROM public.client_product_access
      WHERE client_product_access.product_id = product_documents.product_id
        AND client_product_access.user_id = auth.uid()
    )) OR public.has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Admins can permanently delete profiles" ON public.profiles;
CREATE POLICY "Admins can permanently delete profiles" ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage research" ON public.research_reports;
CREATE POLICY "Admins can manage research" ON public.research_reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view telegram messages" ON public.telegram_messages;
CREATE POLICY "Admins can view telegram messages" ON public.telegram_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage videos" ON public.videos;
CREATE POLICY "Admins can manage videos" ON public.videos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage stock picks" ON public.weekly_stock_picks;
CREATE POLICY "Admins can manage stock picks" ON public.weekly_stock_picks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));