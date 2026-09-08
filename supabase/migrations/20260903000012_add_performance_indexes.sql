-- ============================================================================
-- MIGRATION: ADD HIGH-PERFORMANCE DATABASE INDEXES & QUERY OPTIMIZATIONS
-- File: supabase/migrations/20260903000012_add_performance_indexes.sql
-- ============================================================================

-- 1. Sales & Sale Items Indexes
CREATE INDEX IF NOT EXISTS idx_sales_tenant_created ON public.sales(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_micro_store ON public.sales(micro_store_id);
CREATE INDEX IF NOT EXISTS idx_sales_agent ON public.sales(agent_id);
CREATE INDEX IF NOT EXISTS idx_sales_truck ON public.sales(truck_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON public.sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_promo_id ON public.sale_items(promo_id);

-- 2. Pundo Ledger Indexes (Customer Empties Deposit Tracking)
ALTER TABLE public.pundo_ledger ADD COLUMN IF NOT EXISTS reference_id UUID;

CREATE INDEX IF NOT EXISTS idx_pundo_ledger_tenant_created ON public.pundo_ledger(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pundo_ledger_store ON public.pundo_ledger(micro_store_id);
CREATE INDEX IF NOT EXISTS idx_pundo_ledger_item ON public.pundo_ledger(returnable_item_id);
CREATE INDEX IF NOT EXISTS idx_pundo_ledger_ref ON public.pundo_ledger(reference_id);

-- 3. Inventory Balances & Returnable Balances Indexes
CREATE INDEX IF NOT EXISTS idx_inv_balances_tenant_loc ON public.inventory_balances(tenant_id, location_id);
CREATE INDEX IF NOT EXISTS idx_inv_balances_product ON public.inventory_balances(product_id);
CREATE INDEX IF NOT EXISTS idx_ret_balances_tenant_loc ON public.returnable_balances(tenant_id, location_id);
CREATE INDEX IF NOT EXISTS idx_ret_balances_item ON public.returnable_balances(returnable_item_id);

-- 4. Stock Transfers & Transfer Items Indexes
CREATE INDEX IF NOT EXISTS idx_stock_transfers_tenant_created ON public.stock_transfers(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from_loc ON public.stock_transfers(from_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_to_loc ON public.stock_transfers(to_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON public.stock_transfers(status);

CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_transfer ON public.stock_transfer_items(stock_transfer_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_product ON public.stock_transfer_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_returnable ON public.stock_transfer_items(returnable_item_id);

-- 5. Promotions & Supplier Promo Claims Indexes
CREATE INDEX IF NOT EXISTS idx_promotions_tenant ON public.promotions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_promotions_buy_product ON public.promotions(buy_product_id);
CREATE INDEX IF NOT EXISTS idx_promotions_supplier ON public.promotions(supplier_id);

CREATE INDEX IF NOT EXISTS idx_supplier_claims_tenant_created ON public.supplier_promo_claims(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_claims_promo ON public.supplier_promo_claims(promo_id);
CREATE INDEX IF NOT EXISTS idx_supplier_claims_supplier ON public.supplier_promo_claims(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_claims_sale ON public.supplier_promo_claims(sale_id);
CREATE INDEX IF NOT EXISTS idx_supplier_claims_store ON public.supplier_promo_claims(micro_store_id);

-- 6. Stock In Receipts & Items Indexes
CREATE INDEX IF NOT EXISTS idx_stock_in_receipts_tenant ON public.stock_in_receipts(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_in_receipts_supplier ON public.stock_in_receipts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_stock_in_items_receipt ON public.stock_in_items(stock_in_receipt_id);
CREATE INDEX IF NOT EXISTS idx_stock_in_items_product ON public.stock_in_items(product_id);

-- 7. Master Catalog, Fleet & Customer Store Indexes
CREATE INDEX IF NOT EXISTS idx_micro_stores_tenant ON public.micro_stores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_micro_stores_location ON public.micro_stores(location_id);
CREATE INDEX IF NOT EXISTS idx_trucks_tenant ON public.trucks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trucks_location ON public.trucks(location_id);
CREATE INDEX IF NOT EXISTS idx_agents_tenant ON public.agents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agents_user ON public.agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_truck ON public.agents(assigned_truck_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON public.suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_tenant ON public.warehouses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_locations_tenant ON public.locations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_packaging_tenant_prod ON public.product_packaging(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_prices_tenant_prod ON public.product_prices(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_batches_tenant_prod ON public.product_batches(tenant_id, product_id);

-- 8. Refresh and reload PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
