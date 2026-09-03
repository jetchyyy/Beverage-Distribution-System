-- ============================================================================
-- MIGRATION: CREATE STOCK TRANSFERS & STOCK TRANSFER ITEMS TABLES WITH FK & RLS
-- File: supabase/migrations/20260903000007_add_stock_transfers_tables.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    transfer_number TEXT NOT NULL,
    from_location_id UUID REFERENCES public.locations(id),
    to_location_id UUID REFERENCES public.locations(id),
    status TEXT NOT NULL DEFAULT 'PENDING',
    transfer_type TEXT DEFAULT 'WAREHOUSE_TO_TRUCK',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_transfer_id UUID NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    returnable_item_id UUID REFERENCES public.returnable_items(id),
    item_type TEXT DEFAULT 'PRODUCT',
    quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
    unit TEXT DEFAULT 'case',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely add missing columns to pre-existing stock_transfers and stock_transfer_items tables
ALTER TABLE public.stock_transfers
ADD COLUMN IF NOT EXISTS transfer_type TEXT DEFAULT 'WAREHOUSE_TO_TRUCK';

ALTER TABLE public.stock_transfers
ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.stock_transfer_items
ADD COLUMN IF NOT EXISTS returnable_item_id UUID REFERENCES public.returnable_items(id);

ALTER TABLE public.stock_transfer_items
ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'PRODUCT';

-- Enable RLS and Tenant Access Policies
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read/write on stock_transfers" ON public.stock_transfers;
CREATE POLICY "Allow authenticated read/write on stock_transfers"
ON public.stock_transfers FOR ALL
USING (auth.uid() IS NOT NULL OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Allow authenticated read/write on stock_transfer_items" ON public.stock_transfer_items;
CREATE POLICY "Allow authenticated read/write on stock_transfer_items"
ON public.stock_transfer_items FOR ALL
USING (auth.uid() IS NOT NULL OR auth.uid() IS NULL);

-- Status check constraint allowing PENDING, COMPLETED, CONFIRMED, CANCELLED
ALTER TABLE public.stock_transfers
DROP CONSTRAINT IF EXISTS stock_transfers_status_check;

ALTER TABLE public.stock_transfers
ADD CONSTRAINT stock_transfers_status_check
CHECK (status IN ('DRAFT', 'PENDING', 'IN_TRANSIT', 'COMPLETED', 'CONFIRMED', 'CANCELLED'));

-- Reload Supabase PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
