ALTER TABLE public.investment_products
  ADD COLUMN maturity_date date NULL,
  ADD COLUMN issue_date date NULL;