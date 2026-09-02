-- ============================================================================
-- MIGRATION: ADD PRODUCT BATCHES FOR FIFO & PRINTABLE STICKER LABELS
-- File: supabase/migrations/20260903000002_add_product_batches_fifo.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.product_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    batch_number TEXT NOT NULL,
    manufacture_date DATE,
    expiry_date DATE NOT NULL,
    initial_quantity NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (initial_quantity >= 0),
    remaining_quantity NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (remaining_quantity >= 0),
    unit TEXT NOT NULL DEFAULT 'case',
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'DEPLETED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT product_batches_tenant_prod_batch_key UNIQUE (tenant_id, product_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_product_batches_expiry ON public.product_batches(tenant_id, product_id, expiry_date);

ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;

-- Reload Supabase PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
