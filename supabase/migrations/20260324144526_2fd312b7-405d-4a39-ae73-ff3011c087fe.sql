
-- Singleton table to track the getUpdates offset
CREATE TABLE public.telegram_bot_state (
  id int PRIMARY KEY CHECK (id = 1),
  update_offset bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.telegram_bot_state (id, update_offset) VALUES (1, 0);

ALTER TABLE public.telegram_bot_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only service role can access telegram_bot_state"
  ON public.telegram_bot_state
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Table for storing incoming Telegram messages
CREATE TABLE public.telegram_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id bigint UNIQUE NOT NULL,
  chat_id bigint NOT NULL,
  text text,
  has_document boolean DEFAULT false,
  document_file_id text,
  document_file_name text,
  is_processed boolean DEFAULT false,
  processed_at timestamptz,
  research_report_id uuid REFERENCES public.research_reports(id),
  raw_update jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_messages_chat_id ON public.telegram_messages (chat_id);
CREATE INDEX idx_telegram_messages_processed ON public.telegram_messages (is_processed);

ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only service role can access telegram_messages"
  ON public.telegram_messages
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can view telegram messages"
  ON public.telegram_messages
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
