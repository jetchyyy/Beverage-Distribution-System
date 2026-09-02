import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { CheckSquare, Package, RotateCcw, Clock, ShieldCheck, PackageX } from 'lucide-react';

export const AgentReconciliation: React.FC = () => {
  const { tenant } = useTenant();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [truck, setTruck] = useState<any | null>(null);
  const [warehouseLocationId, setWarehouseLocationId] = useState<string | null>(null);

  // Unsold Full Cases on Truck
  const [productReconcileItems, setProductReconcileItems] = useState<any[]>([]);

  // Collected Empties (Bottles & Cases) on Truck
  const [emptyReconcileItems, setEmptyReconcileItems] = useState<any[]>([]);

  const fetchReconcileData = async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      // 1. Resolve Main Warehouse Location
      const { data: whLoc } = await supabase
        .from('locations')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('type', 'WAREHOUSE')
        .limit(1)
        .maybeSingle();

      setWarehouseLocationId(whLoc?.id || null);

      // 2. Resolve Truck & Location
      const { data: trk } = await supabase
        .from('trucks')
        .select('*')
        .eq('tenant_id', tenant.id)
        .limit(1)
        .maybeSingle();

      if (trk && trk.location_id) {
        setTruck(trk);

        // Fetch Full Product Cases Loaded on Truck (> 0 qty)
        const { data: prodBals } = await supabase
          .from('inventory_balances')
          .select('*, products(name, sku)')
          .eq('location_id', trk.location_id);

        const prodItems = (prodBals || [])
          .filter((b) => Number(b.quantity || 0) > 0)
          .map((b) => ({
            balance_id: b.id,
            product_id: b.product_id,
            name: b.products?.name || 'Beverage Item',
            sku: b.products?.sku || '',
            expected_qty: Number(b.quantity || 0),
            actual_qty: Number(b.quantity || 0),
            variance: 0,
          }));

        setProductReconcileItems(prodItems);

        // Fetch Empty Bottles & Cases Collected on Truck (> 0 qty)
        const { data: retBals } = await supabase
          .from('returnable_balances')
          .select('*, returnable_items(name, item_type, type, unit, pundo_value)')
          .eq('location_id', trk.location_id);

        const emptyItems = (retBals || [])
          .filter((b) => Number(b.quantity || 0) > 0)
          .map((b) => ({
            balance_id: b.id,
            returnable_item_id: b.returnable_item_id,
            name: b.returnable_items?.name || 'Returnable Container',
            item_type: b.returnable_items?.item_type || b.returnable_items?.type || 'CONTAINER',
            unit: b.returnable_items?.unit || 'pc',
            expected_qty: Number(b.quantity || 0),
            actual_qty: Number(b.quantity || 0),
            variance: 0,
          }));

        setEmptyReconcileItems(emptyItems);
      }
    } catch (err) {
      console.error('Error loading reconciliation data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReconcileData();
  }, [tenant]);

  const updateProductActual = (index: number, val: number) => {
    setProductReconcileItems((prev) => {
      const next = [...prev];
      const actual = Math.max(0, val);
      const expected = next[index].expected_qty;
      next[index] = {
        ...next[index],
        actual_qty: actual,
        variance: actual - expected,
      };
      return next;
    });
  };

  const updateEmptyActual = (index: number, val: number) => {
    setEmptyReconcileItems((prev) => {
      const next = [...prev];
      const actual = Math.max(0, val);
      const expected = next[index].expected_qty;
      next[index] = {
        ...next[index],
        actual_qty: actual,
        variance: actual - expected,
      };
      return next;
    });
  };

  const handleConfirmReconciliation = async () => {
    if (!tenant || !truck || !truck.location_id) return;
    setSubmitting(true);

    try {
      const recNum = `REC-${Date.now().toString().slice(-6)}`;
      const transferNum = `TRF-EOD-${Date.now().toString().slice(-6)}`;

      // Resolve Agent ID
      let activeAgentId = profile?.id;
      const { data: agt } = await supabase
        .from('agents')
        .select('id')
        .eq('tenant_id', tenant.id)
        .limit(1)
        .maybeSingle();
      activeAgentId = agt?.id || profile?.id;

      // 1. Record Reconciliation Audit Entry
      const { data: newRec } = await supabase
        .from('truck_reconciliations')
        .insert([
          {
            tenant_id: tenant.id,
            reconciliation_number: recNum,
            truck_id: truck.id,
            agent_id: activeAgentId,
            status: 'PENDING_APPROVAL',
            created_by: profile?.id || null,
          },
        ])
        .select()
        .maybeSingle();

      // 2. Create Stock Transfer Request (PENDING ADMIN APPROVAL)
      const totalUnsoldCases = productReconcileItems.reduce((acc, p) => acc + p.actual_qty, 0);
      const totalEmptiesCount = emptyReconcileItems.reduce((acc, e) => acc + e.actual_qty, 0);

      const transferPayload = {
        tenant_id: tenant.id,
        transfer_number: transferNum,
        from_location_id: truck.location_id,
        to_location_id: warehouseLocationId,
        status: 'PENDING',
        transfer_type: 'TRUCK_OFFLOAD_EOD',
        notes: `Route EOD Return: ${totalUnsoldCases} unsold product cases & ${totalEmptiesCount} empty containers returned by Agent`,
      };

      let transferRecord: any = null;
      const { data: trfRes, error: trfErr } = await supabase
        .from('stock_transfers')
        .insert([transferPayload])
        .select()
        .maybeSingle();

      if (trfErr) throw trfErr;
      transferRecord = trfRes;

      // 3. Insert Transfer Item Lines for Audit Trail
      if (transferRecord?.id) {
        // Unsold Full Product Cases
        for (const pItem of productReconcileItems) {
          if (pItem.actual_qty > 0) {
            await supabase.from('stock_transfer_items').insert([
              {
                stock_transfer_id: transferRecord.id,
                product_id: pItem.product_id,
                item_type: 'PRODUCT',
                quantity: pItem.actual_qty,
                unit: 'case',
              },
            ]);
          }

          if (newRec?.id) {
            await supabase.from('reconciliation_items').insert([
              {
                reconciliation_id: newRec.id,
                item_type: 'PRODUCT',
                product_id: pItem.product_id,
                unit: 'case',
                expected_qty: pItem.expected_qty,
                actual_qty: pItem.actual_qty,
                variance_qty: pItem.variance,
              },
            ]);
          }
        }

        // Collected Empty Bottles & Cases
        for (const eItem of emptyReconcileItems) {
          if (eItem.actual_qty > 0) {
            await supabase.from('stock_transfer_items').insert([
              {
                stock_transfer_id: transferRecord.id,
                returnable_item_id: eItem.returnable_item_id,
                item_type: 'CONTAINER',
                quantity: eItem.actual_qty,
                unit: eItem.unit || 'pc',
              },
            ]);
          }
        }
      }

      setSuccess(true);
    } catch (err: any) {
      console.error('Reconciliation failed:', err);
      alert(err.message || 'Failed to submit route reconciliation');
    } finally {
      setSubmitting(false);
    }
  };

  const isTruckEmptyToReconcile = productReconcileItems.length === 0 && emptyReconcileItems.length === 0;

  if (success) {
    return (
      <div className="py-10 text-center space-y-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md mx-auto">
        <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto text-amber-400">
          <Clock className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-white">Route EOD Offload Submitted!</h2>
          <p className="text-xs text-slate-400 mt-1">
            Your transfer request has been logged in <strong className="text-indigo-400">Stock Transfers</strong> with an audit trail and is pending Admin approval.
          </p>
        </div>

        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left text-xs space-y-2 font-mono">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <span className="text-slate-400 font-bold uppercase text-[10px]">TRANSFER AUDIT TRAIL</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              PENDING ADMIN APPROVAL
            </span>
          </div>

          <div className="text-slate-400 font-bold text-[10px] pt-1">Returned Items Pending Warehouse Receipt:</div>
          {productReconcileItems.map((p) => (
            <div key={p.product_id} className="flex justify-between text-white">
              <span>{p.name}:</span>
              <span className="text-indigo-300 font-bold">{p.actual_qty} cases</span>
            </div>
          ))}
          {emptyReconcileItems.map((e) => (
            <div key={e.returnable_item_id} className="flex justify-between text-cyan-300 font-bold">
              <span>{e.name}:</span>
              <span>{e.actual_qty} {e.unit}s</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            setSuccess(false);
            fetchReconcileData();
          }}
          className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30"
        >
          Return to Reconciliation Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-md mx-auto pb-20">
      <div className="border-b border-slate-800 pb-3">
        <h1 className="text-xl font-extrabold text-white flex items-center space-x-2">
          <CheckSquare className="w-5 h-5 text-indigo-400" />
          <span>Agent Daily Truck Reconciliation</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">Verify unsold stock and collected empty containers to submit EOD transfer for Admin approval</p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 text-xs animate-pulse">Calculating truck inventory balances...</div>
      ) : isTruckEmptyToReconcile ? (
        <div className="py-12 px-6 text-center space-y-3 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
          <PackageX className="w-12 h-12 text-slate-600 mx-auto" />
          <h2 className="text-lg font-extrabold text-white">Truck is Empty</h2>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            No full product cases or collected empty containers on board to reconcile.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Section 1: Unsold Full Product Cases */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <Package className="w-4 h-4 text-indigo-400" />
              <span>1. Unsold Full Product Cases on Board</span>
            </div>

            {productReconcileItems.length === 0 ? (
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center text-xs text-slate-500">
                No unsold full product cases on board. Truck is empty.
              </div>
            ) : (
              productReconcileItems.map((item, idx) => (
                <div key={item.product_id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white text-base">{item.name}</h4>
                    <span className="text-xs text-slate-400 font-mono">Expected: <strong className="text-indigo-400">{item.expected_qty} cases</strong></span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800 items-center">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Actual Count (Cases)</label>
                      <input
                        type="number"
                        min="0"
                        value={item.actual_qty}
                        onChange={(e) => updateProductActual(idx, parseInt(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono font-bold text-white text-base"
                      />
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Variance</p>
                      <p
                        className={`font-mono text-base font-black ${
                          item.variance === 0
                            ? 'text-emerald-400'
                            : item.variance < 0
                            ? 'text-rose-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {item.variance > 0 ? `+${item.variance}` : item.variance} cases
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Section 2: Collected Empty Bottles & Cases */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <RotateCcw className="w-4 h-4 text-amber-400" />
              <span>2. Collected Empty Bottles & Plastic Shell Cases</span>
            </div>

            {emptyReconcileItems.length === 0 ? (
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center text-xs text-slate-500">
                No empty bottles or cases collected on truck.
              </div>
            ) : (
              emptyReconcileItems.map((item, idx) => (
                <div key={item.returnable_item_id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-base">{item.name}</h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 uppercase font-bold">
                        {item.item_type}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">Expected: <strong className="text-amber-400">{item.expected_qty} {item.unit}s</strong></span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800 items-center">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Actual Count ({item.unit}s)</label>
                      <input
                        type="number"
                        min="0"
                        value={item.actual_qty}
                        onChange={(e) => updateEmptyActual(idx, parseInt(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono font-bold text-white text-base"
                      />
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Variance</p>
                      <p
                        className={`font-mono text-base font-black ${
                          item.variance === 0
                            ? 'text-emerald-400'
                            : item.variance < 0
                            ? 'text-rose-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {item.variance > 0 ? `+${item.variance}` : item.variance} {item.unit}s
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            disabled={submitting}
            onClick={handleConfirmReconciliation}
            className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-extrabold text-base shadow-lg shadow-indigo-600/30 touch-target flex items-center justify-center space-x-2"
          >
            <ShieldCheck className="w-5 h-5" />
            <span>{submitting ? 'Submitting Transfer Request...' : 'SUBMIT RECONCILIATION & REQUEST OFFLOAD'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
