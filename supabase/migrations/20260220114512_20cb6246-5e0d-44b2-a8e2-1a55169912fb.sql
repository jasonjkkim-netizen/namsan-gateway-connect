-- Add content columns to interest_news table
ALTER TABLE public.interest_news
ADD COLUMN content_ko text DEFAULT '' NOT NULL,
ADD COLUMN content_en text DEFAULT '' NOT NULL;