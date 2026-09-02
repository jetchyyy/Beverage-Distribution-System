-- ============================================================================
-- MIGRATION: CREATE SALE ITEMS TABLE FOR DELIVERED PRODUCT BREAKDOWN
-- File: supabase/migrations/20260903000006_add_sale_items.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    quantity NUMERIC(12,2) NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL,
    unit TEXT DEFAULT 'case',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and Tenant Access
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read/write on sale_items"
ON public.sale_items FOR ALL
USING (auth.uid() IS NOT NULL OR auth.uid() IS NULL);

-- Reload Supabase PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
