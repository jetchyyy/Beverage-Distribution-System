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
  DollarSign,
  PackageCheck,
  RotateCcw,
  Search,
  Receipt,
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

  // Filters & Search
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'THIS_WEEK'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'EOD' | 'DISPATCH'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Transfer Modal View & Verification State
  const [selectedTransfer, setSelectedTransfer] = useState<any | null>(null);
  const [modalAuditTab, setModalAuditTab] = useState<'OVERVIEW' | 'SKUS' | 'EMPTIES' | 'CASH'>('OVERVIEW');
  const [modalCashReceived, setModalCashReceived] = useState<number>(0);
  const [modalRemittanceNotes, setModalRemittanceNotes] = useState<string>('');
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
      const [whRes, prodsRes, retsRes, trksRes, agtsRes, trfsRes, salesRes, retBalsRes] = await Promise.all([
        supabase
          .from('locations')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('type', 'WAREHOUSE')
          .limit(1)
          .maybeSingle(),
        supabase.from('products').select('*, product_packaging(*)').eq('tenant_id', tenant.id),
        supabase.from('returnable_items').select('*').eq('tenant_id', tenant.id),
        supabase.from('trucks').select('*').eq('tenant_id', tenant.id),
        supabase.from('agents').select('*').eq('tenant_id', tenant.id),
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
          .select('id, truck_id, agent_id, total, subtotal, bottle_pundo_amount, case_pundo_amount, created_at, sale_items(product_id, quantity, unit_price, subtotal)')
          .eq('tenant_id', tenant.id),
        supabase
          .from('returnable_balances')
          .select('*, returnable_items(id, name, item_type, type, unit, deposit_rate, pundo_value)')
          .eq('tenant_id', tenant.id),
      ]);

      const prods = prodsRes.data || [];
      const rets = retsRes.data || [];
      const trks = trksRes.data || [];
      const agts = agtsRes.data || [];
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
          const matchedTruck = trks.find((trk) => trk.location_id === t.from_location_id);
          const matchedAgent = agts.find((ag) => ag.assigned_truck_id === matchedTruck?.id) ||
            agts.find((ag) => ag.id === t.created_by);

          // Get truck sales
          const truckSales = allSales.filter(
            (s) => s.truck_id === matchedTruck?.id || (matchedAgent?.id && s.agent_id === matchedAgent.id)
          );

          // Pillar 1: Cash Remittance Calculations
          let totalSalesMoney = 0;
          let productSubtotal = 0;
          let bottlePundoTotal = 0;
          let casePundoTotal = 0;
          const soldBySkuMap: Record<string, number> = {};

          truckSales.forEach((s) => {
            totalSalesMoney += Number(s.total || 0);
            productSubtotal += Number(s.subtotal || 0);
            bottlePundoTotal += Number(s.bottle_pundo_amount || 0);
            casePundoTotal += Number(s.case_pundo_amount || 0);

            s.sale_items?.forEach((si: any) => {
              if (si.product_id) {
                soldBySkuMap[si.product_id] = (soldBySkuMap[si.product_id] || 0) + Number(si.quantity || 0);
              }
            });
          });

          // Pillar 2: Dispatched Outbound Product Load (Warehouse -> Truck)
          const outboundTransfersToTruck = trfs.filter(
            (otherT) => otherT.to_location_id === t.from_location_id && (otherT.status === 'COMPLETED' || otherT.status === 'CONFIRMED')
          );

          let initialDispatchedCases = 0;
          const dispatchedBySkuMap: Record<string, number> = {};

          outboundTransfersToTruck.forEach((outTrf) => {
            const outItems = allItems.filter(
              (i: any) => i.stock_transfer_id === outTrf.id || i.transfer_id === outTrf.id
            );
            outItems.forEach((oi: any) => {
              const isProd = oi.product_id || oi.item_type === 'PRODUCT';
              if (isProd && oi.product_id) {
                const q = Number(oi.quantity || 0);
                initialDispatchedCases += q;
                dispatchedBySkuMap[oi.product_id] = (dispatchedBySkuMap[oi.product_id] || 0) + q;
              }
            });
          });

          // Pillar 2 & 3: Actual Returned Items in this EOD offload
          let actualUnsoldCases = 0;
          let actualEmptyBottles = 0;
          let actualEmptyCases = 0;
          const returnedBySkuMap: Record<string, number> = {};
          const returnedEmptiesMap: Record<string, number> = {};

          transferItems.forEach((item: any) => {
            const qty = Number(item.quantity || 0);
            const isProd = item.item_type === 'PRODUCT' || (Boolean(item.product_id) && !item.returnable_item_id);

            if (isProd && item.product_id) {
              actualUnsoldCases += qty;
              returnedBySkuMap[item.product_id] = (returnedBySkuMap[item.product_id] || 0) + qty;
            } else {
              const retType = item.returnable_items?.item_type || item.returnable_items?.type || 'BOTTLE';
              if (retType === 'BOTTLE') {
                actualEmptyBottles += qty;
              } else {
                actualEmptyCases += qty;
              }
              if (item.returnable_item_id) {
                returnedEmptiesMap[item.returnable_item_id] = (returnedEmptiesMap[item.returnable_item_id] || 0) + qty;
              }
            }
          });

          // Compute SKU-by-SKU Cross-Reference Table
          const allSkuIds = Array.from(new Set([
            ...Object.keys(dispatchedBySkuMap),
            ...Object.keys(soldBySkuMap),
            ...Object.keys(returnedBySkuMap),
          ]));

          const productSkuBreakdown = allSkuIds.map((prodId) => {
            const prod = prods.find((p) => p.id === prodId);
            const dispatched = dispatchedBySkuMap[prodId] || 0;
            const sold = soldBySkuMap[prodId] || 0;
            const expectedUnsold = Math.max(0, dispatched - sold);
            const actualReturned = returnedBySkuMap[prodId] || 0;
            const variance = actualReturned - expectedUnsold;

            let status: 'MATCH' | 'SHORTAGE' | 'OVER' = 'MATCH';
            if (variance < 0) status = 'SHORTAGE';
            else if (variance > 0) status = 'OVER';

            return {
              productId: prodId,
              productName: prod?.name || 'Beverage Product',
              sku: prod?.sku || '',
              brand: prod?.brand || '',
              dispatchedQty: dispatched,
              soldQty: sold,
              expectedUnsold,
              actualReturned,
              variance,
              status,
            };
          });

          const totalSoldCases = Object.values(soldBySkuMap).reduce((acc, q) => acc + q, 0);
          const expectedUnsoldTotal = Math.max(0, initialDispatchedCases - totalSoldCases);

          // Pillar 3: Returnable Containers Cross-Reference
          let truckEmptyBottlesOnBoard = 0;
          let truckEmptyCasesOnBoard = 0;
          const truckRetBals = allReturnableBals.filter((rb) => rb.location_id === t.from_location_id);

          truckRetBals.forEach((rb) => {
            const itemType = rb.returnable_items?.item_type || rb.returnable_items?.type || 'BOTTLE';
            if (itemType === 'BOTTLE') truckEmptyBottlesOnBoard += Number(rb.quantity || 0);
            if (itemType === 'CASE') truckEmptyCasesOnBoard += Number(rb.quantity || 0);
          });

          // Empty containers breakdown
          const allReturnableIds = Array.from(new Set([
            ...truckRetBals.map((rb) => rb.returnable_item_id),
            ...Object.keys(returnedEmptiesMap),
          ]));

          const emptyContainersBreakdown = allReturnableIds.map((retId) => {
            const ret = rets.find((r) => r.id === retId);
            const trkBal = truckRetBals.find((rb) => rb.returnable_item_id === retId);
            const expectedOnTruck = Number(trkBal?.quantity || 0);
            const actualOffload = returnedEmptiesMap[retId] || 0;
            const variance = actualOffload - expectedOnTruck;

            let status: 'MATCH' | 'SHORTAGE' | 'OVER' = 'MATCH';
            if (variance < 0) status = 'SHORTAGE';
            else if (variance > 0) status = 'OVER';

            return {
              returnableId: retId,
              name: ret?.name || trkBal?.returnable_items?.name || 'Returnable Container',
              itemType: (ret?.item_type || ret?.type || 'BOTTLE') as 'BOTTLE' | 'CASE',
              unit: ret?.unit || 'pc',
              depositRate: Number(ret?.deposit_rate || ret?.pundo_value || 0),
              expectedOnTruck,
              actualOffload,
              variance,
              status,
            };
          });

          // Cash Audit Summary
          const expectedCash = totalSalesMoney;
          const actualCashDeclared = t.actual_cash_remitted !== null && t.actual_cash_remitted !== undefined
            ? Number(t.actual_cash_remitted)
            : expectedCash;
          const cashVariance = actualCashDeclared - expectedCash;

          routeAudit = {
            agent: matchedAgent,
            truck: matchedTruck,
            // Pillar 1: Cash
            cashAudit: {
              invoicesCount: truckSales.length,
              productSubtotal,
              bottlePundoTotal,
              casePundoTotal,
              expectedCashRemittance: expectedCash,
              actualCashRemitted: actualCashDeclared,
              cashVariance,
              status: cashVariance === 0 ? 'MATCH' : cashVariance < 0 ? 'SHORTAGE' : 'OVER',
            },
            cashRemittanceMoney: expectedCash,
            // Pillar 2: Unsold Product Cases
            initialDispatchedCases,
            casesSoldToday: totalSoldCases,
            expectedUnsoldCases: expectedUnsoldTotal,
            actualUnsoldCases,
            casesVariance: actualUnsoldCases - expectedUnsoldTotal,
            productSkuBreakdown,
            // Pillar 3: Empty Containers
            actualEmptyBottles,
            actualEmptyCases,
            expectedEmptyBottles: truckEmptyBottlesOnBoard || actualEmptyBottles,
            expectedEmptyCases: truckEmptyCasesOnBoard || actualEmptyCases,
            bottlesVariance: actualEmptyBottles - (truckEmptyBottlesOnBoard || actualEmptyBottles),
            casesEmptiesVariance: actualEmptyCases - (truckEmptyCasesOnBoard || actualEmptyCases),
            emptyContainersBreakdown,
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

  const handleOpenAuditModal = (t: any) => {
    setSelectedTransfer(t);
    const expected = Number(t.route_audit?.cashAudit?.expectedCashRemittance ?? t.route_audit?.cashRemittanceMoney ?? t.expected_cash_remittance ?? 0);
    const initialCash = t.actual_cash_remitted !== null && t.actual_cash_remitted !== undefined
      ? Number(t.actual_cash_remitted)
      : expected;
    setModalCashReceived(initialCash);
    setModalRemittanceNotes(t.remittance_notes || t.notes || '');
    setModalAuditTab('OVERVIEW');
  };

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
            transfer_type: 'WAREHOUSE_TO_TRUCK',
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

  const handleApproveOffloadTransfer = async (
    transferRecord: any,
    cashAmountOverride?: number,
    notesOverride?: string
  ) => {
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
            // Deduct product stock from truck location
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

            // Add product stock to warehouse location
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

      const expectedCash = Number(
        transferRecord.route_audit?.cashAudit?.expectedCashRemittance ??
        transferRecord.route_audit?.cashRemittanceMoney ??
        transferRecord.expected_cash_remittance ??
        0
      );
      const actualCashNum = cashAmountOverride !== undefined ? cashAmountOverride : modalCashReceived;
      const variance = actualCashNum - expectedCash;
      const remStatus = variance === 0 ? 'VERIFIED_MATCH' : 'DISCREPANCY';
      const notes = notesOverride !== undefined ? notesOverride : modalRemittanceNotes;

      const updatedData = {
        status: 'COMPLETED',
        expected_cash_remittance: expectedCash,
        actual_cash_remitted: actualCashNum,
        remittance_variance: variance,
        remittance_received_by: profile?.id || null,
        remittance_status: remStatus,
        remittance_notes: notes || null,
      };

      await supabase
        .from('stock_transfers')
        .update(updatedData)
        .eq('id', transferRecord.id);

      const completedRecord = {
        ...transferRecord,
        ...updatedData,
      };

      setSelectedTransfer(null);
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
      title: 'Reject / Cancel Stock Transfer',
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

      if (selectedTransfer?.id === transferId) {
        setSelectedTransfer(null);
      }
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
    // Type Filter
    if (typeFilter === 'EOD' && t.transfer_type !== 'TRUCK_OFFLOAD_EOD') return false;
    if (typeFilter === 'DISPATCH' && t.transfer_type === 'TRUCK_OFFLOAD_EOD') return false;

    // Date Filter
    if (dateFilter === 'TODAY') {
      const tDate = new Date(t.created_at);
      const today = new Date();
      if (tDate.toDateString() !== today.toDateString()) return false;
    } else if (dateFilter === 'THIS_WEEK') {
      const tDate = new Date(t.created_at);
      const today = new Date();
      const diffDays = (today.getTime() - tDate.getTime()) / (1000 * 3600 * 24);
      if (diffDays > 7) return false;
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const ref = (t.transfer_number || '').toLowerCase();
      const fromName = (t.from_location?.name || '').toLowerCase();
      const toName = (t.to_location?.name || '').toLowerCase();
      const agentName = (t.route_audit?.agent?.full_name || '').toLowerCase();
      return ref.includes(q) || fromName.includes(q) || toName.includes(q) || agentName.includes(q);
    }

    return true;
  });

  const pendingEodCount = transfers.filter(
    (t) => t.status === 'PENDING' && t.transfer_type === 'TRUCK_OFFLOAD_EOD'
  ).length;

  return (
    <div className="space-y-6">
      {/* Header & Quick Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900">
              Stock Transfers & Reconciliation Audit
            </h1>
            {pendingEodCount > 0 && (
              <Badge variant="warning" className="animate-pulse text-[11px] font-semibold">
                {pendingEodCount} Pending EOD Audit{pendingEodCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">
            Cross-reference check cash remittances, unsold product cases, and empty bottles/cases for all routes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-3.5 bg-zinc-50/50 border-zinc-200">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider block">
                Cash Remittance Audited
              </span>
              <span className="text-lg font-bold font-mono text-zinc-900">
                ₱{transfers
                  .filter((t) => t.transfer_type === 'TRUCK_OFFLOAD_EOD')
                  .reduce((sum, t) => sum + Number(t.actual_cash_remitted || t.route_audit?.cashRemittanceMoney || 0), 0)
                  .toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
        </Card>

        <Card className="p-3.5 bg-zinc-50/50 border-zinc-200">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider block">
                Unsold Cases Returned
              </span>
              <span className="text-lg font-bold font-mono text-zinc-900">
                {transfers
                  .filter((t) => t.transfer_type === 'TRUCK_OFFLOAD_EOD')
                  .reduce((sum, t) => sum + Number(t.route_audit?.actualUnsoldCases || 0), 0)}{' '}
                <span className="text-xs font-normal text-zinc-500 font-sans">cases</span>
              </span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
        </Card>

        <Card className="p-3.5 bg-zinc-50/50 border-zinc-200">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider block">
                Empties Returned to Depot
              </span>
              <span className="text-lg font-bold font-mono text-zinc-900">
                {transfers
                  .filter((t) => t.transfer_type === 'TRUCK_OFFLOAD_EOD')
                  .reduce((sum, t) => sum + Number(t.route_audit?.actualEmptyBottles || 0), 0)}{' '}
                <span className="text-xs font-normal text-zinc-500 font-sans">btls</span> /{' '}
                {transfers
                  .filter((t) => t.transfer_type === 'TRUCK_OFFLOAD_EOD')
                  .reduce((sum, t) => sum + Number(t.route_audit?.actualEmptyCases || 0), 0)}{' '}
                <span className="text-xs font-normal text-zinc-500 font-sans">cs</span>
              </span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between bg-white p-2.5 rounded-lg border border-zinc-200">
        <div className="flex flex-wrap items-center gap-2">
          {/* Transfer Type Filter */}
          <div className="flex items-center bg-zinc-100 p-0.5 rounded-md text-xs font-medium">
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                typeFilter === 'ALL' ? 'bg-white shadow-xs text-zinc-900 font-semibold' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              All Movements
            </button>
            <button
              onClick={() => setTypeFilter('EOD')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center space-x-1 ${
                typeFilter === 'EOD' ? 'bg-white shadow-xs text-zinc-900 font-semibold' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-zinc-700" />
              <span>Route EOD Audits</span>
            </button>
            <button
              onClick={() => setTypeFilter('DISPATCH')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center space-x-1 ${
                typeFilter === 'DISPATCH' ? 'bg-white shadow-xs text-zinc-900 font-semibold' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <TruckIcon className="w-3.5 h-3.5 text-zinc-700" />
              <span>Outbound Dispatches</span>
            </button>
          </div>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-950 cursor-pointer"
          >
            <option value="ALL">All Dates</option>
            <option value="TODAY">Today's Transfers</option>
            <option value="THIS_WEEK">Past 7 Days</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search transfer ref, truck, agent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-zinc-400 animate-pulse text-xs">
          Loading stock transfers and 3-pillar route audit data...
        </div>
      ) : filteredTransfers.length === 0 ? (
        <EmptyState
          title={searchQuery || typeFilter !== 'ALL' || dateFilter !== 'ALL' ? "No Transfers Match Filter" : "No Stock Transfers Found"}
          description="No stock transfers have been executed. Click 'Dispatch to Truck' to create an outbound load or wait for agent reconciliation."
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
                  <th className="px-4 py-3">Transfer Ref & Type</th>
                  <th className="px-4 py-3">Route Fleet / Origin</th>
                  <th className="px-4 py-3">Destination Depot</th>
                  <th className="px-4 py-3">3-Pillar Audit Summary</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {filteredTransfers.map((t) => {
                  const items = t.stock_transfer_items || [];
                  const isPending = t.status === 'PENDING';
                  const isCompleted = t.status === 'COMPLETED' || t.status === 'CONFIRMED';
                  const isCancelled = t.status === 'CANCELLED';
                  const isEod = t.transfer_type === 'TRUCK_OFFLOAD_EOD';

                  return (
                    <tr key={t.id} className="hover:bg-zinc-50/80 transition-colors">
                      {/* Ref */}
                      <td className="px-4 py-3 font-mono font-semibold text-zinc-900 text-xs">
                        <span>{t.transfer_number}</span>
                        {isEod ? (
                          <Badge variant="outline" className="block w-max text-[9px] mt-1 bg-zinc-100 text-zinc-800 font-sans font-semibold border-zinc-300">
                            🛡️ Route EOD Audit
                          </Badge>
                        ) : (
                          <span className="block text-[10px] text-zinc-400 font-sans font-normal mt-0.5">Outbound Load</span>
                        )}
                      </td>

                      {/* Origin */}
                      <td className="px-4 py-3 text-zinc-700">
                        <div className="flex items-center space-x-1.5">
                          {t.from_location?.type === 'TRUCK' ? (
                            <TruckIcon className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                          ) : (
                            <WarehouseIcon className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                          )}
                          <div className="truncate">
                            <span className="font-medium text-zinc-900 block truncate">
                              {t.from_location?.name || 'Main Warehouse'}
                            </span>
                            {t.route_audit?.agent?.full_name && (
                              <span className="text-[10px] text-zinc-500 block truncate">
                                Agent: {t.route_audit.agent.full_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Destination */}
                      <td className="px-4 py-3 text-zinc-900 font-medium">
                        <div className="flex items-center space-x-1.5">
                          {t.to_location?.type === 'TRUCK' ? (
                            <TruckIcon className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                          ) : (
                            <WarehouseIcon className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                          )}
                          <span className="truncate">{t.to_location?.name || 'Main Warehouse'}</span>
                        </div>
                      </td>

                      {/* 3-Pillar Cross-Reference Summary */}
                      <td className="px-4 py-3 text-xs">
                        {isEod && t.route_audit ? (
                          <div className="space-y-1 max-w-xs font-mono text-[11px]">
                            {/* 1. Cash */}
                            <div className="flex items-center justify-between bg-zinc-50 px-2 py-0.5 rounded border border-zinc-200">
                              <span className="text-zinc-500 font-sans text-[10px]">💵 Cash:</span>
                              <span className="font-bold text-zinc-900">
                                ₱{Number(t.actual_cash_remitted || t.route_audit.cashRemittanceMoney || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>

                            {/* 2. Unsold Cases */}
                            <div className="flex items-center justify-between bg-zinc-50 px-2 py-0.5 rounded border border-zinc-200">
                              <span className="text-zinc-500 font-sans text-[10px]">📦 Unsold:</span>
                              <span className="font-medium text-zinc-800">
                                {t.route_audit.actualUnsoldCases} cs returned{' '}
                                <span className="text-[10px] text-zinc-400 font-sans">
                                  ({t.route_audit.casesSoldToday} sold / {t.route_audit.initialDispatchedCases} disp)
                                </span>
                              </span>
                            </div>

                            {/* 3. Empty Containers */}
                            <div className="flex items-center justify-between bg-zinc-50 px-2 py-0.5 rounded border border-zinc-200">
                              <span className="text-zinc-500 font-sans text-[10px]">🔄 Empties:</span>
                              <span className="font-medium text-zinc-800">
                                {t.route_audit.actualEmptyBottles} btls / {t.route_audit.actualEmptyCases} cs
                              </span>
                            </div>
                          </div>
                        ) : items.length === 1 && items[0].products?.name ? (
                          <span className="font-medium text-zinc-900">
                            {items[0].products.name} ({items[0].quantity} cs)
                          </span>
                        ) : (
                          <span className="font-mono text-zinc-600">{items.length} item lines</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {isPending ? (
                          <Badge variant="warning" className="text-[10px] font-semibold">
                            <Clock className="w-3 h-3 mr-1" />
                            PENDING AUDIT
                          </Badge>
                        ) : isCompleted ? (
                          <Badge variant="default" className="text-[10px] font-semibold">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            CLEARED & MATCHED
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

                      {/* Date */}
                      <td className="px-4 py-3 text-xs text-zinc-500 font-mono">
                        {new Date(t.created_at).toLocaleDateString()}
                        <span className="block text-[10px] text-zinc-400">
                          {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenAuditModal(t)}
                            className="h-7 text-xs font-medium cursor-pointer"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            <span>Audit Details</span>
                          </Button>

                          {isPending && (
                            <Button
                              size="sm"
                              disabled={processingId === t.id}
                              onClick={() => handleOpenAuditModal(t)}
                              className="h-7 text-xs font-semibold cursor-pointer"
                            >
                              <Check className="w-3 h-3 mr-1" />
                              <span>Verify & Clear</span>
                            </Button>
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

      {/* Comprehensive 3-Pillar Cross-Reference Audit Modal */}
      {selectedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-zinc-200 rounded-xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl text-zinc-900 space-y-4 my-6 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3 shrink-0">
              <div>
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-zinc-900" />
                  <h3 className="font-bold text-base sm:text-lg text-zinc-900">
                    Route Reconciliation & 3-Pillar Audit
                  </h3>
                  <Badge variant="outline" className="font-mono text-xs">
                    {selectedTransfer.transfer_number}
                  </Badge>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Origin:{' '}
                  <span className="font-semibold text-zinc-800">
                    {selectedTransfer.from_location?.name || 'Truck'}
                  </span>{' '}
                  • Destination:{' '}
                  <span className="font-semibold text-zinc-800">
                    {selectedTransfer.to_location?.name || 'Depot'}
                  </span>
                  {selectedTransfer.route_audit?.agent?.full_name && (
                    <span> • Agent: <strong className="text-zinc-800">{selectedTransfer.route_audit.agent.full_name}</strong></span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setSelectedTransfer(null)}
                className="text-zinc-400 hover:text-zinc-700 cursor-pointer p-1 rounded-md hover:bg-zinc-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* 3-Pillar Cross-Reference Cards */}
              {selectedTransfer.route_audit && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Pillar 1: Cash Remittance Card */}
                  <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-emerald-600" />
                        <span>1. Cash Remittance</span>
                      </span>
                      {selectedTransfer.route_audit.cashAudit.status === 'MATCH' ? (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                          Exact Match
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                          Discrepancy
                        </span>
                      )}
                    </div>
                    <div className="pt-1">
                      <span className="text-[10px] text-zinc-500 block">Expected from Invoices:</span>
                      <span className="text-sm font-bold font-mono text-zinc-900">
                        ₱{selectedTransfer.route_audit.cashAudit.expectedCashRemittance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] pt-1 border-t border-zinc-200 text-zinc-600 font-mono">
                      <span>Physical Remitted:</span>
                      <span className="font-semibold text-zinc-900">
                        ₱{Number(modalCashReceived || selectedTransfer.route_audit.cashAudit.actualCashRemitted).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Pillar 2: Unsold Product Cases Card */}
                  <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                        <PackageCheck className="w-3 h-3 text-blue-600" />
                        <span>2. Unsold Product Cases</span>
                      </span>
                      {selectedTransfer.route_audit.casesVariance === 0 ? (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                          0 cs Variance
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                          {selectedTransfer.route_audit.casesVariance > 0 ? `+${selectedTransfer.route_audit.casesVariance}` : selectedTransfer.route_audit.casesVariance} cs
                        </span>
                      )}
                    </div>
                    <div className="pt-1">
                      <span className="text-[10px] text-zinc-500 block">Expected Unsold Return:</span>
                      <span className="text-sm font-bold font-mono text-zinc-900">
                        {selectedTransfer.route_audit.expectedUnsoldCases} cs
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] pt-1 border-t border-zinc-200 text-zinc-600 font-mono">
                      <span>Actual Offload:</span>
                      <span className="font-semibold text-zinc-900">
                        {selectedTransfer.route_audit.actualUnsoldCases} cs returned
                      </span>
                    </div>
                  </div>

                  {/* Pillar 3: Empty Containers Card */}
                  <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                        <RotateCcw className="w-3 h-3 text-amber-600" />
                        <span>3. Empty Containers</span>
                      </span>
                      <span className="text-[10px] font-semibold text-zinc-700 bg-zinc-200 px-1.5 py-0.5 rounded font-mono">
                        {selectedTransfer.route_audit.actualEmptyBottles} btls / {selectedTransfer.route_audit.actualEmptyCases} cs
                      </span>
                    </div>
                    <div className="pt-1">
                      <span className="text-[10px] text-zinc-500 block">Bottles on Board:</span>
                      <span className="text-sm font-bold font-mono text-zinc-900">
                        {selectedTransfer.route_audit.actualEmptyBottles} pcs
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] pt-1 border-t border-zinc-200 text-zinc-600 font-mono">
                      <span>Cases / Crates:</span>
                      <span className="font-semibold text-zinc-900">
                        {selectedTransfer.route_audit.actualEmptyCases} cs
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Navigation for Detailed Breakdown */}
              <div className="flex items-center space-x-1 border-b border-zinc-200 pb-2 text-xs font-semibold">
                <button
                  onClick={() => setModalAuditTab('OVERVIEW')}
                  className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                    modalAuditTab === 'OVERVIEW'
                      ? 'bg-zinc-900 text-white'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                  }`}
                >
                  📋 Full Audit Summary
                </button>
                <button
                  onClick={() => setModalAuditTab('SKUS')}
                  className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                    modalAuditTab === 'SKUS'
                      ? 'bg-zinc-900 text-white'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                  }`}
                >
                  📦 Unsold Cases (SKU Level)
                </button>
                <button
                  onClick={() => setModalAuditTab('EMPTIES')}
                  className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                    modalAuditTab === 'EMPTIES'
                      ? 'bg-zinc-900 text-white'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                  }`}
                >
                  🔄 Empty Containers
                </button>
                <button
                  onClick={() => setModalAuditTab('CASH')}
                  className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                    modalAuditTab === 'CASH'
                      ? 'bg-zinc-900 text-white'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                  }`}
                >
                  💵 Cash Remittance & Turnover
                </button>
              </div>

              {/* TAB 1: OVERVIEW */}
              {modalAuditTab === 'OVERVIEW' && (
                <div className="space-y-3">
                  {/* Line Items Table */}
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                      Itemized Line Items in Transfer
                    </h4>
                    <div className="bg-white border border-zinc-200 rounded-md overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-zinc-50 text-zinc-500 uppercase text-[10px] border-b border-zinc-200">
                          <tr>
                            <th className="p-2.5">Item Description</th>
                            <th className="p-2.5 text-center">Category</th>
                            <th className="p-2.5 text-right">Quantity</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {(selectedTransfer.stock_transfer_items || []).length > 0 ? (
                            selectedTransfer.stock_transfer_items.map((i: any) => {
                              const isProd = i.item_type === 'PRODUCT' || (Boolean(i.product_id) && !i.returnable_item_id);
                              const name = isProd
                                ? i.products?.name || 'Beverage Product'
                                : i.returnable_items?.name || 'Returnable Container';
                              const typeLabel = isProd ? 'PRODUCT CASE' : 'EMPTY CONTAINER';

                              return (
                                <tr key={i.id || Math.random()}>
                                  <td className="p-2.5 font-medium text-zinc-900">
                                    <span>{name}</span>
                                    {i.products?.sku && (
                                      <span className="block text-[10px] font-mono text-zinc-500 font-normal">
                                        SKU: {i.products.sku}
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <Badge
                                      variant={isProd ? 'secondary' : 'outline'}
                                      className="text-[9px]"
                                    >
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

                  {/* Route Reconciliation Overview Table */}
                  {selectedTransfer.route_audit && (
                    <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200 space-y-2 text-xs">
                      <h4 className="font-semibold text-zinc-800 uppercase tracking-wider text-[10px]">
                        Route Reconciliation Metrics
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                        <div className="bg-white p-2 rounded border border-zinc-200">
                          <span className="text-[10px] text-zinc-500 font-sans block">Dispatched Load:</span>
                          <span className="font-bold text-zinc-900 text-sm">
                            {selectedTransfer.route_audit.initialDispatchedCases} cs
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded border border-zinc-200">
                          <span className="text-[10px] text-zinc-500 font-sans block">Sold on Route:</span>
                          <span className="font-bold text-zinc-900 text-sm">
                            {selectedTransfer.route_audit.casesSoldToday} cs
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded border border-zinc-200">
                          <span className="text-[10px] text-zinc-500 font-sans block">Expected Return:</span>
                          <span className="font-bold text-zinc-900 text-sm">
                            {selectedTransfer.route_audit.expectedUnsoldCases} cs
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded border border-zinc-200">
                          <span className="text-[10px] text-zinc-500 font-sans block">Actual Returned:</span>
                          <span className="font-bold text-zinc-900 text-sm">
                            {selectedTransfer.route_audit.actualUnsoldCases} cs
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: SKU-LEVEL CROSS-REFERENCE TABLE */}
              {modalAuditTab === 'SKUS' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                      Product SKU Cross-Reference Breakdown
                    </h4>
                    <span className="text-[11px] text-zinc-500 font-mono">
                      Formula: Expected = max(0, Dispatched - Sold)
                    </span>
                  </div>

                  <div className="bg-white border border-zinc-200 rounded-md overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-zinc-50 text-zinc-500 uppercase text-[10px] border-b border-zinc-200">
                        <tr>
                          <th className="p-2.5">Product / SKU</th>
                          <th className="p-2.5 text-right">Dispatched</th>
                          <th className="p-2.5 text-right">Sold</th>
                          <th className="p-2.5 text-right">Expected</th>
                          <th className="p-2.5 text-right font-bold text-zinc-900">Returned</th>
                          <th className="p-2.5 text-right">Variance</th>
                          <th className="p-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {(selectedTransfer.route_audit?.productSkuBreakdown || []).length > 0 ? (
                          selectedTransfer.route_audit.productSkuBreakdown.map((row: any) => (
                            <tr key={row.productId} className="hover:bg-zinc-50">
                              <td className="p-2.5 font-medium text-zinc-900">
                                <div>{row.productName}</div>
                                {row.sku && <div className="text-[10px] font-mono text-zinc-500">{row.sku}</div>}
                              </td>
                              <td className="p-2.5 text-right font-mono text-zinc-600">{row.dispatchedQty} cs</td>
                              <td className="p-2.5 text-right font-mono text-zinc-600">{row.soldQty} cs</td>
                              <td className="p-2.5 text-right font-mono font-medium text-zinc-800">{row.expectedUnsold} cs</td>
                              <td className="p-2.5 text-right font-mono font-bold text-zinc-900 bg-zinc-50/50">{row.actualReturned} cs</td>
                              <td className="p-2.5 text-right font-mono">
                                {row.variance === 0 ? (
                                  <span className="text-zinc-500">0</span>
                                ) : row.variance > 0 ? (
                                  <span className="text-blue-600 font-semibold">+{row.variance} cs</span>
                                ) : (
                                  <span className="text-red-600 font-semibold">{row.variance} cs</span>
                                )}
                              </td>
                              <td className="p-2.5 text-center">
                                {row.status === 'MATCH' ? (
                                  <Badge variant="default" className="text-[9px]">MATCH</Badge>
                                ) : row.status === 'OVER' ? (
                                  <Badge variant="secondary" className="text-[9px] bg-blue-100 text-blue-800 border-blue-200">OVER</Badge>
                                ) : (
                                  <Badge variant="destructive" className="text-[9px]">SHORTAGE</Badge>
                                )}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="p-4 text-center text-xs text-zinc-400">
                              No product SKUs recorded for this route run.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: EMPTY CONTAINERS CROSS-REFERENCE */}
              {modalAuditTab === 'EMPTIES' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                      Empty Bottles & Cases Cross-Reference
                    </h4>
                    <span className="text-[11px] text-zinc-500 font-mono">
                      Deposit Return Valuation
                    </span>
                  </div>

                  <div className="bg-white border border-zinc-200 rounded-md overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-zinc-50 text-zinc-500 uppercase text-[10px] border-b border-zinc-200">
                        <tr>
                          <th className="p-2.5">Returnable Container</th>
                          <th className="p-2.5 text-center">Type</th>
                          <th className="p-2.5 text-right">Deposit Rate</th>
                          <th className="p-2.5 text-right">Expected</th>
                          <th className="p-2.5 text-right font-bold text-zinc-900">Returned</th>
                          <th className="p-2.5 text-right">Total Deposit Value</th>
                          <th className="p-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {(selectedTransfer.route_audit?.emptyContainersBreakdown || []).length > 0 ? (
                          selectedTransfer.route_audit.emptyContainersBreakdown.map((row: any) => (
                            <tr key={row.returnableId} className="hover:bg-zinc-50">
                              <td className="p-2.5 font-medium text-zinc-900">{row.name}</td>
                              <td className="p-2.5 text-center">
                                <Badge variant="outline" className="text-[9px]">
                                  {row.itemType}
                                </Badge>
                              </td>
                              <td className="p-2.5 text-right font-mono text-zinc-600">
                                ₱{Number(row.depositRate || 0).toFixed(2)}
                              </td>
                              <td className="p-2.5 text-right font-mono text-zinc-600">
                                {row.expectedOnTruck} {row.unit}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-zinc-900 bg-zinc-50/50">
                                {row.actualOffload} {row.unit}
                              </td>
                              <td className="p-2.5 text-right font-mono font-semibold text-zinc-900">
                                ₱{(row.actualOffload * row.depositRate).toFixed(2)}
                              </td>
                              <td className="p-2.5 text-center">
                                {row.status === 'MATCH' ? (
                                  <Badge variant="default" className="text-[9px]">MATCH</Badge>
                                ) : (
                                  <Badge variant="warning" className="text-[9px]">VARIANCE</Badge>
                                )}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="p-4 text-center text-xs text-zinc-400">
                              No returnable containers recorded in this offload.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: CASH REMITTANCE & TURNOVER */}
              {modalAuditTab === 'CASH' && (
                <div className="space-y-3">
                  <div className="bg-zinc-50 p-3.5 rounded-lg border border-zinc-200 space-y-3 text-xs">
                    <h4 className="font-semibold text-zinc-900 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                      <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Sales Invoices & Cash Breakdown</span>
                    </h4>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-zinc-600">
                        <span>Delivered Route Invoices Count:</span>
                        <span className="font-mono font-semibold text-zinc-900">
                          {selectedTransfer.route_audit?.cashAudit?.invoicesCount || 0} invoices
                        </span>
                      </div>
                      <div className="flex justify-between text-zinc-600">
                        <span>Beverage Products Subtotal:</span>
                        <span className="font-mono font-semibold text-zinc-900">
                          ₱{Number(selectedTransfer.route_audit?.cashAudit?.productSubtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-zinc-600">
                        <span>Bottle Pundo / Container Deposits Collected:</span>
                        <span className="font-mono font-semibold text-zinc-900">
                          ₱{Number(selectedTransfer.route_audit?.cashAudit?.bottlePundoTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-zinc-600">
                        <span>Case / Crate Pundo Deposits Collected:</span>
                        <span className="font-mono font-semibold text-zinc-900">
                          ₱{Number(selectedTransfer.route_audit?.cashAudit?.casePundoTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-zinc-200 text-sm font-bold">
                        <span className="text-zinc-900">Total Expected Cash Remittance:</span>
                        <span className="font-mono text-emerald-700">
                          ₱{Number(selectedTransfer.route_audit?.cashAudit?.expectedCashRemittance || selectedTransfer.route_audit?.cashRemittanceMoney || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Cash Received Verification Form */}
                  <div className="p-3.5 bg-white rounded-lg border border-zinc-200 space-y-3">
                    <h4 className="text-xs font-semibold text-zinc-900">
                      Physical Cash Verification & Auditor Turnover
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-zinc-700">
                          Physical Cash Counted / Received (₱)
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={modalCashReceived}
                          onChange={(e) => setModalCashReceived(parseFloat(e.target.value) || 0)}
                          className="font-mono font-bold text-sm"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-zinc-700">
                          Calculated Variance
                        </label>
                        <div className="p-2 rounded-md bg-zinc-50 border border-zinc-200 font-mono text-sm flex items-center justify-between">
                          <span className="text-xs text-zinc-500 font-sans">Variance:</span>
                          {modalCashReceived - Number(selectedTransfer.route_audit?.cashAudit?.expectedCashRemittance || selectedTransfer.route_audit?.cashRemittanceMoney || 0) === 0 ? (
                            <span className="text-emerald-700 font-bold">₱0.00 (Exact Match)</span>
                          ) : modalCashReceived - Number(selectedTransfer.route_audit?.cashAudit?.expectedCashRemittance || selectedTransfer.route_audit?.cashRemittanceMoney || 0) > 0 ? (
                            <span className="text-blue-700 font-bold">
                              +₱{(modalCashReceived - Number(selectedTransfer.route_audit?.cashAudit?.expectedCashRemittance || selectedTransfer.route_audit?.cashRemittanceMoney || 0)).toFixed(2)} (Surplus)
                            </span>
                          ) : (
                            <span className="text-red-700 font-bold">
                              -₱{Math.abs(modalCashReceived - Number(selectedTransfer.route_audit?.cashAudit?.expectedCashRemittance || selectedTransfer.route_audit?.cashRemittanceMoney || 0)).toFixed(2)} (Shortage)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-zinc-700">
                        Remittance Audit Notes / Remarks
                      </label>
                      <Input
                        placeholder="e.g. Exact cash collected verified by cashier; full crates accounted for"
                        value={modalRemittanceNotes}
                        onChange={(e) => setModalRemittanceNotes(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-zinc-200 shrink-0">
              <div className="text-xs text-zinc-500">
                Status:{' '}
                <strong className="text-zinc-800 font-mono">
                  {selectedTransfer.status}
                </strong>
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                {selectedTransfer.status === 'PENDING' ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRejectTransfer(selectedTransfer.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                    >
                      Reject Transfer
                    </Button>

                    <Button
                      onClick={() =>
                        handleApproveOffloadTransfer(
                          selectedTransfer,
                          modalCashReceived,
                          modalRemittanceNotes
                        )
                      }
                      disabled={processingId === selectedTransfer.id}
                      size="sm"
                      className="font-semibold text-xs cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                      <span>
                        {processingId === selectedTransfer.id
                          ? 'Clearing Stock...'
                          : 'Approve & Confirm Settlement'}
                      </span>
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setVoucherTransfer(selectedTransfer);
                      setShowVoucherModal(true);
                    }}
                    className="text-xs font-medium cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1" />
                    <span>View Clearance Slip</span>
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedTransfer(null)}
                  className="text-xs"
                >
                  Close
                </Button>
              </div>
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

      {/* Printable 3-Pillar Clearance Slip Modal */}
      {showVoucherModal && voucherTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-zinc-300 rounded-lg max-w-lg w-full p-6 shadow-2xl text-zinc-900 space-y-4 font-mono text-xs my-6">
            {/* Header */}
            <div className="border-b border-zinc-200 pb-3 text-center font-sans">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900">
                {tenant?.name || 'Beverage Distribution System'}
              </h2>
              <p className="text-xs text-zinc-600 font-semibold mt-0.5">Route Settlement & Clearance Slip</p>
              <p className="text-[10px] text-zinc-400 font-mono mt-0.5">Ref: {voucherTransfer.transfer_number}</p>
            </div>

            {/* Meta */}
            <div className="grid grid-cols-2 gap-2 bg-zinc-50 p-2.5 rounded border border-zinc-200">
              <div>
                <span className="text-zinc-500 text-[10px] block font-sans">TRUCK / FLEET:</span>
                <span className="text-zinc-900 font-semibold">{voucherTransfer.from_location?.name || 'Truck'}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] block font-sans">AGENT:</span>
                <span className="text-zinc-900 font-semibold">{voucherTransfer.route_audit?.agent?.full_name || 'Route Sales Agent'}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] block font-sans">DATE:</span>
                <span className="text-zinc-900">{new Date(voucherTransfer.created_at).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] block font-sans">STATUS:</span>
                <span className="text-emerald-700 font-bold">{voucherTransfer.remittance_status || 'CLEARED & VERIFIED'}</span>
              </div>
            </div>

            {/* 1. Cash Remittance */}
            <div className="space-y-1 bg-zinc-50 p-2.5 rounded border border-zinc-200">
              <span className="text-[10px] font-bold text-zinc-700 uppercase font-sans block">
                1. Cash Remittance
              </span>
              <div className="flex justify-between">
                <span>Expected Cash (Invoices):</span>
                <span>₱{Number(voucherTransfer.expected_cash_remittance || voucherTransfer.route_audit?.cashRemittanceMoney || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Actual Cash Remitted:</span>
                <span className="text-zinc-900">₱{Number(voucherTransfer.actual_cash_remitted || voucherTransfer.route_audit?.cashRemittanceMoney || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-zinc-200">
                <span>Variance:</span>
                <span className={voucherTransfer.remittance_variance === 0 ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>
                  ₱{Number(voucherTransfer.remittance_variance || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* 2. Product Inventory Offload */}
            <div className="space-y-1 bg-zinc-50 p-2.5 rounded border border-zinc-200">
              <span className="text-[10px] font-bold text-zinc-700 uppercase font-sans block">
                2. Unsold Product Cases
              </span>
              <div className="flex justify-between">
                <span>Dispatched Morning Load:</span>
                <span>{voucherTransfer.route_audit?.initialDispatchedCases || 0} cs</span>
              </div>
              <div className="flex justify-between">
                <span>Delivered on Route:</span>
                <span>{voucherTransfer.route_audit?.casesSoldToday || 0} cs</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Unsold Cases Returned:</span>
                <span>{voucherTransfer.route_audit?.actualUnsoldCases || 0} cs</span>
              </div>
            </div>

            {/* 3. Empty Containers */}
            <div className="space-y-1 bg-zinc-50 p-2.5 rounded border border-zinc-200">
              <span className="text-[10px] font-bold text-zinc-700 uppercase font-sans block">
                3. Empty Containers Returned
              </span>
              <div className="flex justify-between">
                <span>Empty Bottles:</span>
                <span>{voucherTransfer.route_audit?.actualEmptyBottles || 0} pcs</span>
              </div>
              <div className="flex justify-between">
                <span>Empty Cases / Crates:</span>
                <span>{voucherTransfer.route_audit?.actualEmptyCases || 0} cs</span>
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-200 font-sans text-[11px] text-center">
              <div>
                <div className="border-b border-zinc-300 pb-6 mb-1"></div>
                <span className="text-zinc-600 block">Agent Signature</span>
              </div>
              <div>
                <div className="border-b border-zinc-300 pb-6 mb-1"></div>
                <span className="text-zinc-600 block">Depot Auditor / Cashier</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-between items-center pt-3 border-t border-zinc-200 font-sans">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="flex items-center space-x-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Clearance Slip</span>
              </Button>

              <Button
                size="sm"
                onClick={() => setShowVoucherModal(false)}
                className="cursor-pointer"
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
