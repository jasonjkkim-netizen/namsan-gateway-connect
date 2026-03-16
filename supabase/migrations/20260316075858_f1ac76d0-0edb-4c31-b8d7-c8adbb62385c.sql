
-- Drop the existing permissive self-update policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Recreate with WITH CHECK that prevents changing sensitive columns
-- The WITH CHECK ensures the new row still has the same values for privilege columns
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO public
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND sales_role IS NOT DISTINCT FROM (SELECT p.sales_role FROM profiles p WHERE p.user_id = auth.uid())
  AND sales_level IS NOT DISTINCT FROM (SELECT p.sales_level FROM profiles p WHERE p.user_id = auth.uid())
  AND is_admin IS NOT DISTINCT FROM (SELECT p.is_admin FROM profiles p WHERE p.user_id = auth.uid())
  AND parent_id IS NOT DISTINCT FROM (SELECT p.parent_id FROM profiles p WHERE p.user_id = auth.uid())
  AND is_approved IS NOT DISTINCT FROM (SELECT p.is_approved FROM profiles p WHERE p.user_id = auth.uid())
  AND approved_at IS NOT DISTINCT FROM (SELECT p.approved_at FROM profiles p WHERE p.user_id = auth.uid())
  AND approved_by IS NOT DISTINCT FROM (SELECT p.approved_by FROM profiles p WHERE p.user_id = auth.uid())
  AND is_rejected IS NOT DISTINCT FROM (SELECT p.is_rejected FROM profiles p WHERE p.user_id = auth.uid())
  AND rejected_at IS NOT DISTINCT FROM (SELECT p.rejected_at FROM profiles p WHERE p.user_id = auth.uid())
  AND rejected_by IS NOT DISTINCT FROM (SELECT p.rejected_by FROM profiles p WHERE p.user_id = auth.uid())
  AND is_deleted IS NOT DISTINCT FROM (SELECT p.is_deleted FROM profiles p WHERE p.user_id = auth.uid())
  AND deleted_at IS NOT DISTINCT FROM (SELECT p.deleted_at FROM profiles p WHERE p.user_id = auth.uid())
  AND deleted_by IS NOT DISTINCT FROM (SELECT p.deleted_by FROM profiles p WHERE p.user_id = auth.uid())
  AND sales_status IS NOT DISTINCT FROM (SELECT p.sales_status FROM profiles p WHERE p.user_id = auth.uid())
);
