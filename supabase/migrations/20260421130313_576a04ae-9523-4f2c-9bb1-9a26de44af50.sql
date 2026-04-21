
DROP POLICY IF EXISTS "Anyone can read stock pick news" ON public.stock_pick_news;

CREATE POLICY "Authenticated users can read stock pick news"
ON public.stock_pick_news
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
