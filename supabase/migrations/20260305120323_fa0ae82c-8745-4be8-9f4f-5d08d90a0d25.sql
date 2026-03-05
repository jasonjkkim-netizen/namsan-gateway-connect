
-- Create a safe profiles view that excludes sensitive PII (phone, address, birthday)
-- Used for subtree/downline access where managers shouldn't see personal details
CREATE VIEW public.profiles_safe
WITH (security_invoker = on) AS
SELECT 
  id, user_id, email, full_name, full_name_ko,
  preferred_language, is_admin, is_approved, approved_at, approved_by,
  created_at, updated_at, sales_role, sales_status, sales_level,
  parent_id, is_deleted, deleted_at, deleted_by, is_rejected, rejected_at, rejected_by,
  preferred_currency
FROM public.profiles;
