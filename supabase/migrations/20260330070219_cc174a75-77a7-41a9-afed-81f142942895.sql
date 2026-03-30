CREATE TABLE IF NOT EXISTS public.kis_token_cache (
  id integer PRIMARY KEY DEFAULT 1,
  access_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE public.kis_token_cache ENABLE ROW LEVEL SECURITY;
