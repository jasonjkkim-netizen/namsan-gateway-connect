ALTER TABLE public.profiles DROP CONSTRAINT chk_sales_role;
ALTER TABLE public.profiles ADD CONSTRAINT chk_sales_role CHECK (
  sales_role IS NULL OR sales_role = ANY (ARRAY['district_manager','deputy_district_manager','principal_agent','agent','client'])
);