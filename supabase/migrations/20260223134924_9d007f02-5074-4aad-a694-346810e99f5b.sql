
-- ============================================================
-- STEP 1: MLM Sales Hierarchy System
-- Schema extensions, new tables, hierarchy functions, RLS
-- ============================================================

-- 1A. Extend profiles table with sales hierarchy fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sales_role text,
  ADD COLUMN IF NOT EXISTS parent_id uuid,
  ADD COLUMN IF NOT EXISTS sales_level integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preferred_currency varchar(3) DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS sales_status text DEFAULT 'pending';

-- Add constraint for valid sales roles
ALTER TABLE public.profiles
  ADD CONSTRAINT chk_sales_role CHECK (
    sales_role IS NULL OR sales_role IN ('district_manager', 'principal_agent', 'agent', 'client')
  );

-- Add constraint for valid sales status
ALTER TABLE public.profiles
  ADD CONSTRAINT chk_sales_status CHECK (
    sales_status IS NULL OR sales_status IN ('pending', 'active', 'suspended', 'rejected')
  );

-- Self-referential FK for hierarchy
ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_parent
  FOREIGN KEY (parent_id) REFERENCES public.profiles(user_id)
  ON DELETE SET NULL;

-- Index for fast subtree queries
CREATE INDEX IF NOT EXISTS idx_profiles_parent_id ON public.profiles(parent_id);
CREATE INDEX IF NOT EXISTS idx_profiles_sales_role ON public.profiles(sales_role);
CREATE INDEX IF NOT EXISTS idx_profiles_sales_status ON public.profiles(sales_status);

-- 1B. Extend investment_products with commission fields
ALTER TABLE public.investment_products
  ADD COLUMN IF NOT EXISTS target_return_percent numeric(10,4),
  ADD COLUMN IF NOT EXISTS fixed_return_percent numeric(10,4),
  ADD COLUMN IF NOT EXISTS management_fee_percent numeric(10,4),
  ADD COLUMN IF NOT EXISTS performance_fee_percent numeric(10,4),
  ADD COLUMN IF NOT EXISTS upfront_commission_percent numeric(10,4),
  ADD COLUMN IF NOT EXISTS min_investment_amount numeric(20,6),
  ADD COLUMN IF NOT EXISTS default_currency varchar(3) DEFAULT 'USD';

-- 1C. Extend client_investments with realized returns and sales tracking
ALTER TABLE public.client_investments
  ADD COLUMN IF NOT EXISTS invested_currency varchar(3) DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS realized_return_amount numeric(20,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS realized_return_percent numeric(10,4),
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS date_invested date;

-- 1D. Commission rates table (per product per level defaults + overrides)
CREATE TABLE IF NOT EXISTS public.commission_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.investment_products(id) ON DELETE CASCADE,
  sales_role text NOT NULL,
  sales_level integer NOT NULL,
  upfront_rate numeric(10,4) NOT NULL DEFAULT 0,
  performance_rate numeric(10,4) NOT NULL DEFAULT 0,
  min_rate numeric(10,4) DEFAULT 0,
  max_rate numeric(10,4) DEFAULT 100,
  set_by uuid,
  is_override boolean DEFAULT false,
  override_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_cr_sales_role CHECK (
    sales_role IN ('district_manager', 'principal_agent', 'agent')
  ),
  CONSTRAINT chk_cr_rates CHECK (
    upfront_rate >= 0 AND performance_rate >= 0
    AND min_rate >= 0 AND max_rate >= min_rate
    AND upfront_rate >= min_rate AND upfront_rate <= max_rate
    AND performance_rate >= min_rate AND performance_rate <= max_rate
  )
);

CREATE INDEX IF NOT EXISTS idx_commission_rates_product ON public.commission_rates(product_id);
CREATE INDEX IF NOT EXISTS idx_commission_rates_override ON public.commission_rates(override_user_id) WHERE is_override = true;

ALTER TABLE public.commission_rates ENABLE ROW LEVEL SECURITY;

-- 1E. Commission distributions table (audit trail per investment)
CREATE TABLE IF NOT EXISTS public.commission_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id uuid NOT NULL REFERENCES public.client_investments(id) ON DELETE CASCADE,
  from_user_id uuid,
  to_user_id uuid NOT NULL,
  layer integer NOT NULL,
  upfront_amount numeric(20,6) DEFAULT 0,
  performance_amount numeric(20,6) DEFAULT 0,
  rate_used numeric(10,4),
  currency varchar(3) DEFAULT 'USD',
  status text NOT NULL DEFAULT 'available',
  set_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_cd_status CHECK (
    status IN ('available', 'paid', 'voided')
  )
);

CREATE INDEX IF NOT EXISTS idx_commission_dist_investment ON public.commission_distributions(investment_id);
CREATE INDEX IF NOT EXISTS idx_commission_dist_to_user ON public.commission_distributions(to_user_id);
CREATE INDEX IF NOT EXISTS idx_commission_dist_from_user ON public.commission_distributions(from_user_id);

