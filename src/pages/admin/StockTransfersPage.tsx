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
  FileText,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useModal } from '../../context/ModalContext';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';

export const StockTransfersPage: React.FC = () => {
  const { tenant } = useTenant();
  const { profile } = useAuth();
  const { showError, confirm } = useModal();
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
  const [showVoucherModal, setShowVoucherModal] = useState<boolean>(false);
  const [voucherTransfer, setVoucherTransfer] = useState<any | null>(null);

  // Transfer Creation Form State (Warehouse -> Truck Loading)
  const [selectedTruckId, setSelectedTruckId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [transferQty, setTransferQty] = useState<number>(10);

  const fetchTransfersData = async () => {
    if (!tenant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [whRes, prodsRes, retsRes, trksRes, trfsRes, salesRes, retBalsRes] = await Promise.all([
        supabase
          .from('locations')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('type', 'WAREHOUSE')
          .limit(1)
          .maybeSingle(),
        supabase.from('products').select('*').eq('tenant_id', tenant.id),
        supabase.from('returnable_items').select('*').eq('tenant_id', tenant.id),
        supabase.from('trucks').select('*').eq('tenant_id', tenant.id),
        supabase
          .from('stock_transfers')
          .select(`
            *,
            from_location:locations!from_location_id(id, name, type),
            to_location:locations!to_location_id(id, name, type)
          `)
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('sales')
          .select('id, truck_id, total, created_at, sale_items(quantity)')
          .eq('tenant_id', tenant.id),
        supabase
          .from('returnable_balances')
          .select('*, returnable_items(name, item_type, type)')
          .eq('tenant_id', tenant.id),
      ]);

      const prods = prodsRes.data || [];
      const rets = retsRes.data || [];
      const trks = trksRes.data || [];
      const trfs = trfsRes.data || [];
      const allSales = salesRes.data || [];
      const allReturnableBals = retBalsRes.data || [];

      setWarehouseLocationId(whRes.data?.id || null);
      setProducts(prods);
      setTrucks(trks);

      const trfIds = trfs.map((t) => t.id);
      let allItems: any[] = [];
      if (trfIds.length > 0) {
        const { data: primaryItems, error: itemsErr } = await supabase
          .from('stock_transfer_items')
          .select('*')
          .in('stock_transfer_id', trfIds);

        if (!itemsErr && primaryItems) {
          allItems = primaryItems;
        } else {
          const { data: fallbackItems } = await supabase
            .from('stock_transfer_items')
            .select('*');
          allItems = fallbackItems || [];
        }
      }

      const enriched = trfs.map((t) => {
        const rawItems = allItems.filter(
          (i: any) => i.stock_transfer_id === t.id || i.transfer_id === t.id
        );

        const transferItems = rawItems.map((i: any) => {
          const matchedProd = prods.find((p) => p.id === i.product_id);
          const matchedRet = rets.find((r) => r.id === i.returnable_item_id);

          return {
            ...i,
            products: matchedProd || (i.product_id ? { name: 'Beverage Product', sku: '' } : null),
            returnable_items: matchedRet || (i.returnable_item_id ? { name: 'Returnable Container' } : null),
          };
        });

        let routeAudit = null;
        if (t.from_location?.type === 'TRUCK' || t.transfer_type === 'TRUCK_OFFLOAD_EOD') {
          const truckId = trks.find((trk) => trk.location_id === t.from_location_id)?.id;
          const truckSales = allSales.filter((s) => s.truck_id === truckId);

          let totalSalesMoney = 0;
          let totalSoldCases = 0;
          truckSales.forEach((s) => {
            totalSalesMoney += Number(s.total || 0);
            s.sale_items?.forEach((si: any) => {
              totalSoldCases += Number(si.quantity || 0);
            });
          });

          const outboundTransfersToTruck = trfs.filter(
            (otherT) => otherT.to_location_id === t.from_location_id && otherT.status === 'COMPLETED'
          );

          let initialDispatchedCases = 0;
          outboundTransfersToTruck.forEach((outTrf) => {
            const outItems = allItems.filter(
              (i: any) => i.stock_transfer_id === outTrf.id || i.transfer_id === outTrf.id
            );
            outItems.forEach((oi: any) => {
              if (oi.product_id || oi.item_type === 'PRODUCT') {
                initialDispatchedCases += Number(oi.quantity || 0);
              }
            });
          });

          let actualUnsoldCases = 0;
          let actualEmptyBottles = 0;
          let actualEmptyCases = 0;

          transferItems.forEach((item: any) => {
            const qty = Number(item.quantity || 0);
            const isProd = item.item_type === 'PRODUCT' || item.product_id;
            if (isProd) {
              actualUnsoldCases += qty;
            } else if (item.returnable_items?.item_type === 'BOTTLE' || item.returnable_items?.type === 'BOTTLE') {
              actualEmptyBottles += qty;
            } else if (item.returnable_items?.item_type === 'CASE' || item.returnable_items?.type === 'CASE') {
              actualEmptyCases += qty;
            } else {
              actualEmptyBottles += qty;
            }
          });

          const expectedUnsold = Math.max(0, initialDispatchedCases - totalSoldCases);

          let truckEmptyBottlesOnBoard = 0;
          let truckEmptyCasesOnBoard = 0;
          allReturnableBals
            .filter((rb) => rb.location_id === t.from_location_id)
            .forEach((rb) => {
              const itemType = rb.returnable_items?.item_type || rb.returnable_items?.type || 'BOTTLE';
              if (itemType === 'BOTTLE') truckEmptyBottlesOnBoard += Number(rb.quantity || 0);
              if (itemType === 'CASE') truckEmptyCasesOnBoard += Number(rb.quantity || 0);
            });

          routeAudit = {
            initialDispatchedCases,
            casesSoldToday: totalSoldCases,
            expectedUnsoldCases: expectedUnsold,
            actualUnsoldCases,
            casesVariance: actualUnsoldCases - expectedUnsold,
            cashRemittanceMoney: totalSalesMoney,
            actualEmptyBottles,
            actualEmptyCases,
            expectedEmptyBottles: truckEmptyBottlesOnBoard,
            expectedEmptyCases: truckEmptyCasesOnBoard,
          };
        }

        return {
          ...t,
          stock_transfer_items: transferItems,
          route_audit: routeAudit,
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

  const handleCreateAndConfirmTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !selectedTruckId || !selectedProductId || transferQty <= 0) return;

    setSaving(true);
    setError(null);

    try {
      let whLocId = warehouseLocationId;
      if (!whLocId) {
        let { data: whLoc } = await supabase
          .from('locations')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('type', 'WAREHOUSE')
          .limit(1)
          .maybeSingle();

        if (!whLoc) {
          const { data: newWhLoc } = await supabase
            .from('locations')
            .insert([
              {
                tenant_id: tenant.id,
                name: `${tenant.name} Main Depot`,
                type: 'WAREHOUSE',
                is_active: true,
              },
            ])
            .select()
            .single();
          whLocId = newWhLoc?.id || null;
        } else {
          whLocId = whLoc.id;
        }
      }

      const selectedTruck = trucks.find((t) => t.id === selectedTruckId);
      if (!selectedTruck || !selectedTruck.location_id) {
        throw new Error('Selected truck is not properly linked to a location inventory.');
      }

      const { data: whBal } = await supabase
        .from('inventory_balances')
        .select('id, quantity')
        .eq('tenant_id', tenant.id)
        .eq('location_id', whLocId)
        .eq('product_id', selectedProductId)
        .limit(1)
        .maybeSingle();

      const currentWhQty = Number(whBal?.quantity || 0);
      if (currentWhQty < transferQty) {
        throw new Error(`Insufficient warehouse stock. Depot only has ${currentWhQty} cases available.`);
      }

      const transferNumber = `TRF-${Date.now().toString().slice(-6)}`;
      const { data: newTrf, error: trfErr } = await supabase
        .from('stock_transfers')
        .insert([
          {
            tenant_id: tenant.id,
            transfer_number: transferNumber,
            from_location_id: whLocId,
            to_location_id: selectedTruck.location_id,
            status: 'COMPLETED',
            created_by: profile?.id || null,
          },
        ])
        .select()
        .single();

      if (trfErr) throw trfErr;

      await supabase.from('stock_transfer_items').insert([
        {
          stock_transfer_id: newTrf.id,
          product_id: selectedProductId,
          item_type: 'PRODUCT',
          quantity: transferQty,
          unit: 'case',
        },
      ]);

      if (whBal) {
        await supabase
          .from('inventory_balances')
          .update({ quantity: currentWhQty - transferQty })
          .eq('id', whBal.id);
      }

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

  const handleApproveOffloadTransfer = async (transferRecord: any) => {
    if (!tenant) return;
    setProcessingId(transferRecord.id);

    try {
      const fromLocId = transferRecord.from_location_id;
      const toLocId = transferRecord.to_location_id || warehouseLocationId;
      const items = transferRecord.stock_transfer_items || [];

      for (const item of items) {
        const isProduct = item.item_type === 'PRODUCT' || (item.product_id && !item.returnable_item_id);
        const isContainer = item.item_type === 'CONTAINER' || !!item.returnable_item_id;
        const qty = Number(item.quantity || 0);

        if (qty > 0) {
          if (isProduct && item.product_id) {
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
          } else if (isContainer && item.returnable_item_id) {
            // Deduct returnable container from truck location
            if (fromLocId) {
              const { data: trkRetBal } = await supabase
                .from('returnable_balances')
                .select('id, quantity')
                .eq('tenant_id', tenant.id)
                .eq('location_id', fromLocId)
                .eq('returnable_item_id', item.returnable_item_id)
                .limit(1)
                .maybeSingle();

              if (trkRetBal) {
                await supabase
                  .from('returnable_balances')
                  .update({ quantity: Math.max(0, Number(trkRetBal.quantity || 0) - qty) })
                  .eq('id', trkRetBal.id);
              }
            }

            // Credit returnable container to warehouse location
            if (toLocId) {
              const { data: whRetBal } = await supabase
                .from('returnable_balances')
                .select('id, quantity')
                .eq('tenant_id', tenant.id)
                .eq('location_id', toLocId)
                .eq('returnable_item_id', item.returnable_item_id)
                .limit(1)
                .maybeSingle();

              if (whRetBal) {
                await supabase
                  .from('returnable_balances')
                  .update({ quantity: Number(whRetBal.quantity || 0) + qty })
                  .eq('id', whRetBal.id);
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

      // If EOD transfer, ensure truck inventory and returnable balances for offloaded items are zeroed
      if (transferRecord.transfer_type === 'TRUCK_OFFLOAD_EOD' && fromLocId) {
        for (const item of items) {
          if (item.returnable_item_id) {
            await supabase
              .from('returnable_balances')
              .update({ quantity: 0 })
              .eq('tenant_id', tenant.id)
              .eq('location_id', fromLocId)
              .eq('returnable_item_id', item.returnable_item_id);
          }
        }
      }

      const expectedCash = Number(transferRecord.route_audit?.cashRemittanceMoney || transferRecord.expected_cash_remittance || 0);
      const actualCashNum = expectedCash;
      const variance = 0;
      const remStatus = 'VERIFIED_MATCH';

      const updatedData = {
        status: 'COMPLETED',
        expected_cash_remittance: expectedCash,
        actual_cash_remitted: actualCashNum,
        remittance_variance: variance,
        remittance_received_by: profile?.id || null,
        remittance_status: remStatus,
        remittance_notes: null,
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
      showError({
        title: 'Approval Failed',
        description: 'Failed to approve stock transfer: ' + (err.message || err),
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectTransfer = async (transferId: string) => {
    if (!tenant) return;
    const ok = await confirm({
      title: 'Cancel Stock Transfer',
      description: 'Are you sure you want to cancel / reject this transfer request?',
      confirmText: 'Cancel Transfer',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await supabase
        .from('stock_transfers')
        .update({ status: 'CANCELLED' })
        .eq('id', transferId);

      fetchTransfersData();
    } catch (err: any) {
      console.error('Error cancelling transfer:', err);
      showError({
        title: 'Cancellation Failed',
        description: err.message || 'Failed to cancel stock transfer.',
      });
    }
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900">Stock Transfers & Fleet Movements</h1>
          <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">Audit trail for outbound truck dispatch & end-of-day agent returns</p>
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-950 cursor-pointer"
          >
            <option value="ALL">All Dates</option>
            <option value="TODAY">Today's Transactions</option>
            <option value="THIS_WEEK">This Week</option>
          </select>

          <Button
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Dispatch to Truck</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-zinc-400 animate-pulse text-xs">Loading stock transfer history...</div>
      ) : filteredTransfers.length === 0 ? (
        <EmptyState
          title={dateFilter === 'ALL' ? "No Stock Transfers Found" : "No Transfers for Selected Filter"}
          description="No stock transfers have been executed. Click 'Dispatch to Truck' to create an outbound load."
          icon={<ArrowRightLeft className="w-8 h-8 text-zinc-400" />}
          actionText="Create Stock Transfer"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-zinc-700">
              <thead className="bg-zinc-50 text-zinc-500 uppercase text-[11px] font-medium tracking-wider border-b border-zinc-200">
                <tr>
                  <th className="px-4 py-3">Transfer Ref</th>
                  <th className="px-4 py-3">From Location</th>
                  <th className="px-4 py-3">To Location</th>
                  <th className="px-4 py-3">Transfer Summary</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {filteredTransfers.map((t) => {
                  const items = t.stock_transfer_items || [];
                  const isPending = t.status === 'PENDING';
                  const isCompleted = t.status === 'COMPLETED' || t.status === 'CONFIRMED';
                  const isCancelled = t.status === 'CANCELLED';

                  return (
                    <tr key={t.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-zinc-900 text-xs">
                        {t.transfer_number}
                        {t.transfer_type === 'TRUCK_OFFLOAD_EOD' && (
                          <Badge variant="secondary" className="block w-max text-[9px] mt-1">Route EOD</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        <div className="flex items-center space-x-1.5">
                          {t.from_location?.type === 'TRUCK' ? (
                            <TruckIcon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          ) : (
                            <WarehouseIcon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          )}
                          <span>{t.from_location?.name || 'Main Warehouse'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-900 font-medium">
                        <div className="flex items-center space-x-1.5">
                          {t.to_location?.type === 'TRUCK' ? (
                            <TruckIcon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          ) : (
                            <WarehouseIcon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          )}
                          <span>{t.to_location?.name || 'Main Warehouse'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900 text-xs">
                        {items.length === 1 && items[0].products?.name ? (
                          <span>{items[0].products.name} ({items[0].quantity} cs)</span>
                        ) : (
                          <span className="font-mono text-zinc-600">{items.length} item lines</span>
                        )}

                        {t.route_audit && t.transfer_type === 'TRUCK_OFFLOAD_EOD' && (
                          <div className="text-[10px] font-mono mt-1 p-2 rounded-md bg-zinc-50 border border-zinc-200 space-y-0.5">
                            <span className="block text-zinc-900 font-semibold">
                              Remit: ₱{t.route_audit.cashRemittanceMoney.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                            <span className="block text-zinc-600">
                              Unsold: {t.route_audit.actualUnsoldCases} cs (Dispatched: {t.route_audit.initialDispatchedCases})
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isPending ? (
                          <Badge variant="warning" className="text-[10px]">
                            <Clock className="w-3 h-3 mr-1" />
                            PENDING
                          </Badge>
                        ) : isCompleted ? (
                          <Badge variant="default" className="text-[10px]">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            COMPLETED
                          </Badge>
                        ) : isCancelled ? (
                          <Badge variant="destructive" className="text-[10px]">
                            <X className="w-3 h-3 mr-1" />
                            CANCELLED
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">{t.status}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedTransfer(t)}
                            className="h-7 text-xs"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            <span>Details</span>
                          </Button>

                          {isPending && (
                            <>
                              <Button
                                size="sm"
                                disabled={processingId === t.id}
                                onClick={() => handleApproveOffloadTransfer(t)}
                                className="h-7 text-xs"
                              >
                                <Check className="w-3 h-3 mr-1" />
                                <span>Approve</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRejectTransfer(t.id)}
                                className="h-7 text-xs text-red-600 hover:text-red-700"
                              >
                                Reject
                              </Button>
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
        </Card>
      )}

      {/* Transfer Details Modal */}
      {selectedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-zinc-200 rounded-lg max-w-lg w-full p-6 shadow-xl text-zinc-900 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div>
                <h3 className="font-semibold text-base text-zinc-900 flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-zinc-700" />
                  <span>Transfer Audit Details</span>
                </h3>
                <p className="text-xs text-zinc-500 font-mono mt-0.5">{selectedTransfer.transfer_number}</p>
              </div>
              <button onClick={() => setSelectedTransfer(null)} className="text-zinc-400 hover:text-zinc-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-zinc-50 p-3 rounded-md border border-zinc-200 text-xs space-y-1">
              <div className="flex justify-between text-zinc-600">
                <span>From Origin:</span>
                <span className="font-semibold text-zinc-900">{selectedTransfer.from_location?.name || 'Main Warehouse'}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>To Destination:</span>
                <span className="font-semibold text-zinc-900">{selectedTransfer.to_location?.name || 'Agent Truck'}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>Status:</span>
                <span className="font-mono font-semibold text-zinc-900">{selectedTransfer.status}</span>
              </div>
            </div>

            {/* Line items table */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Itemized Line Items</h4>
              <div className="bg-white border border-zinc-200 rounded-md overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-zinc-50 text-zinc-500 uppercase text-[10px] border-b border-zinc-200">
                    <tr>
                      <th className="p-2.5">Item</th>
                      <th className="p-2.5 text-center">Type</th>
                      <th className="p-2.5 text-right">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(selectedTransfer.stock_transfer_items || []).length > 0 ? (
                      selectedTransfer.stock_transfer_items.map((i: any) => {
                        const isProd = i.item_type === 'PRODUCT' || (Boolean(i.product_id) && !i.returnable_item_id);
                        const name = isProd ? (i.products?.name || 'Beverage Product') : (i.returnable_items?.name || 'Returnable Container');
                        const typeLabel = isProd ? 'PRODUCT' : 'CONTAINER';

                        return (
                          <tr key={i.id || Math.random()}>
                            <td className="p-2.5 font-medium text-zinc-900">
                              <span>{name}</span>
                              {i.products?.sku && (
                                <span className="block text-[10px] font-mono text-zinc-500 font-normal">
                                  {i.products.sku}
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-center">
                              <Badge variant="outline" className="text-[9px]">
                                {typeLabel}
                              </Badge>
                            </td>
                            <td className="p-2.5 text-right font-mono font-semibold text-zinc-900">
                              {i.quantity} {i.unit || (isProd ? 'case' : 'pcs')}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-xs text-zinc-400">
                          No itemized lines recorded for this transfer.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Route EOD Audit Breakdown */}
            {selectedTransfer.route_audit && (
              <div className="space-y-1.5 pt-2 border-t border-zinc-200">
                <h4 className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Route Reconciliation & Remittance Audit</h4>
                <div className="grid grid-cols-2 gap-2 bg-zinc-50 p-3 rounded-md border border-zinc-200 text-xs font-mono">
                  <div>
                    <span className="text-zinc-500 text-[10px] block font-sans">DISPATCHED MORNING LOAD:</span>
                    <span className="font-semibold text-zinc-900">{selectedTransfer.route_audit.initialDispatchedCases} cs</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-[10px] block font-sans">SOLD & DELIVERED ON ROUTE:</span>
                    <span className="font-semibold text-zinc-900">{selectedTransfer.route_audit.casesSoldToday} cs</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-[10px] block font-sans">EXPECTED UNSOLD RETURN:</span>
                    <span className="font-semibold text-zinc-900">{selectedTransfer.route_audit.expectedUnsoldCases} cs</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-[10px] block font-sans">ACTUAL UNSOLD RETURNED:</span>
                    <span className="font-semibold text-zinc-900">{selectedTransfer.route_audit.actualUnsoldCases} cs</span>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-zinc-200 flex justify-between items-center font-sans">
                    <span className="text-xs font-semibold text-zinc-700">Cash Remittance:</span>
                    <span className="text-sm font-bold font-mono text-zinc-900">
                      ₱{selectedTransfer.route_audit.cashRemittanceMoney.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {selectedTransfer.notes && (
              <div className="p-2.5 bg-zinc-50 rounded-md border border-zinc-200 text-xs text-zinc-600">
                <span className="font-semibold text-zinc-800 block text-[10px] uppercase">Notes:</span>
                <p className="mt-0.5">{selectedTransfer.notes}</p>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-zinc-200">
              {selectedTransfer.status === 'PENDING' ? (
                <Button
                  onClick={async () => {
                    await handleApproveOffloadTransfer(selectedTransfer);
                    setSelectedTransfer(null);
                  }}
                  disabled={processingId === selectedTransfer.id}
                  size="sm"
                >
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  <span>{processingId === selectedTransfer.id ? 'Receiving...' : 'Approve & Confirm'}</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setVoucherTransfer(selectedTransfer);
                    setShowVoucherModal(true);
                  }}
                >
                  <FileText className="w-3.5 h-3.5 mr-1" />
                  <span>Clearance Slip</span>
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTransfer(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Outbound Dispatch Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-zinc-200 rounded-lg max-w-md w-full p-6 shadow-xl text-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3 mb-4">
              <h3 className="text-base font-semibold">Dispatch Stock to Agent Truck</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-2.5 mb-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateAndConfirmTransfer} className="space-y-3.5 text-sm">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">Destination Truck *</label>
                <select
                  required
                  value={selectedTruckId}
                  onChange={(e) => setSelectedTruckId(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-md px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 cursor-pointer"
                >
                  <option value="">Select active truck...</option>
                  {trucks.map((trk) => (
                    <option key={trk.id} value={trk.id}>
                      {trk.truck_code} ({trk.plate_number})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">Select Product *</label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-md px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 cursor-pointer"
                >
                  <option value="">Select beverage product...</option>
                  {products.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name} ({prod.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">Quantity (Cases) *</label>
                <Input
                  type="number"
                  min="1"
                  required
                  value={transferQty}
                  onChange={(e) => setTransferQty(parseInt(e.target.value) || 1)}
                  className="font-mono text-xs font-semibold"
                />
              </div>

              <div className="pt-3 border-t border-zinc-200 flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={saving}
                >
                  {saving ? 'Processing...' : 'Confirm Dispatch'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Voucher Modal */}
      {showVoucherModal && voucherTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-zinc-200 rounded-lg max-w-lg w-full p-6 shadow-xl text-zinc-900 space-y-4 font-mono text-xs">
            <div className="border-b border-zinc-200 pb-3 text-center font-sans">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900">
                Route Settlement & Clearance Slip
              </h2>
              <p className="text-xs text-zinc-500 font-mono mt-0.5">Ref: {voucherTransfer.transfer_number}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-zinc-50 p-3 rounded-md border border-zinc-200">
              <div>
                <span className="text-zinc-500 text-[10px] block">TRUCK / AGENT:</span>
                <span className="text-zinc-900 font-semibold">{voucherTransfer.from_location?.name || 'Truck Fleet'}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] block">DEPOT:</span>
                <span className="text-zinc-900 font-semibold">{voucherTransfer.to_location?.name || 'Main Warehouse'}</span>
              </div>
            </div>

            <div className="space-y-1 bg-zinc-50 p-3 rounded-md border border-zinc-200">
              <div className="flex justify-between">
                <span>Dispatched Load:</span>
                <span className="font-semibold text-zinc-900">{voucherTransfer.route_audit?.initialDispatchedCases || 0} cs</span>
              </div>
              <div className="flex justify-between">
                <span>Sales Delivered:</span>
                <span className="font-semibold text-zinc-900">{voucherTransfer.route_audit?.casesSoldToday || 0} cs</span>
              </div>
              <div className="flex justify-between">
                <span>Unsold Returned:</span>
                <span className="font-semibold text-zinc-900">{voucherTransfer.route_audit?.actualUnsoldCases || 0} cs</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-zinc-200 font-bold">
                <span>Remitted Cash:</span>
                <span className="text-zinc-900">₱{Number(voucherTransfer.actual_cash_remitted || voucherTransfer.route_audit?.cashRemittanceMoney || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-zinc-200 font-sans">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="flex items-center space-x-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Slip</span>
              </Button>

              <Button
                size="sm"
                onClick={() => setShowVoucherModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
