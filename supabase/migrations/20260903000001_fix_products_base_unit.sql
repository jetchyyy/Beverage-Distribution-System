-- ============================================================================
-- MIGRATION: FIX PRODUCTS BASE_UNIT & SCHEMA CACHE RELOAD
-- File: supabase/migrations/20260903000001_fix_products_base_unit.sql
-- ============================================================================

-- 1. Ensure base_unit column exists in public.products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS base_unit TEXT NOT NULL DEFAULT 'BOTTLE';

-- 2. Ensure product_packaging compatibility columns
ALTER TABLE public.product_packaging
ADD COLUMN IF NOT EXISTS units_per_package INTEGER NOT NULL DEFAULT 24 CHECK (units_per_package > 0),
ADD COLUMN IF NOT EXISTS is_returnable BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS returnable_item_id UUID REFERENCES public.returnable_items(id) ON DELETE SET NULL;

-- 3. Ensure product_prices compatibility columns
ALTER TABLE public.product_prices
ADD COLUMN IF NOT EXISTS packaging_id UUID REFERENCES public.product_packaging(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (unit_price >= 0),
ADD COLUMN IF NOT EXISTS case_price NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (case_price >= 0),
ADD COLUMN IF NOT EXISTS effective_date TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 4. Ensure returnable_items compatibility columns
ALTER TABLE public.returnable_items
ADD COLUMN IF NOT EXISTS code TEXT,
ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'BOTTLE',
ADD COLUMN IF NOT EXISTS deposit_rate NUMERIC(12,2) DEFAULT 0.00 CHECK (deposit_rate >= 0);

-- 5. Ensure agents table has user_id reference
ALTER TABLE public.agents
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 6. Reload Supabase PostgREST schema cache
NOTIFY pgrst, 'reload schema';
