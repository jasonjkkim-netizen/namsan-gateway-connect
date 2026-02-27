
CREATE TABLE public.flagship_portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id text NOT NULL,
  name text NOT NULL,
  ticker text,
  asset_type text NOT NULL DEFAULT 'stock',
  currency text NOT NULL DEFAULT 'KRW',
  recommended_weight numeric NOT NULL DEFAULT 0,
  target_annual_return numeric,
  current_price numeric,
  base_price numeric,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flagship_portfolio_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active flagship items"
ON public.flagship_portfolio_items
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage flagship items"
ON public.flagship_portfolio_items
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_flagship_items_updated_at
  BEFORE UPDATE ON public.flagship_portfolio_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