ALTER TABLE public.commission_distributions ENABLE ROW LEVEL SECURITY;

-- 1F. Commission audit log
CREATE TABLE IF NOT EXISTS public.commission_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  target_table text,
  target_id uuid,
  changed_by uuid NOT NULL,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by ON public.commission_audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON public.commission_audit_log(target_table, target_id);

ALTER TABLE public.commission_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. HIERARCHY FUNCTIONS
-- ============================================================

-- 2A. Get all descendants (subtree) of a user
CREATE OR REPLACE FUNCTION public.get_sales_subtree(_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  full_name text,
  sales_role text,
  sales_level integer,
  parent_id uuid,
  depth integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE tree AS (
    SELECT p.user_id, p.full_name, p.sales_role, p.sales_level, p.parent_id, 0 AS depth
    FROM profiles p
    WHERE p.parent_id = _user_id AND p.sales_role IS NOT NULL
    
    UNION ALL
    
    SELECT p.user_id, p.full_name, p.sales_role, p.sales_level, p.parent_id, t.depth + 1
    FROM profiles p
    JOIN tree t ON p.parent_id = t.user_id
    WHERE p.sales_role IS NOT NULL AND t.depth < 4
  )
  SELECT * FROM tree;
$$;

-- 2B. Get all ancestors (upline) of a user
CREATE OR REPLACE FUNCTION public.get_sales_ancestors(_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  full_name text,
  sales_role text,
  sales_level integer,
  depth integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE upline AS (
    SELECT p.user_id, p.full_name, p.sales_role, p.sales_level, 1 AS depth
    FROM profiles p
    WHERE p.user_id = (SELECT parent_id FROM profiles WHERE profiles.user_id = _user_id)
    
    UNION ALL
    
    SELECT p.user_id, p.full_name, p.sales_role, p.sales_level, u.depth + 1
    FROM profiles p
    JOIN upline u ON p.user_id = (SELECT parent_id FROM profiles WHERE profiles.user_id = u.user_id)
    WHERE p.sales_role IS NOT NULL AND u.depth < 4
  )
  SELECT * FROM upline;
$$;

-- 2C. Check if user_b is in the subtree of user_a
CREATE OR REPLACE FUNCTION public.is_in_subtree(_ancestor_id uuid, _descendant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.get_sales_subtree(_ancestor_id) WHERE user_id = _descendant_id
  );
$$;

-- 2D. Validate hierarchy depth trigger (max 4 levels below root)
CREATE OR REPLACE FUNCTION public.validate_hierarchy_depth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_level integer;
  ancestor_count integer;
BEGIN
  -- Skip if no sales_role or no parent
  IF NEW.sales_role IS NULL OR NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Prevent self-referencing
  IF NEW.parent_id = NEW.user_id THEN
    RAISE EXCEPTION 'A user cannot be their own parent';
  END IF;

  -- Count ancestors to determine depth
  SELECT COUNT(*) INTO ancestor_count
  FROM public.get_sales_ancestors(NEW.user_id);

  -- Compute level (ancestor_count + 1, or based on parent)
  SELECT COALESCE(sales_level, 0) INTO parent_level
  FROM profiles WHERE user_id = NEW.parent_id;

  NEW.sales_level := parent_level + 1;

  -- Enforce max 4 sub-layers (level 1-4 for sales roles)
  IF NEW.sales_level > 4 THEN
    RAISE EXCEPTION 'Maximum hierarchy depth of 4 levels exceeded';
  END IF;

  -- Prevent cycles: check descendant isn't becoming ancestor
  IF public.is_in_subtree(NEW.user_id, NEW.parent_id) THEN
    RAISE EXCEPTION 'Hierarchy cycle detected';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_validate_hierarchy
BEFORE INSERT OR UPDATE OF parent_id, sales_role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_hierarchy_depth();

-- ============================================================
-- 3. RLS POLICIES
-- ============================================================

-- 3A. Commission Rates RLS
CREATE POLICY "Admins can manage commission rates"
  ON public.commission_rates FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Sales users can view relevant rates"
  ON public.commission_rates FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      -- User can see default rates for their role
      (NOT is_override)
      OR
      -- Or overrides that apply to them
      (is_override AND override_user_id = auth.uid())
      OR
      -- Or admin
      public.has_role(auth.uid(), 'admin')
    )
  );

-- 3B. Commission Distributions RLS
CREATE POLICY "Admins can manage commission distributions"
  ON public.commission_distributions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own commission distributions"
  ON public.commission_distributions FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      to_user_id = auth.uid()
      OR from_user_id = auth.uid()
      OR public.is_in_subtree(auth.uid(), to_user_id)
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- 3C. Commission Audit Log RLS (admin read-only)
CREATE POLICY "Only admins can view audit log"
  ON public.commission_audit_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can insert audit log"
  ON public.commission_audit_log FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3D. Updated_at trigger for commission_rates
CREATE OR REPLACE TRIGGER update_commission_rates_updated_at
BEFORE UPDATE ON public.commission_rates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
