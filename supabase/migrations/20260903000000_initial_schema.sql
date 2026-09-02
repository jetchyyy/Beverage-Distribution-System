-- ============================================================================
-- MULTI-TENANT BEVERAGE DISTRIBUTION & INVENTORY SYSTEM - SUPABASE SCHEMA
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. TENANTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    business_name TEXT,
    tax_id TEXT,
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    address TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

-- ----------------------------------------------------------------------------
-- 2. PROFILES TABLE (Linked to auth.users & tenants)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('SUPERADMIN', 'TENANT_ADMIN', 'WAREHOUSE_STAFF', 'AGENT', 'ACCOUNTING_REPORT')),
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);

-- ----------------------------------------------------------------------------
-- 3. PRODUCTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT 'San Miguel',
    category TEXT NOT NULL DEFAULT 'Beer',
    description TEXT,
    base_unit TEXT NOT NULL DEFAULT 'BOTTLE',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT products_tenant_sku_key UNIQUE (tenant_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);

-- ----------------------------------------------------------------------------
-- 4. RETURNABLE ITEMS (Empty Bottles & Cases Catalog)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS returnable_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    item_type TEXT NOT NULL CHECK (item_type IN ('BOTTLE', 'CASE', 'CRATE', 'OTHER')),
    type TEXT CHECK (type IN ('BOTTLE', 'CASE', 'CRATE', 'OTHER')),
    unit TEXT NOT NULL DEFAULT 'piece',
    deposit_rate NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (deposit_rate >= 0),
    pundo_value NUMERIC(12,2) DEFAULT 0.00,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT returnable_items_tenant_code_key UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_returnables_tenant ON returnable_items(tenant_id);

-- ----------------------------------------------------------------------------
-- 5. PRODUCT PACKAGING
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_packaging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    package_name TEXT NOT NULL DEFAULT 'CASE',
    units_per_package INTEGER NOT NULL DEFAULT 24 CHECK (units_per_package > 0),
    units_per_case INTEGER DEFAULT 24,
    unit_type TEXT DEFAULT 'bottle',
    case_type TEXT DEFAULT 'case',
    is_returnable BOOLEAN NOT NULL DEFAULT TRUE,
    returnable_item_id UUID REFERENCES returnable_items(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. PRODUCT PRICES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    packaging_id UUID REFERENCES product_packaging(id) ON DELETE CASCADE,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (unit_price >= 0),
    case_price NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (case_price >= 0),
    price NUMERIC(12,2) DEFAULT 0.00,
    unit TEXT DEFAULT 'case',
    effective_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. SUPPLIERS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    supplier_code TEXT NOT NULL,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT suppliers_tenant_code_key UNIQUE (tenant_id, supplier_code)
);

-- ----------------------------------------------------------------------------
-- 8. LOCATIONS (Main Depot Warehouses, Agent Trucks, Micro Stores)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('WAREHOUSE', 'TRUCK', 'MICRO_STORE')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trucks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plate_number TEXT NOT NULL,
    truck_code TEXT NOT NULL,
    description TEXT,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'MAINTENANCE', 'INACTIVE')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT trucks_tenant_code_key UNIQUE (tenant_id, truck_code)
);

CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    employee_code TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    assigned_truck_id UUID REFERENCES trucks(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT agents_tenant_code_key UNIQUE (tenant_id, employee_code)
);

CREATE TABLE IF NOT EXISTS micro_stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_code TEXT NOT NULL,
    store_name TEXT NOT NULL,
    owner_name TEXT,
    phone TEXT,
    address TEXT,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT micro_stores_tenant_code_key UNIQUE (tenant_id, store_code)
);

-- ----------------------------------------------------------------------------
-- 9. INVENTORY BALANCES & RETURNABLE BALANCES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    packaging_id UUID REFERENCES product_packaging(id) ON DELETE CASCADE,
    quantity NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    unit TEXT DEFAULT 'case',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS returnable_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    returnable_item_id UUID NOT NULL REFERENCES returnable_items(id) ON DELETE CASCADE,
    quantity NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT returnable_balances_loc_item_key UNIQUE (location_id, returnable_item_id)
);

-- ----------------------------------------------------------------------------
-- 10. TRANSACTIONS & SALES LEDGERS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sale_number TEXT NOT NULL,
    agent_id UUID NOT NULL REFERENCES agents(id),
    truck_id UUID NOT NULL REFERENCES trucks(id),
    micro_store_id UUID NOT NULL REFERENCES micro_stores(id),
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    bottle_pundo_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    case_pundo_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    payment_status TEXT NOT NULL DEFAULT 'PAID' CHECK (payment_status IN ('PAID', 'PARTIAL', 'CREDIT')),
    delivery_status TEXT NOT NULL DEFAULT 'DELIVERED' CHECK (delivery_status IN ('DELIVERED', 'CANCELLED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT sales_tenant_number_key UNIQUE (tenant_id, sale_number)
);

CREATE TABLE IF NOT EXISTS pundo_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    micro_store_id UUID NOT NULL REFERENCES micro_stores(id) ON DELETE CASCADE,
    returnable_item_id UUID NOT NULL REFERENCES returnable_items(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('DELIVERED_CONTAINER', 'RETURNED_EMPTY', 'DEPOSIT_PAID', 'DEPOSIT_REFUNDED')),
    quantity_change NUMERIC(14,4) NOT NULL,
    pundo_rate NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    balance_quantity NUMERIC(14,4) NOT NULL DEFAULT 0,
    balance_value NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    reference_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- AUTOMATIC PROFILE CREATION TRIGGER FOR AUTH USERS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, tenant_id, full_name, email, role, status)
  VALUES (
    NEW.id,
    (NEW.raw_user_meta_data->>'tenant_id')::UUID,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::TEXT, 'TENANT_ADMIN'),
    'ACTIVE'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- SQL SCRIPT TO ASSIGN SUPERADMIN ROLE TO superadmin@odc.com
-- ----------------------------------------------------------------------------
INSERT INTO public.profiles (id, tenant_id, full_name, email, role, status)
SELECT 
  id, 
  NULL as tenant_id, 
  'Platform Superadmin' as full_name, 
  email, 
  'SUPERADMIN' as role, 
  'ACTIVE' as status
FROM auth.users
WHERE email = 'superadmin@odc.com'
ON CONFLICT (id) 
DO UPDATE SET 
  role = 'SUPERADMIN', 
  tenant_id = NULL, 
  status = 'ACTIVE';
