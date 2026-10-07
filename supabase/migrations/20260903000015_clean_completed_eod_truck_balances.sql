-- Clean up returnable container balances for trucks that have already completed their EOD reconciliation offload
UPDATE returnable_balances rb
SET quantity = 0, updated_at = NOW()
WHERE rb.location_id IN (
  SELECT DISTINCT st.from_location_id
  FROM stock_transfers st
  WHERE st.transfer_type = 'TRUCK_OFFLOAD_EOD'
    AND st.status = 'COMPLETED'
    AND st.created_at >= CURRENT_DATE
);

-- Also ensure inventory balances for completed EOD transfers are zeroed if offloaded
UPDATE inventory_balances ib
SET quantity = 0, updated_at = NOW()
WHERE ib.location_id IN (
  SELECT DISTINCT st.from_location_id
  FROM stock_transfers st
  WHERE st.transfer_type = 'TRUCK_OFFLOAD_EOD'
    AND st.status = 'COMPLETED'
    AND st.created_at >= CURRENT_DATE
);
