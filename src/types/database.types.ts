export type UserRole = 'SUPERADMIN' | 'TENANT_ADMIN' | 'WAREHOUSE_STAFF' | 'AGENT' | 'ACCOUNTING_REPORT';

export type MovementType =
  | 'PURCHASE_RECEIPT'
  | 'STOCK_TRANSFER'
  | 'SALE_DELIVERY'
  | 'RETURNABLE_EMPTY_RETURN'
  | 'INVENTORY_ADJUSTMENT'
  | 'DAMAGE_LOSS';

export type LocationType = 'WAREHOUSE' | 'TRUCK' | 'MICRO_STORE';

export type AdjustmentReason =
  | 'DAMAGED'
  | 'BROKEN'
  | 'LOST'
  | 'COUNTING_ERROR'
  | 'SYSTEM_CORRECTION'
  | 'OTHER';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  business_name?: string | null;
  tax_id?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  tenant_id?: string | null;
  full_name: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  description?: string | null;
  base_unit: string;
  is_active: boolean;
  created_at: string;
}

export interface ProductBatch {
  id: string;
  tenant_id: string;
  product_id: string;
  batch_number: string;
  manufacture_date?: string | null;
  expiry_date: string;
  initial_quantity: number;
  remaining_quantity: number;
  unit: string;
  status: 'ACTIVE' | 'EXPIRED' | 'DEPLETED';
  created_at: string;
}

export interface ProductPackaging {
  id: string;
  tenant_id: string;
  product_id: string;
  package_name: string;
  units_per_package: number;
  is_returnable: boolean;
  returnable_item_id?: string | null;
  created_at: string;
}

export interface ProductPrice {
  id: string;
  tenant_id: string;
  product_id: string;
  packaging_id?: string | null;
  unit_price: number;
  case_price: number;
  price?: number;
  effective_date: string;
  created_at: string;
}

export interface ReturnableItem {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  item_type: 'BOTTLE' | 'CASE';
  type?: 'BOTTLE' | 'CASE';
  unit?: string;
  deposit_rate: number;
  pundo_value?: number;
  is_active: boolean;
  created_at: string;
}

export interface Supplier {
  id: string;
  tenant_id: string;
  supplier_code: string;
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Location {
  id: string;
  tenant_id: string;
  name: string;
  type: LocationType;
  is_active: boolean;
  created_at: string;
}

export interface Warehouse {
  id: string;
  tenant_id: string;
  name: string;
  address?: string | null;
  location_id: string;
  is_active: boolean;
  created_at: string;
}

export interface Truck {
  id: string;
  tenant_id: string;
  plate_number: string;
  truck_code: string;
  description?: string | null;
  location_id: string;
  status: 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
  created_at: string;
}

export interface Agent {
  id: string;
  tenant_id: string;
  user_id?: string | null;
  employee_code: string;
  full_name: string;
  phone?: string | null;
  assigned_truck_id?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
}

export interface MicroStore {
  id: string;
  tenant_id: string;
  store_code: string;
  store_name: string;
  owner_name?: string | null;
  phone?: string | null;
  address?: string | null;
  location_id?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
}

export interface InventoryBalance {
  id: string;
  tenant_id: string;
  location_id: string;
  product_id: string;
  packaging_id?: string | null;
  quantity: number;
  updated_at: string;
}

export interface ReturnableBalance {
  id: string;
  tenant_id: string;
  location_id: string;
  returnable_item_id: string;
  quantity: number;
  updated_at: string;
}

export interface Sale {
  id: string;
  tenant_id: string;
  sale_number: string;
  agent_id: string;
  truck_id: string;
  micro_store_id: string;
  subtotal: number;
  bottle_pundo_amount: number;
  case_pundo_amount: number;
  total: number;
  payment_status: 'PAID' | 'PARTIAL' | 'CREDIT';
  delivery_status: 'DELIVERED' | 'CANCELLED';
  created_at: string;
}

export interface PundoLedger {
  id: string;
  tenant_id: string;
  micro_store_id: string;
  returnable_item_id: string;
  transaction_type: 'DELIVERED_CONTAINER' | 'RETURNED_EMPTY' | 'DEPOSIT_PAID' | 'DEPOSIT_REFUNDED';
  quantity_change: number;
  pundo_rate: number;
  balance_quantity: number;
  balance_value: number;
  reference_id?: string | null;
  created_at: string;
}
