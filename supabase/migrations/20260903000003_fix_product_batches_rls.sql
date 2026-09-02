-- ============================================================================
-- MIGRATION: ADD RLS TENANT POLICY FOR PRODUCT_BATCHES
-- File: supabase/migrations/20260903000003_fix_product_batches_rls.sql
-- ============================================================================

-- Ensure RLS is enabled
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if any
DROP POLICY IF EXISTS product_batches_tenant_policy ON public.product_batches;

-- Create permissive tenant isolation RLS policy
CREATE POLICY product_batches_tenant_policy ON public.product_batches
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    ) 
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'SUPERADMIN'
    )
    OR auth.uid() IS NULL
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    ) 
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'SUPERADMIN'
    )
    OR auth.uid() IS NULL
  );

-- Reload Supabase PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
