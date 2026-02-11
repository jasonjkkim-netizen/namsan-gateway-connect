
-- Add rejection tracking columns to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_rejected boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS rejected_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS rejected_by uuid;
