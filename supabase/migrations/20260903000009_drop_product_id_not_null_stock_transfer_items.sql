-- ============================================================================
-- MIGRATION: DROP NOT NULL CONSTRAINT ON product_id IN stock_transfer_items
-- File: supabase/migrations/20260903000009_drop_product_id_not_null_stock_transfer_items.sql
-- ============================================================================

-- Drop NOT NULL constraint on product_id so returnable containers (which use returnable_item_id) can be inserted
ALTER TABLE public.stock_transfer_items
ALTER COLUMN product_id DROP NOT NULL;

-- Ensure returnable_item_id and item_type columns exist
ALTER TABLE public.stock_transfer_items
ADD COLUMN IF NOT EXISTS returnable_item_id UUID REFERENCES public.returnable_items(id);

ALTER TABLE public.stock_transfer_items
ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'PRODUCT';

-- Reload Supabase PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
