-- Add policy for users to view their own investments
CREATE POLICY "Users can view own investments"
ON public.client_investments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);