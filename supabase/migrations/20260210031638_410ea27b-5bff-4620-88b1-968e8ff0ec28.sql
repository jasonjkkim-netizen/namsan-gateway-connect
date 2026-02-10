
-- Add admin note field to research_reports
ALTER TABLE public.research_reports ADD COLUMN admin_note TEXT;

-- Drop the separate memos table (no longer needed)
DROP TABLE IF EXISTS public.research_memos;
