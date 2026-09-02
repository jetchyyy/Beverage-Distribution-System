-- ============================================================================
-- MIGRATION: FIX STOCK TRANSFERS STATUS CHECK CONSTRAINT
-- File: supabase/migrations/20260903000004_fix_stock_transfers_status_check.sql
-- ============================================================================

-- Drop old restricted status constraint if exists
ALTER TABLE public.stock_transfers
DROP CONSTRAINT IF EXISTS stock_transfers_status_check;

-- Add updated status check constraint allowing COMPLETED & CONFIRMED
ALTER TABLE public.stock_transfers
ADD CONSTRAINT stock_transfers_status_check
CHECK (status IN ('DRAFT', 'PENDING', 'IN_TRANSIT', 'COMPLETED', 'CONFIRMED', 'CANCELLED'));

-- Reload Supabase PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
