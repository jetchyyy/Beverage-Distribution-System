-- Ensure pundo_rate exists on pundo_ledger
ALTER TABLE public.pundo_ledger 
ADD COLUMN IF NOT EXISTS pundo_rate NUMERIC(12,2) NOT NULL DEFAULT 0.00;

-- Also ensure balance_quantity and balance_value exist
ALTER TABLE public.pundo_ledger 
ADD COLUMN IF NOT EXISTS balance_quantity NUMERIC(14,4) NOT NULL DEFAULT 0;

ALTER TABLE public.pundo_ledger 
ADD COLUMN IF NOT EXISTS balance_value NUMERIC(12,2) NOT NULL DEFAULT 0.00;

ALTER TABLE public.pundo_ledger 
ADD COLUMN IF NOT EXISTS reference_id UUID;

-- Notify postgrest to reload its schema cache
NOTIFY pgrst, 'reload schema';
