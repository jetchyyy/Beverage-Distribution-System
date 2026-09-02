-- ============================================================================
-- MIGRATION: ADD MISSING COLUMNS TO SALES TABLE
-- File: supabase/migrations/20260903000005_add_sales_pundo_columns.sql
-- ============================================================================

-- Add missing columns to sales table if not present
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS bottle_pundo_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS case_pundo_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'PAID',
ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'DELIVERED';

-- Reload Supabase PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
