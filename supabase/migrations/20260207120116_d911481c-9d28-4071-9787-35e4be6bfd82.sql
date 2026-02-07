-- Add approval status column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS approved_by uuid;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.is_approved IS 'Whether the user account has been approved by admin';
COMMENT ON COLUMN public.profiles.approved_at IS 'Timestamp when the account was approved';
COMMENT ON COLUMN public.profiles.approved_by IS 'Admin user_id who approved the account';