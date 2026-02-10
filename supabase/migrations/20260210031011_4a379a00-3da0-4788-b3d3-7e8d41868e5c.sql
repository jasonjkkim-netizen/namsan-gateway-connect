
-- Table to cache stock pick news from Perplexity
CREATE TABLE public.stock_pick_news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stock_name TEXT NOT NULL,
  stock_code TEXT,
  news_bullets JSONB NOT NULL DEFAULT '[]'::jsonb,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_pick_news ENABLE ROW LEVEL SECURITY;

-- Public read access (market data is public)
CREATE POLICY "Anyone can read stock pick news"
  ON public.stock_pick_news FOR SELECT USING (true);

-- Only service role can insert/update
CREATE POLICY "Service role can manage stock pick news"
  ON public.stock_pick_news FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Index for quick lookups
CREATE INDEX idx_stock_pick_news_fetched_at ON public.stock_pick_news(fetched_at DESC);

-- Schedule daily at 3:30 PM KST (6:30 AM UTC) Mon-Fri
SELECT cron.schedule(
  'fetch-stock-pick-news',
  '30 6 * * 1-5',
  $$SELECT net.http_post(
    url := 'https://xjeballtxihphcahksuh.supabase.co/functions/v1/stock-pick-news',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqZWJhbGx0eGlocGhjYWhrc3VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMjQ0MTQsImV4cCI6MjA4NTcwMDQxNH0.T3H_QGVNNtHqphDPIWHKdYAPuBPlzXn4eS2kWWiGxD8'
    ),
    body := '{}'::jsonb
  );$$
);
