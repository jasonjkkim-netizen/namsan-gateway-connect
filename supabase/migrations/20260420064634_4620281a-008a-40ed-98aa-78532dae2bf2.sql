-- Restore admin_note column SELECT/INSERT/UPDATE permissions to authenticated role.
-- Rationale: Postgres column-level GRANTs apply per Postgres role (authenticated/anon),
-- not per application role (admin via user_roles). Revoking admin_note from
-- 'authenticated' broke the Admin Research management page because the admin client
-- also connects as 'authenticated'. Sensitive column protection should be enforced
-- at the application layer (Research.tsx already excludes admin_note from its SELECT),
-- and via the existing RLS policy "Admins can manage research" for write access.

GRANT SELECT (admin_note), INSERT (admin_note), UPDATE (admin_note)
  ON public.research_reports TO authenticated;

-- Note: anon role has no access (RLS only allows authenticated SELECT on is_active rows).
-- Application code must continue to omit admin_note from non-admin SELECT statements
-- (see src/pages/Research.tsx which lists explicit columns).