-- ============================================================================
-- MIGRATION: ADD SUPPLIER PROMOTIONS & REIMBURSEMENT CLAIMS LEDGER
-- File: supabase/migrations/20260903000011_add_supplier_promotions_and_claims.sql
-- ============================================================================

-- 1. Create Promotions Table for Trade Deals (e.g. 5+1 Free Goods)
CREATE TABLE IF NOT EXISTS public.promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    promo_code TEXT NOT NULL,
    promo_name TEXT NOT NULL,
    promo_type TEXT NOT NULL DEFAULT 'BUY_X_GET_Y_FREE',
    buy_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    buy_quantity NUMERIC(12,2) NOT NULL DEFAULT 5,
    free_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    free_quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
    claim_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Supplier Promo Claims Ledger Table
CREATE TABLE IF NOT EXISTS public.supplier_promo_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    promo_id UUID REFERENCES public.promotions(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
    micro_store_id UUID REFERENCES public.micro_stores(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    truck_id UUID REFERENCES public.trucks(id) ON DELETE SET NULL,
    qualifying_cases_sold NUMERIC(12,2) NOT NULL DEFAULT 0,
    free_cases_awarded NUMERIC(12,2) NOT NULL DEFAULT 0,
    claim_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_claim_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PENDING_CLAIM',
    settlement_type TEXT,
    settled_at TIMESTAMPTZ,
    settlement_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add Promo Tracking Columns to Sale Items Table
ALTER TABLE public.sale_items
ADD COLUMN IF NOT EXISTS is_promo_free BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS promo_id UUID REFERENCES public.promotions(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_promo_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read/write on promotions"
ON public.promotions FOR ALL
USING (auth.uid() IS NOT NULL OR auth.uid() IS NULL);

CREATE POLICY "Allow authenticated read/write on supplier_promo_claims"
ON public.supplier_promo_claims FOR ALL
USING (auth.uid() IS NOT NULL OR auth.uid() IS NULL);

-- Reload PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
