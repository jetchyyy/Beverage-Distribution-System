-- ============================================================================
-- MIGRATION: SEED RETURNABLE CONTAINERS FOR ALL PRODUCTS
-- File: supabase/migrations/20260903000014_fix_returnable_items_unique_and_seed.sql
-- ============================================================================

-- 1. Ensure subtotal column exists on sale_items
ALTER TABLE public.sale_items 
ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0.00;

-- 2. Differentiate any duplicate container codes (e.g. RC Cola Bottle vs Case)
UPDATE public.returnable_items
SET code = code || '-' || item_type
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id, code ORDER BY created_at) as rn
        FROM public.returnable_items
        WHERE code IS NOT NULL
    ) t WHERE t.rn > 1
);

-- 3. Automatically create official returnable items for all products (e.g. San Miguel Beer Bottle & Case)
INSERT INTO public.returnable_items (tenant_id, code, name, item_type, type, deposit_rate, pundo_value, unit, product_id, is_active)
SELECT 
    p.tenant_id,
    'RET-' || UPPER(REGEXP_REPLACE(COALESCE(p.sku, p.name), '[^a-zA-Z0-9]+', '-', 'g')) || '-BTL',
    p.name || ' Bottle',
    'BOTTLE',
    'BOTTLE',
    10.00,
    10.00,
    'bottle',
    p.id,
    true
FROM public.products p
WHERE NOT EXISTS (
    SELECT 1 FROM public.returnable_items r 
    WHERE r.tenant_id = p.tenant_id 
      AND (
          r.product_id = p.id 
          OR r.name = p.name || ' Bottle'
          OR r.code = 'RET-' || UPPER(REGEXP_REPLACE(COALESCE(p.sku, p.name), '[^a-zA-Z0-9]+', '-', 'g')) || '-BTL'
      )
);

INSERT INTO public.returnable_items (tenant_id, code, name, item_type, type, deposit_rate, pundo_value, unit, product_id, is_active)
SELECT 
    p.tenant_id,
    'RET-' || UPPER(REGEXP_REPLACE(COALESCE(p.sku, p.name), '[^a-zA-Z0-9]+', '-', 'g')) || '-CASE',
    p.name || ' Case',
    'CASE',
    'CASE',
    50.00,
    50.00,
    'case',
    p.id,
    true
FROM public.products p
WHERE NOT EXISTS (
    SELECT 1 FROM public.returnable_items r 
    WHERE r.tenant_id = p.tenant_id 
      AND (
          r.product_id = p.id 
          OR r.name = p.name || ' Case'
          OR r.code = 'RET-' || UPPER(REGEXP_REPLACE(COALESCE(p.sku, p.name), '[^a-zA-Z0-9]+', '-', 'g')) || '-CASE'
      )
);

-- 4. Reload Supabase PostgREST schema cache
NOTIFY pgrst, 'reload schema';
