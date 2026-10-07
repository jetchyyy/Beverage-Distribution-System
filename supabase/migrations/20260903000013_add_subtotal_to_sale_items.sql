-- ============================================================================
-- MIGRATION: ENSURE SUBTOTAL COLUMN EXISTS ON SALE ITEMS
-- File: supabase/migrations/20260903000013_add_subtotal_to_sale_items.sql
-- ============================================================================

ALTER TABLE public.sale_items 
ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0.00;

-- Reload Supabase PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
