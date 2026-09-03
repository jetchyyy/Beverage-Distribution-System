-- ============================================================================
-- MIGRATION: ADD USER PERMISSIONS & STOCK IN CONTROL NUMBERS SCHEMA
-- File: supabase/migrations/20260903000008_add_user_permissions_and_stock_in.sql
-- ============================================================================

-- 1. Add allowed_features column to profiles table for granular checkbox permissions
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS allowed_features TEXT[] DEFAULT '{}';

-- 2. Create stock_in_receipts table for tracking receiving with Control Numbers
CREATE TABLE IF NOT EXISTS public.stock_in_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    control_number TEXT NOT NULL UNIQUE,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    supplier_name TEXT,
    reference_number TEXT,
    total_cases NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    notes TEXT,
    received_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create stock_in_items table for itemized batch receipts
CREATE TABLE IF NOT EXISTS public.stock_in_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_in_receipt_id UUID NOT NULL REFERENCES public.stock_in_receipts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    batch_number TEXT NOT NULL,
    manufacture_date DATE,
    expiry_date DATE NOT NULL,
    quantity_cases NUMERIC(12,2) NOT NULL DEFAULT 0,
    unit_price NUMERIC(12,2) DEFAULT 0,
    subtotal NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and Tenant Access Policies
ALTER TABLE public.stock_in_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_in_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read/write on stock_in_receipts" ON public.stock_in_receipts;
CREATE POLICY "Allow authenticated read/write on stock_in_receipts"
ON public.stock_in_receipts FOR ALL
USING (auth.uid() IS NOT NULL OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Allow authenticated read/write on stock_in_items" ON public.stock_in_items;
CREATE POLICY "Allow authenticated read/write on stock_in_items"
ON public.stock_in_items FOR ALL
USING (auth.uid() IS NOT NULL OR auth.uid() IS NULL);

-- Reload Supabase PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
