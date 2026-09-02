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
} from 'lucide-react';

export const StockTransfersPage: React.FC = () => {
  const { tenant } = useTenant();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [warehouseLocationId, setWarehouseLocationId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected Transfer Modal View
  const [selectedTransfer, setSelectedTransfer] = useState<any | null>(null);

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

      // 2. Fetch Catalog (Products & Trucks)
      const { data: prods } = await supabase.from('products').select('*').eq('tenant_id', tenant.id);
      setProducts(prods || []);

      const { data: trks } = await supabase.from('trucks').select('*').eq('tenant_id', tenant.id);
      setTrucks(trks || []);

      // 3. Fetch Stock Transfer History with Locations & Transfer Items
      const { data: trfs, error: trfErr } = await supabase
        .from('stock_transfers')
        .select(`
          *,
          from_location:locations!from_location_id(id, name, type),
          to_location:locations!to_location_id(id, name, type),
          stock_transfer_items(
            id,
            item_type,
            quantity,
            unit,
            product_id,
            returnable_item_id,
            products(name, sku),
            returnable_items(name, unit, item_type, type)
          )
        `)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (trfErr) throw trfErr;
      setTransfers(trfs || []);
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

      // 3. Deduct Stock from Main Warehouse
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

      // Update Transfer Status to COMPLETED
      await supabase
        .from('stock_transfers')
        .update({ status: 'COMPLETED' })
        .eq('id', transferRecord.id);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Stock Transfers & Fleet Movements</h1>
          <p className="text-slate-400 text-sm">Audit trail for outbound truck dispatch loading & end-of-day agent offload returns</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center space-x-2 transition-all shadow-lg shadow-indigo-600/30 self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Dispatch Stock to Truck</span>
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-500 animate-pulse">Loading stock transfer history...</div>
      ) : transfers.length === 0 ? (
        <EmptyState
          title="No Stock Transfers Created"
          description="No inventory stock transfers have been executed yet. Transfer stock from main warehouse to agent trucks or approve route returns here."
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
                {transfers.map((t) => {
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
                      const isProd = i.item_type === 'PRODUCT' || i.products;
                      const name = isProd ? i.products?.name : i.returnable_items?.name;
                      const typeLabel = isProd ? 'PRODUCT CASE' : i.returnable_items?.item_type || 'CONTAINER';

                      return (
                        <tr key={i.id}>
                          <td className="p-3 font-semibold text-white">{name || 'Inventory Item'}</td>
                          <td className="p-3 text-center">
                            <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                              isProd ? 'bg-indigo-500/10 text-indigo-400' : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              {typeLabel}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-400">
                            {i.quantity} {i.unit || 'pcs'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
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
    </div>
  );
};
