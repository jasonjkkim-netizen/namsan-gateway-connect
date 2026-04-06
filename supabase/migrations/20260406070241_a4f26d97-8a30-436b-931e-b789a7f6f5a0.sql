CREATE POLICY "Deny all direct access to kis_token_cache"
ON public.kis_token_cache
FOR ALL
TO public
USING (false)
WITH CHECK (false);