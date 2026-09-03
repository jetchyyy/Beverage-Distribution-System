-- ============================================================================
-- MIGRATION: ADD CASH REMITTANCE TURNOVER FIELDS TO STOCK TRANSFERS
-- File: supabase/migrations/20260903000010_add_cash_remittance_turnover.sql
-- ============================================================================

ALTER TABLE public.stock_transfers
ADD COLUMN IF NOT EXISTS expected_cash_remittance NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS actual_cash_remitted NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS remittance_variance NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS remittance_received_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS remittance_status TEXT DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS remittance_notes TEXT;

-- Reload Supabase PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
