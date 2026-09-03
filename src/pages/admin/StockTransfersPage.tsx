import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import type { Product, Truck } from '../../types/database.types';
import { EmptyState } from '../../components/EmptyState';
import {
  ArrowRightLeft,
  Plus,
  Warehouse as WarehouseIcon,
  Truck as TruckIcon,
  CheckCircle,
  AlertCircle,
  Clock,
  Check,
  X,
  Eye,
  ShieldCheck,
  Printer,
  DollarSign,
  FileText,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const StockTransfersPage: React.FC = () => {
  const { tenant } = useTenant();
  const { profile } = useAuth();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [warehouseLocationId, setWarehouseLocationId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'THIS_WEEK'>('ALL');

  // Selected Transfer Modal View & Cash Remittance State
  const [selectedTransfer, setSelectedTransfer] = useState<any | null>(null);
  const [actualCashInput, setActualCashInput] = useState<string>('');
  const [cashierNotesInput, setCashierNotesInput] = useState<string>('');
  const [showVoucherModal, setShowVoucherModal] = useState<boolean>(false);
  const [voucherTransfer, setVoucherTransfer] = useState<any | null>(null);

  // Transfer Creation Form State (Warehouse -> Truck Loading)
  const [selectedTruckId, setSelectedTruckId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [transferQty, setTransferQty] = useState<number>(10);

  const fetchTransfersData = async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      // 1. Fetch Main Warehouse Location
      const { data: whLoc } = await supabase
        .from('locations')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('type', 'WAREHOUSE')
        .limit(1)
        .maybeSingle();
      setWarehouseLocationId(whLoc?.id || null);

      // 2. Fetch Catalog (Products, Returnables & Trucks)
      const { data: prods } = await supabase.from('products').select('*').eq('tenant_id', tenant.id);
      setProducts(prods || []);

      const { data: rets } = await supabase.from('returnable_items').select('*').eq('tenant_id', tenant.id);

      const { data: trks } = await supabase.from('trucks').select('*').eq('tenant_id', tenant.id);
      setTrucks(trks || []);

      // 3. Fetch Stock Transfer History
      const { data: trfs, error: trfErr } = await supabase
        .from('stock_transfers')
        .select(`
          *,
          from_location:locations!from_location_id(id, name, type),
          to_location:locations!to_location_id(id, name, type)
        `)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (trfErr) throw trfErr;

      // 4. Fetch Transfer Items, Sales & Sale Items for Route Audit
      const { data: allTransferItems } = await supabase.from('stock_transfer_items').select('*');
      const { data: allSales } = await supabase.from('sales').select('*').eq('tenant_id', tenant.id);
      const { data: allSaleItems } = await supabase.from('sale_items').select('*');
      const { data: allReturnableBals } = await supabase
        .from('returnable_balances')
        .select('*, returnable_items(name, item_type, type)')
        .eq('tenant_id', tenant.id);

      const enriched = (trfs || []).map((t) => {
        const items = (allTransferItems || [])
          .filter((i) => i.stock_transfer_id === t.id)
          .map((i) => {
            const matchedProd = prods?.find((p) => p.id === i.product_id);
            const matchedRet = rets?.find((r) => r.id === i.returnable_item_id);
            return {
              ...i,
              products: matchedProd || null,
              returnable_items: matchedRet || null,
            };
          });

        // Determine truck location for route audit stats
        const truckLocId = t.from_location?.type === 'TRUCK' ? t.from_location_id : t.to_location_id;
        const matchedTruck = trks?.find((trk) => trk.location_id === truckLocId);

        const tDate = t.created_at ? t.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
        const truckSales = (allSales || []).filter(
          (s) => s.truck_id === matchedTruck?.id && s.created_at?.slice(0, 10) === tDate
        );

        let cashRemittanceMoney = 0;
        truckSales.forEach((s) => (cashRemittanceMoney += Number(s.total || 0)));

        const saleIds = new Set(truckSales.map((s) => s.id));

        // Calculate initial dispatched cases to truck today
        const outboundTrfsToday = (trfs || []).filter(
          (other) =>
            other.to_location_id === truckLocId &&
            other.transfer_type === 'WAREHOUSE_TO_TRUCK' &&
            other.created_at?.slice(0, 10) === tDate
        );

        let initialDispatchedCases = 0;
        outboundTrfsToday.forEach((outTrf) => {
          const outItems = (allTransferItems || []).filter((i) => i.stock_transfer_id === outTrf.id);
          outItems.forEach((i) => {
            if (i.item_type === 'PRODUCT' || i.product_id) {
              initialDispatchedCases += Number(i.quantity || 0);
            }
          });
        });

        // Actual items in this transfer line:
        let actualUnsoldCases = 0;
        let actualEmptyBottles = 0;
        let actualEmptyCases = 0;

        items.forEach((i) => {
          const isProd = i.item_type === 'PRODUCT' || (Boolean(i.product_id) && !i.returnable_item_id);
          const qty = Number(i.quantity || 0);
          if (isProd) {
            actualUnsoldCases += qty;
          } else {
            const itemType = i.returnable_items?.item_type || i.returnable_items?.type || '';
            const nameLower = (i.returnable_items?.name || '').toLowerCase();
            if (itemType === 'BOTTLE' || nameLower.includes('bottle')) {
              actualEmptyBottles += qty;
            } else {
              actualEmptyCases += qty;
            }
          }
        });

        // Calculate cases sold today with robust fallback:
        let casesSoldToday = 0;
        (allSaleItems || []).forEach((si) => {
          if (saleIds.has(si.sale_id)) {
            casesSoldToday += Number(si.quantity || 0);
          }
        });

        if (casesSoldToday === 0 && initialDispatchedCases > 0) {
          casesSoldToday = Math.max(0, initialDispatchedCases - actualUnsoldCases);
        }

        const expectedUnsoldCases = Math.max(0, initialDispatchedCases - casesSoldToday);

        // Returnable balances held on truck (expected empty returns)
        let expectedEmptyBottles = 0;
        let expectedEmptyCases = 0;
        (allReturnableBals || [])
          .filter((rb) => rb.location_id === truckLocId)
          .forEach((rb) => {
            const qty = Number(rb.quantity || 0);
            const itemType = rb.returnable_items?.item_type || rb.returnable_items?.type || '';
            const nameLower = (rb.returnable_items?.name || '').toLowerCase();
            if (itemType === 'BOTTLE' || nameLower.includes('bottle')) {
              expectedEmptyBottles += qty;
            } else {
              expectedEmptyCases += qty;
            }
          });

        return {
          ...t,
          stock_transfer_items: items,
          route_audit: {
            matchedTruck,
            initialDispatchedCases,
            casesSoldToday,
            cashRemittanceMoney,
            expectedUnsoldCases,
            actualUnsoldCases,
            expectedEmptyBottles,
            actualEmptyBottles,
            expectedEmptyCases,
            actualEmptyCases,
          },
        };
      });

      setTransfers(enriched);
    } catch (err) {
      console.error('Error fetching stock transfers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfersData();
  }, [tenant]);

  // Admin Outbound Transfer: Load Stock onto Truck (Warehouse -> Truck)
  const handleCreateAndConfirmTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !selectedTruckId || !selectedProductId || transferQty <= 0) return;
    setSaving(true);
    setError(null);

    try {
      const selectedTruck = trucks.find((t) => t.id === selectedTruckId);
      if (!selectedTruck || !selectedTruck.location_id) {
        throw new Error('Selected truck location is invalid.');
      }

      if (!warehouseLocationId) {
        throw new Error('Main warehouse location not found.');
      }

      const transferNum = `TRF-${Date.now().toString().slice(-6)}`;

      // 1. Create Transfer Record (COMPLETED for instant warehouse loading)
      const { data: newTrf, error: trfErr } = await supabase
        .from('stock_transfers')
        .insert([
          {
            tenant_id: tenant.id,
            transfer_number: transferNum,
            from_location_id: warehouseLocationId,
            to_location_id: selectedTruck.location_id,
            status: 'COMPLETED',
            transfer_type: 'WAREHOUSE_TO_TRUCK',
            notes: `Outbound truck dispatch stock allocation`,
          },
        ])
        .select()
        .maybeSingle();

      if (trfErr || !newTrf) throw (trfErr || new Error('Failed to create stock transfer'));

      // 2. Insert Transfer Item Line
      await supabase.from('stock_transfer_items').insert([
        {
          stock_transfer_id: newTrf.id,
          product_id: selectedProductId,
          item_type: 'PRODUCT',
          quantity: transferQty,
          unit: 'case',
        },
      ]);

      // 3. Deduct Stock from Main Warehouse (inventory_balances)
      const { data: whBal } = await supabase
        .from('inventory_balances')
        .select('id, quantity')
        .eq('tenant_id', tenant.id)
        .eq('location_id', warehouseLocationId)
        .eq('product_id', selectedProductId)
        .limit(1)
        .maybeSingle();

      if (whBal) {
        await supabase
          .from('inventory_balances')
          .update({ quantity: Math.max(0, Number(whBal.quantity || 0) - transferQty) })
          .eq('id', whBal.id);
      }

      // Deduct FIFO product_batches from Warehouse
      const { data: activeBatches } = await supabase
        .from('product_batches')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('product_id', selectedProductId)
        .gt('remaining_quantity', 0)
        .order('expiry_date', { ascending: true });

      if (activeBatches && activeBatches.length > 0) {
        let remainingToDeduct = transferQty;
        for (const b of activeBatches) {
          if (remainingToDeduct <= 0) break;
          const curQty = Number(b.remaining_quantity || 0);
          if (curQty <= remainingToDeduct) {
            remainingToDeduct -= curQty;
            await supabase
              .from('product_batches')
              .update({ remaining_quantity: 0, status: 'DEPLETED' })
              .eq('id', b.id);
          } else {
            const newQty = curQty - remainingToDeduct;
            remainingToDeduct = 0;
            await supabase
              .from('product_batches')
              .update({ remaining_quantity: newQty })
              .eq('id', b.id);
          }
        }
      }

      // 4. Add Stock to Truck Inventory
      const { data: trkBal } = await supabase
        .from('inventory_balances')
        .select('id, quantity')
        .eq('tenant_id', tenant.id)
        .eq('location_id', selectedTruck.location_id)
        .eq('product_id', selectedProductId)
        .limit(1)
        .maybeSingle();

      if (trkBal) {
        await supabase
          .from('inventory_balances')
          .update({ quantity: Number(trkBal.quantity || 0) + transferQty })
          .eq('id', trkBal.id);
      } else {
        await supabase.from('inventory_balances').insert([
          {
            tenant_id: tenant.id,
            location_id: selectedTruck.location_id,
            product_id: selectedProductId,
            quantity: transferQty,
          },
        ]);
      }

      setIsModalOpen(false);
      setSelectedTruckId('');
      setSelectedProductId('');
      setTransferQty(10);
      fetchTransfersData();
    } catch (err: any) {
      setError(err.message || 'Stock transfer failed.');
    } finally {
      setSaving(false);
    }
  };

  // Admin Approval of Inbound Truck Offload (Truck -> Warehouse)
  const handleApproveOffloadTransfer = async (transferRecord: any) => {
    if (!tenant) return;
    setProcessingId(transferRecord.id);

    try {
      const fromLocId = transferRecord.from_location_id; // Truck Location
      const toLocId = transferRecord.to_location_id || warehouseLocationId; // Main Warehouse Location

      const items = transferRecord.stock_transfer_items || [];

      for (const item of items) {
        const isProduct = item.item_type === 'PRODUCT' || item.product_id;
        const qty = Number(item.quantity || 0);

        if (qty > 0) {
          if (isProduct && item.product_id) {
            // Deduct Full Cases from Truck Stock
            if (fromLocId) {
              const { data: trkBal } = await supabase
                .from('inventory_balances')
                .select('id, quantity')
                .eq('tenant_id', tenant.id)
                .eq('location_id', fromLocId)
                .eq('product_id', item.product_id)
                .limit(1)
                .maybeSingle();

              if (trkBal) {
                await supabase
                  .from('inventory_balances')
                  .update({ quantity: Math.max(0, Number(trkBal.quantity || 0) - qty) })
                  .eq('id', trkBal.id);
              }
            }

            // Add Full Cases to Main Warehouse Stock
            if (toLocId) {
              const { data: whBal } = await supabase
                .from('inventory_balances')
                .select('id, quantity')
                .eq('tenant_id', tenant.id)
                .eq('location_id', toLocId)
                .eq('product_id', item.product_id)
                .limit(1)
                .maybeSingle();

              if (whBal) {
                await supabase
                  .from('inventory_balances')
                  .update({ quantity: Number(whBal.quantity || 0) + qty })
                  .eq('id', whBal.id);
              } else {
                await supabase.from('inventory_balances').insert([
                  {
                    tenant_id: tenant.id,
                    location_id: toLocId,
                    product_id: item.product_id,
                    quantity: qty,
                  },
                ]);
              }

              // Replenish Warehouse product_batches
              const { data: warehouseBatches } = await supabase
                .from('product_batches')
                .select('*')
                .eq('tenant_id', tenant.id)
                .eq('product_id', item.product_id)
                .order('expiry_date', { ascending: false });

              if (warehouseBatches && warehouseBatches.length > 0) {
                const targetBatch = warehouseBatches[0];
                const newBatchQty = Number(targetBatch.remaining_quantity || 0) + qty;
                await supabase
                  .from('product_batches')
                  .update({ remaining_quantity: newBatchQty, status: 'ACTIVE' })
                  .eq('id', targetBatch.id);
              }
            }
          } else if (item.returnable_item_id) {
            // Deduct Empties from Truck Balance
            if (fromLocId) {
              const { data: trkEmptyBal } = await supabase
                .from('returnable_balances')
                .select('id, quantity')
                .eq('tenant_id', tenant.id)
                .eq('location_id', fromLocId)
                .eq('returnable_item_id', item.returnable_item_id)
                .limit(1)
                .maybeSingle();

              if (trkEmptyBal) {
                await supabase
                  .from('returnable_balances')
                  .update({ quantity: Math.max(0, Number(trkEmptyBal.quantity || 0) - qty) })
                  .eq('id', trkEmptyBal.id);
              }
            }

            // Add Empties directly into Main Warehouse Empty Depot Balance
            if (toLocId) {
              const { data: whEmptyBal } = await supabase
                .from('returnable_balances')
                .select('id, quantity')
                .eq('tenant_id', tenant.id)
                .eq('location_id', toLocId)
                .eq('returnable_item_id', item.returnable_item_id)
                .limit(1)
                .maybeSingle();

              if (whEmptyBal) {
                await supabase
                  .from('returnable_balances')
                  .update({ quantity: Number(whEmptyBal.quantity || 0) + qty })
                  .eq('id', whEmptyBal.id);
              } else {
                await supabase.from('returnable_balances').insert([
                  {
                    tenant_id: tenant.id,
                    location_id: toLocId,
                    returnable_item_id: item.returnable_item_id,
                    quantity: qty,
                  },
                ]);
              }
            }
          }
        }
      }

      // If no container line items were in items array, fallback to offloading truck returnable_balances
      const hasContainerLineItems = items.some((i: any) => i.returnable_item_id);

      if (!hasContainerLineItems && fromLocId && toLocId) {
        const { data: trkEmpties } = await supabase
          .from('returnable_balances')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('location_id', fromLocId);

        if (trkEmpties && trkEmpties.length > 0) {
          for (const trkBal of trkEmpties) {
            const qty = Number(trkBal.quantity || 0);
            if (qty > 0) {
              // Deduct from truck returnable_balances
              await supabase
                .from('returnable_balances')
                .update({ quantity: 0 })
                .eq('id', trkBal.id);

              // Add to warehouse returnable_balances
              const { data: whEmptyBal } = await supabase
                .from('returnable_balances')
                .select('id, quantity')
                .eq('tenant_id', tenant.id)
                .eq('location_id', toLocId)
                .eq('returnable_item_id', trkBal.returnable_item_id)
                .limit(1)
                .maybeSingle();

              if (whEmptyBal) {
                await supabase
                  .from('returnable_balances')
                  .update({ quantity: Number(whEmptyBal.quantity || 0) + qty })
                  .eq('id', whEmptyBal.id);
              } else {
                await supabase.from('returnable_balances').insert([
                  {
                    tenant_id: tenant.id,
                    location_id: toLocId,
                    returnable_item_id: trkBal.returnable_item_id,
                    quantity: qty,
                  },
                ]);
              }

              // Also record item in stock_transfer_items for audit trail
              await supabase.from('stock_transfer_items').insert([
                {
                  stock_transfer_id: transferRecord.id,
                  returnable_item_id: trkBal.returnable_item_id,
                  item_type: 'CONTAINER',
                  quantity: qty,
                  unit: 'pc',
                },
              ]);
            }
          }
        }
      }

      // Calculate Cash Remittance Turnover & Variance
      const expectedCash = Number(transferRecord.route_audit?.cashRemittanceMoney || transferRecord.expected_cash_remittance || 0);
      const actualCashNum = actualCashInput ? parseFloat(actualCashInput) : expectedCash;
      const variance = actualCashNum - expectedCash;
      let remStatus = 'VERIFIED_MATCH';
      if (variance < -0.01) remStatus = 'SHORTAGE';
      if (variance > 0.01) remStatus = 'OVERAGE';

      // Update Transfer Status to COMPLETED with Cash Turnover Audit
      const updatedData = {
        status: 'COMPLETED',
        expected_cash_remittance: expectedCash,
        actual_cash_remitted: actualCashNum,
        remittance_variance: variance,
        remittance_received_by: profile?.id || null,
        remittance_status: remStatus,
        remittance_notes: cashierNotesInput || null,
      };

      await supabase
        .from('stock_transfers')
        .update(updatedData)
        .eq('id', transferRecord.id);

      const completedRecord = {
        ...transferRecord,
        ...updatedData,
      };

      setVoucherTransfer(completedRecord);
      setShowVoucherModal(true);
      fetchTransfersData();
    } catch (err: any) {
      console.error('Error approving offload transfer:', err);
      alert('Failed to approve stock transfer: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Admin Reject/Cancel Transfer Request
  const handleRejectTransfer = async (transferId: string) => {
    if (!tenant) return;
    try {
      await supabase
        .from('stock_transfers')
        .update({ status: 'CANCELLED' })
        .eq('id', transferId);

      fetchTransfersData();
    } catch (err) {
      console.error('Error cancelling transfer:', err);
    }
  };

  // Optional date filtering
  const filteredTransfers = transfers.filter((t) => {
    if (dateFilter === 'ALL') return true;
    const tDate = new Date(t.created_at);
    const today = new Date();
    if (dateFilter === 'TODAY') {
      return tDate.toDateString() === today.toDateString();
    }
    if (dateFilter === 'THIS_WEEK') {
      const diffDays = (today.getTime() - tDate.getTime()) / (1000 * 3600 * 24);
      return diffDays <= 7;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Stock Transfers & Fleet Movements</h1>
          <p className="text-slate-400 text-sm">Audit trail for outbound truck dispatch loading & end-of-day agent offload returns</p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Optional Date Filter Dropdown */}
          <div className="relative">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">Show All Dates History</option>
              <option value="TODAY">Today's Transactions</option>
              <option value="THIS_WEEK">This Week</option>
            </select>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center space-x-2 transition-all shadow-lg shadow-indigo-600/30 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Dispatch Stock to Truck</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-500 animate-pulse">Loading stock transfer history...</div>
      ) : filteredTransfers.length === 0 ? (
        <EmptyState
          title={dateFilter === 'ALL' ? "No Stock Transfers Created" : "No Transfers for Selected Date Filter"}
          description="No inventory stock transfers have been executed for this filter view. Click 'Dispatch Stock to Truck' or submit a route reconciliation to generate transfer audit logs."
          icon={<ArrowRightLeft className="w-10 h-10 text-indigo-400" />}
          actionText="Create Stock Transfer"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-semibold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-5 py-4">Transfer Ref</th>
                  <th className="px-5 py-4">From Location</th>
                  <th className="px-5 py-4">To Location</th>
                  <th className="px-5 py-4">Transfer Summary</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4 text-right">Actions / Approval</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredTransfers.map((t) => {
                  const items = t.stock_transfer_items || [];
                  const isPending = t.status === 'PENDING';
                  const isCompleted = t.status === 'COMPLETED' || t.status === 'CONFIRMED';
                  const isCancelled = t.status === 'CANCELLED';

                  return (
                    <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-indigo-400 text-xs">
                        {t.transfer_number}
                        {t.transfer_type === 'TRUCK_OFFLOAD_EOD' && (
                          <span className="block text-[9px] text-amber-400 uppercase font-mono mt-0.5">Route EOD Return</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-300">
                        <div className="flex items-center space-x-1.5">
                          {t.from_location?.type === 'TRUCK' ? (
                            <TruckIcon className="w-4 h-4 text-amber-400 shrink-0" />
                          ) : (
                            <WarehouseIcon className="w-4 h-4 text-slate-500 shrink-0" />
                          )}
                          <span>{t.from_location?.name || 'Main Warehouse'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-200 font-medium">
                        <div className="flex items-center space-x-1.5">
                          {t.to_location?.type === 'TRUCK' ? (
                            <TruckIcon className="w-4 h-4 text-cyan-400 shrink-0" />
                          ) : (
                            <WarehouseIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                          )}
                          <span>{t.to_location?.name || 'Main Warehouse'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-semibold text-white text-xs">
                        {items.length === 1 && items[0].products?.name ? (
                          <span>{items[0].products.name} ({items[0].quantity} cs)</span>
                        ) : (
                          <span className="font-mono text-indigo-300">{items.length} item lines logged</span>
                        )}

                        {t.route_audit && t.transfer_type === 'TRUCK_OFFLOAD_EOD' && (
                          <div className="text-[10px] font-mono mt-1 p-2 rounded-xl bg-slate-950 border border-slate-800 space-y-0.5">
                            <span className="block text-emerald-400 font-bold">
                              💵 Remit: ₱{t.route_audit.cashRemittanceMoney.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                            <span className="block text-slate-300">
                              📦 Unsold: {t.route_audit.actualUnsoldCases} cs (Dispatched: {t.route_audit.initialDispatchedCases})
                            </span>
                            <span className="block text-amber-300">
                              🍾 Empties: {t.route_audit.actualEmptyBottles} btl, {t.route_audit.actualEmptyCases} shells
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {isPending ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
                            <Clock className="w-3 h-3 mr-1" />
                            PENDING APPROVAL
                          </span>
                        ) : isCompleted ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            COMPLETED
                          </span>
                        ) : isCancelled ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            <X className="w-3 h-3 mr-1" />
                            CANCELLED
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">{t.status}</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500">
                        {new Date(t.created_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => setSelectedTransfer(t)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center space-x-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Details</span>
                          </button>

                          {isPending && (
                            <>
                              <button
                                disabled={processingId === t.id}
                                onClick={() => handleApproveOffloadTransfer(t)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1 shadow-lg shadow-emerald-600/30"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{processingId === t.id ? 'Saving...' : 'Approve & Receive'}</span>
                              </button>
                              <button
                                onClick={() => handleRejectTransfer(t.id)}
                                className="px-2 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Itemized Transfer Details Modal */}
      {selectedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl text-slate-100 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-lg text-white flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                  <span>Transfer Audit Details</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedTransfer.transfer_number}</p>
              </div>
              <button onClick={() => setSelectedTransfer(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-300">
                <span>From Origin:</span>
                <span className="font-bold text-white">{selectedTransfer.from_location?.name || 'Main Warehouse'}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>To Destination:</span>
                <span className="font-bold text-white">{selectedTransfer.to_location?.name || 'Agent Truck'}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Transfer Status:</span>
                <span className="font-mono font-bold text-indigo-400">{selectedTransfer.status}</span>
              </div>
            </div>

            {/* Checker Manual Audit & Cash Remittance Card (Displayed ONLY for Truck -> Warehouse EOD Returns) */}
            {selectedTransfer.route_audit && (selectedTransfer.transfer_type === 'TRUCK_OFFLOAD_EOD' || selectedTransfer.from_location?.type === 'TRUCK') && (
              <div className="bg-slate-950 p-4 rounded-2xl border border-indigo-500/30 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Checker Manual Audit & Remittance Turnover Verification
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-0.5">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">1. Outbound Dispatch Load</span>
                    <span className="text-white font-extrabold text-sm">
                      {selectedTransfer.route_audit.initialDispatchedCases} cases
                    </span>
                    <span className="text-[10px] text-slate-500 block">Loaded onto truck today</span>
                  </div>

                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-0.5">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">2. Deliveries Sold Today</span>
                    <span className="text-cyan-300 font-extrabold text-sm">
                      {selectedTransfer.route_audit.casesSoldToday} cases
                    </span>
                    <span className="text-[10px] text-slate-500 block">Store sales delivered</span>
                  </div>

                  {/* Cash Remittance Turnover Box */}
                  <div className="bg-slate-900 p-3 rounded-2xl border border-emerald-500/40 space-y-2 col-span-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-emerald-400 uppercase font-bold flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5" />
                        3. Cash Money Remittance Turnover
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Expected: ₱{selectedTransfer.route_audit.cashRemittanceMoney.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {selectedTransfer.status === 'PENDING' ? (
                      <div className="space-y-2 pt-1">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-400 font-sans mb-1 font-semibold">
                              Actual Cash Amount Handed Over (₱) *
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              placeholder={`₱${selectedTransfer.route_audit.cashRemittanceMoney}`}
                              value={actualCashInput}
                              onChange={(e) => setActualCashInput(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-400 font-sans mb-1 font-semibold">
                              Remittance Variance Status
                            </label>
                            {(() => {
                              const exp = Number(selectedTransfer.route_audit.cashRemittanceMoney || 0);
                              const act = actualCashInput ? parseFloat(actualCashInput) : exp;
                              const diff = act - exp;

                              if (Math.abs(diff) < 0.01) {
                                return (
                                  <div className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold flex items-center space-x-1">
                                    <Check className="w-3.5 h-3.5" />
                                    <span>EXACT MATCH (₱0.00)</span>
                                  </div>
                                );
                              } else if (diff < 0) {
                                return (
                                  <div className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 text-xs font-bold">
                                    SHORTAGE: ₱{diff.toFixed(2)}
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold">
                                    OVERAGE: +₱{diff.toFixed(2)}
                                  </div>
                                );
                              }
                            })()}
                          </div>
                        </div>

                        <div>
                          <input
                            type="text"
                            placeholder="Optional cashier / receiver verification note..."
                            value={cashierNotesInput}
                            onChange={(e) => setCashierNotesInput(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center text-xs pt-1 font-mono">
                        <div>
                          <span className="text-slate-400 block text-[10px]">VERIFIED CASH REMITTED:</span>
                          <span className="text-emerald-400 font-black text-base">
                            ₱{Number(selectedTransfer.actual_cash_remitted || selectedTransfer.expected_cash_remittance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 block text-[10px]">VARIANCE STATUS:</span>
                          <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                            selectedTransfer.remittance_status === 'SHORTAGE' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {selectedTransfer.remittance_status || 'VERIFIED MATCH'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 pt-1 text-xs">
                  <div className="flex justify-between items-center bg-slate-900 p-2 rounded-xl border border-slate-800 font-mono">
                    <span className="text-slate-300">📦 Unsold Cases Returned:</span>
                    <span className="font-bold text-white">
                      {selectedTransfer.route_audit.actualUnsoldCases} cs returned{' '}
                      <span className="text-slate-500 font-normal">
                        (Exp: {selectedTransfer.route_audit.expectedUnsoldCases} cs)
                      </span>
                    </span>
                  </div>

                  <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded-xl border border-slate-800 font-mono">
                    <span className="text-slate-300">🍾 Empty Bottles Returned:</span>
                    <span className="font-bold text-amber-300">
                      {selectedTransfer.route_audit.actualEmptyBottles} pcs returned{' '}
                      <span className="text-slate-500 font-normal">
                        (On Truck: {selectedTransfer.route_audit.expectedEmptyBottles} pcs)
                      </span>
                    </span>
                  </div>

                  <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded-xl border border-slate-800 font-mono">
                    <span className="text-slate-300">📦 Empty Shell Cases Returned:</span>
                    <span className="font-bold text-amber-400">
                      {selectedTransfer.route_audit.actualEmptyCases} pcs returned{' '}
                      <span className="text-slate-500 font-normal">
                        (On Truck: {selectedTransfer.route_audit.expectedEmptyCases} pcs)
                      </span>
                    </span>
                  </div>

                  {(selectedTransfer.route_audit.expectedEmptyBottles > selectedTransfer.route_audit.actualEmptyBottles ||
                    selectedTransfer.route_audit.expectedEmptyCases > selectedTransfer.route_audit.actualEmptyCases) && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-sans">
                      ⚠️ <strong>Checker Audit Notice:</strong> Truck currently holds {selectedTransfer.route_audit.expectedEmptyBottles} empty bottles & {selectedTransfer.route_audit.expectedEmptyCases} empty shell cases on board that were not offloaded in this return transfer.
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">Itemized Line Items</h4>
              <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="p-3">Item Description</th>
                      <th className="p-3 text-center">Type</th>
                      <th className="p-3 text-right">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(selectedTransfer.stock_transfer_items || []).map((i: any) => {
                      const isProd = i.item_type === 'PRODUCT' || (Boolean(i.product_id) && !i.returnable_item_id);
                      const name = isProd ? i.products?.name : i.returnable_items?.name;
                      const typeLabel = isProd ? 'PRODUCT CASE' : (i.returnable_items?.item_type || i.returnable_items?.type || 'CONTAINER');

                      return (
                        <tr key={i.id}>
                          <td className="p-3 font-semibold text-white">{name || (isProd ? 'Beverage Product' : 'Returnable Container')}</td>
                          <td className="p-3 text-center">
                            <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                              isProd ? 'bg-indigo-500/10 text-indigo-400' : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              {typeLabel}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-400">
                            {i.quantity} {i.unit || (isProd ? 'case' : 'pcs')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
              {selectedTransfer.status === 'PENDING' ? (
                <button
                  onClick={async () => {
                    await handleApproveOffloadTransfer(selectedTransfer);
                    setSelectedTransfer(null);
                  }}
                  disabled={processingId === selectedTransfer.id}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center space-x-2 shadow-lg shadow-emerald-600/30 border border-emerald-500/40"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{processingId === selectedTransfer.id ? 'Receiving Into Warehouse...' : 'Approve & Confirm Cash Turnover'}</span>
                </button>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Transfer & Remittance Completed
                  </span>
                  <button
                    onClick={() => {
                      setVoucherTransfer(selectedTransfer);
                      setShowVoucherModal(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-bold border border-indigo-500/30 flex items-center space-x-1"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>View Clearance Slip</span>
                  </button>
                </div>
              )}

              <button
                onClick={() => setSelectedTransfer(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outbound Dispatch Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h3 className="text-lg font-bold">Dispatch Stock to Agent Truck</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {error && (
              <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateAndConfirmTransfer} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Destination Truck *</label>
                <select
                  required
                  value={selectedTruckId}
                  onChange={(e) => setSelectedTruckId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select active truck...</option>
                  {trucks.map((trk) => (
                    <option key={trk.id} value={trk.id}>
                      {trk.truck_code} ({trk.plate_number})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Product *</label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select beverage product...</option>
                  {products.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name} ({prod.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-indigo-300 mb-1">Quantity (Cases) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={transferQty}
                  onChange={(e) => setTransferQty(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-950 border border-indigo-700/60 rounded-xl px-3.5 py-2 text-white font-bold text-base focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50"
                >
                  {saving ? 'Processing Transfer...' : 'Confirm Stock Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable EOD Cash Remittance & Settlement Clearance Voucher Modal */}
      {showVoucherModal && voucherTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl text-slate-100 space-y-4 font-mono">
            <div className="border-b-2 border-slate-700 pb-3 text-center">
              <h2 className="text-sm font-black text-white uppercase tracking-wider">
                OFFICIAL ROUTE EOD CASH REMITTANCE & STOCK SETTLEMENT CLEARANCE
              </h2>
              <p className="text-xs text-indigo-400 font-bold mt-1">Ref #: {voucherTransfer.transfer_number}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{new Date(voucherTransfer.created_at || Date.now()).toLocaleString()}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950 p-3 rounded-2xl border border-slate-800">
              <div>
                <span className="text-slate-400 text-[10px] block font-bold">ROUTE TRUCK / AGENT:</span>
                <span className="text-white font-bold">{voucherTransfer.from_location?.name || 'Truck Fleet'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block font-bold">WAREHOUSE DEPOT:</span>
                <span className="text-white font-bold">{voucherTransfer.to_location?.name || 'Main Warehouse'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block font-bold">CASHIER / RECEIVER:</span>
                <span className="text-emerald-400 font-bold">{profile?.full_name || 'Warehouse Checker'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block font-bold">SETTLEMENT STATUS:</span>
                <span className="text-emerald-400 font-extrabold uppercase">{voucherTransfer.remittance_status || 'VERIFIED_MATCH'}</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs bg-slate-950 p-3 rounded-2xl border border-slate-800">
              <div className="text-[11px] font-bold text-indigo-300 border-b border-slate-800 pb-1 uppercase">1. Route Inventory Turnover Summary</div>
              <div className="flex justify-between">
                <span>Outbound Truck Load:</span>
                <span className="font-bold text-white">{voucherTransfer.route_audit?.initialDispatchedCases || 0} cases</span>
              </div>
              <div className="flex justify-between">
                <span>Store Sales Delivered:</span>
                <span className="font-bold text-cyan-300">{voucherTransfer.route_audit?.casesSoldToday || 0} cases</span>
              </div>
              <div className="flex justify-between">
                <span>Unsold Cases Returned:</span>
                <span className="font-bold text-white">{voucherTransfer.route_audit?.actualUnsoldCases || 0} cases</span>
              </div>
              <div className="flex justify-between text-amber-300">
                <span>Empty Bottles Returned:</span>
                <span className="font-bold">{voucherTransfer.route_audit?.actualEmptyBottles || 0} pcs</span>
              </div>
              <div className="flex justify-between text-amber-400">
                <span>Empty Shell Cases Returned:</span>
                <span className="font-bold">{voucherTransfer.route_audit?.actualEmptyCases || 0} cases</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs bg-slate-950 p-3.5 rounded-2xl border border-emerald-500/40">
              <div className="text-[11px] font-bold text-emerald-400 border-b border-slate-800 pb-1 uppercase">2. Cash Money Remittance Turnover</div>
              <div className="flex justify-between">
                <span>Expected Sales Cash:</span>
                <span>₱{Number(voucherTransfer.expected_cash_remittance || voucherTransfer.route_audit?.cashRemittanceMoney || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-white font-bold">
                <span>Actual Cash Remitted / Handed Over:</span>
                <span className="text-emerald-400 text-sm">₱{Number(voucherTransfer.actual_cash_remitted || voucherTransfer.route_audit?.cashRemittanceMoney || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-amber-300">
                <span>Remittance Variance:</span>
                <span className="font-bold">
                  {Number(voucherTransfer.remittance_variance || 0) === 0 ? '₱0.00 (EXACT MATCH)' : `₱${Number(voucherTransfer.remittance_variance).toFixed(2)}`}
                </span>
              </div>
            </div>

            {/* Signature Lines */}
            <div className="pt-6 grid grid-cols-2 gap-6 text-center text-xs font-sans">
              <div className="border-t border-slate-700 pt-1">
                <span className="block font-bold text-white">{profile?.full_name || 'Warehouse Checker'}</span>
                <span className="text-[10px] text-slate-400 uppercase font-mono">Receiver / Cashier Signature</span>
              </div>
              <div className="border-t border-slate-700 pt-1">
                <span className="block font-bold text-white">Route Agent</span>
                <span className="text-[10px] text-slate-400 uppercase font-mono">Agent Turnover Signature</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-800 font-sans">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1.5 border border-slate-700"
              >
                <Printer className="w-4 h-4 text-indigo-400" />
                <span>Print Clearance Slip</span>
              </button>

              <button
                onClick={() => setShowVoucherModal(false)}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30"
              >
                Close Clearance Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
