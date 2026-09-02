import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import type { MicroStore, ReturnableItem, Truck } from '../../types/database.types';
import { ShoppingBag, ArrowRight, Minus, Plus, Coins, CheckCircle2, Printer, FileText, AlertCircle, Check } from 'lucide-react';

export const AgentDeliveryFlow: React.FC = () => {
  const { tenant } = useTenant();
  const { profile } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [stores, setStores] = useState<MicroStore[]>([]);
  const [selectedStore, setSelectedStore] = useState<MicroStore | null>(null);
  const [truck, setTruck] = useState<Truck | null>(null);
  const [truckBalances, setTruckBalances] = useState<any[]>([]);
  const [returnableCatalog, setReturnableCatalog] = useState<ReturnableItem[]>([]);

  // Cart State: Map<productId, { product, qtyCases, casePrice, unitsPerCase }>
  const [cart, setCart] = useState<Map<string, { product: any; qtyCases: number; casePrice: number; unitsPerCase: number }>>(new Map());

  // Returns State: Map<returnableItemId, { item, returnedQty }>
  const [returnsMap, setReturnsMap] = useState<Map<string, { item: ReturnableItem; returnedQty: number }>>(new Map());

  const [submitting, setSubmitting] = useState(false);
  const [saleRecord, setSaleRecord] = useState<any>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchDeliveryData = async () => {
    if (!tenant) return;
    try {
      const { data: st } = await supabase.from('micro_stores').select('*').eq('tenant_id', tenant.id).order('store_name');
      setStores(st || []);

      const { data: rets } = await supabase.from('returnable_items').select('*').eq('tenant_id', tenant.id);
      setReturnableCatalog(rets || []);

      const { data: trkData } = await supabase
        .from('trucks')
        .select('*')
        .eq('tenant_id', tenant.id)
        .limit(1)
        .maybeSingle();

      if (trkData) {
        setTruck(trkData);
        if (trkData.location_id) {
          const { data: bals } = await supabase
            .from('inventory_balances')
            .select('*, products(*, product_packaging(*), product_prices(*))')
            .eq('location_id', trkData.location_id);
          setTruckBalances(bals || []);
        }
      }
    } catch (err) {
      console.error('Error initializing delivery data:', err);
    }
  };

  useEffect(() => {
    fetchDeliveryData();
  }, [tenant]);

  const updateCartQty = (prodBal: any, delta: number) => {
    const prod = prodBal.products;
    const prodId = prod.id;
    const pkg = prod.product_packaging?.[0];
    const unitsPerCase = Number(pkg?.units_per_package || pkg?.units_per_case || 24);
    const priceObj = prod.product_prices?.find((p: any) => p.is_active) || prod.product_prices?.[0];
    const casePrice = Number(priceObj?.case_price || priceObj?.price || 0);
    const maxAvail = Number(prodBal.quantity || 0);

    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(prodId);
      const currentQty = existing ? existing.qtyCases : 0;
      const newQty = Math.max(0, Math.min(maxAvail, currentQty + delta));

      if (newQty === 0) {
        next.delete(prodId);
      } else {
        next.set(prodId, { product: prod, qtyCases: newQty, casePrice, unitsPerCase });
      }
      return next;
    });
  };

  const setCartQtyDirect = (prodBal: any, targetQty: number) => {
    const prod = prodBal.products;
    const prodId = prod.id;
    const pkg = prod.product_packaging?.[0];
    const unitsPerCase = Number(pkg?.units_per_package || pkg?.units_per_case || 24);
    const priceObj = prod.product_prices?.find((p: any) => p.is_active) || prod.product_prices?.[0];
    const casePrice = Number(priceObj?.case_price || priceObj?.price || 0);
    const maxAvail = Number(prodBal.quantity || 0);
    const validatedQty = Math.max(0, Math.min(maxAvail, targetQty));

    setCart((prev) => {
      const next = new Map(prev);
      if (validatedQty === 0) {
        next.delete(prodId);
      } else {
        next.set(prodId, { product: prod, qtyCases: validatedQty, casePrice, unitsPerCase });
      }
      return next;
    });
  };

  // Preserve entered return quantities when navigating between steps
  const prepareReturnablesStep = () => {
    setReturnsMap((prev) => {
      const nextReturns = new Map(prev);
      returnableCatalog.forEach((item) => {
        if (!nextReturns.has(item.id)) {
          nextReturns.set(item.id, { item, returnedQty: 0 });
        }
      });
      return nextReturns;
    });
    setStep(3);
  };

  const updateReturnedQty = (returnableId: string, delta: number) => {
    setReturnsMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(returnableId);
      if (existing) {
        next.set(returnableId, { ...existing, returnedQty: Math.max(0, existing.returnedQty + delta) });
      }
      return next;
    });
  };

  const setReturnedQtyDirect = (returnableId: string, targetQty: number) => {
    setReturnsMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(returnableId);
      if (existing) {
        next.set(returnableId, { ...existing, returnedQty: Math.max(0, targetQty) });
      }
      return next;
    });
  };

  // 1. Delivered Products & Subtotal Calculation
  let totalDeliveredCases = 0;
  let totalDeliveredBottles = 0;
  let cartTotal = 0;

  cart.forEach((val) => {
    totalDeliveredCases += val.qtyCases;
    totalDeliveredBottles += val.qtyCases * val.unitsPerCase;
    cartTotal += val.qtyCases * val.casePrice;
  });

  // 2. Returned Containers Calculation
  let totalReturnedBottles = 0;
  let totalReturnedCases = 0;
  const returnedItemsList: { item: ReturnableItem; returnedQty: number; rate: number; totalValue: number }[] = [];

  returnsMap.forEach(({ item, returnedQty }) => {
    if (returnedQty > 0) {
      const rate = Number(item.deposit_rate || item.pundo_value || 0);
      const isBottle = item.item_type === 'BOTTLE' || item.type === 'BOTTLE';
      const isCase = item.item_type === 'CASE' || item.type === 'CASE';

      if (isBottle) totalReturnedBottles += returnedQty;
      if (isCase) totalReturnedCases += returnedQty;

      returnedItemsList.push({
        item,
        returnedQty,
        rate,
        totalValue: returnedQty * rate,
      });
    }
  });

  // 3. Container Exchange & Lacking PUNDO Calculation
  const bottleItem = returnableCatalog.find((r) => r.item_type === 'BOTTLE' || r.type === 'BOTTLE');
  const plasticCaseItem = returnableCatalog.find((r) => r.item_type === 'CASE' || r.type === 'CASE');

  const bottlePundoRate = Number(bottleItem?.deposit_rate || bottleItem?.pundo_value || 3.00);
  const casePundoRate = Number(plasticCaseItem?.deposit_rate || plasticCaseItem?.pundo_value || 50.00);

  // Shortage (Lacking Containers)
  const lackingBottles = Math.max(0, totalDeliveredBottles - totalReturnedBottles);
  const lackingCases = Math.max(0, totalDeliveredCases - totalReturnedCases);

  // Surplus Empties Returned (Credit/Refund)
  const surplusBottles = Math.max(0, totalReturnedBottles - totalDeliveredBottles);
  const surplusCases = Math.max(0, totalReturnedCases - totalDeliveredCases);

  // PUNDO Amounts
  const bottlePundoCharge = lackingBottles * bottlePundoRate;
  const casePundoCharge = lackingCases * casePundoRate;
  const extraEmptiesCredit = (surplusBottles * bottlePundoRate) + (surplusCases * casePundoRate);

  const netPundoDepositDue = bottlePundoCharge + casePundoCharge - extraEmptiesCredit;
  const netTotalPayable = Math.max(0, cartTotal + netPundoDepositDue);

  const handleConfirmDelivery = async () => {
    if (!tenant || !selectedStore || !truck) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      // Resolve valid Agent ID (FK to agents table)
      let activeAgentId: string | null = null;
      if (profile?.id) {
        const { data: agtByUserId } = await supabase
          .from('agents')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('user_id', profile.id)
          .limit(1)
          .maybeSingle();
        activeAgentId = agtByUserId?.id || null;
      }

      if (!activeAgentId) {
        const { data: fallbackAgt } = await supabase
          .from('agents')
          .select('id')
          .eq('tenant_id', tenant.id)
          .limit(1)
          .maybeSingle();
        activeAgentId = fallbackAgt?.id || null;
      }

      if (!activeAgentId) {
        const { data: newAgt } = await supabase
          .from('agents')
          .insert([
            {
              tenant_id: tenant.id,
              user_id: profile?.id || null,
              employee_code: `AGT-${Date.now().toString().slice(-4)}`,
              full_name: profile?.full_name || 'Route Sales Agent',
              assigned_truck_id: truck.id,
              status: 'ACTIVE',
            },
          ])
          .select()
          .maybeSingle();
        activeAgentId = newAgt?.id || null;
      }

      if (!activeAgentId) throw new Error('Agent record could not be initialized.');

      const saleNum = `STMT-${Date.now().toString().slice(-6)}`;

      // 1. Create Sale Record
      const basePayload = {
        tenant_id: tenant.id,
        sale_number: saleNum,
        agent_id: activeAgentId,
        truck_id: truck.id,
        micro_store_id: selectedStore.id,
        subtotal: cartTotal,
        total: netTotalPayable,
      };

      const fullPayload = {
        ...basePayload,
        bottle_pundo_amount: bottlePundoCharge,
        case_pundo_amount: casePundoCharge,
        payment_status: 'PAID',
        delivery_status: 'DELIVERED',
      };

      let sale: any = null;

      let insertRes = await supabase.from('sales').insert([fullPayload]).select().maybeSingle();
      if (insertRes.error || !insertRes.data) {
        insertRes = await supabase.from('sales').insert([basePayload]).select().maybeSingle();
        if (insertRes.error || !insertRes.data) throw (insertRes.error || new Error('Sale insertion failed'));
      }
      sale = insertRes.data;

      // 2. Insert Delivered Sale Items
      if (sale?.id) {
        for (const [prodId, val] of cart.entries()) {
          try {
            await supabase.from('sale_items').insert([
              {
                sale_id: sale.id,
                product_id: prodId,
                quantity: val.qtyCases,
                unit_price: val.casePrice,
                subtotal: val.qtyCases * val.casePrice,
                unit: 'case',
              },
            ]);
          } catch (itemErr) {
            console.warn('sale_items insert ignored if table missing:', itemErr);
          }
        }
      }

      // 3. Deduct Truck Inventory Balance (Full Cases)
      for (const [prodId, val] of cart.entries()) {
        const bal = truckBalances.find((b) => b.product_id === prodId);
        if (bal) {
          await supabase
            .from('inventory_balances')
            .update({ quantity: Math.max(0, Number(bal.quantity) - val.qtyCases) })
            .eq('id', bal.id);
        }
      }

      // 4. Record PUNDO Ledger Entries for Lacking Container Charges
      if (bottleItem && lackingBottles > 0) {
        const { data: latestEntry } = await supabase
          .from('pundo_ledger')
          .select('balance_quantity')
          .eq('tenant_id', tenant.id)
          .eq('micro_store_id', selectedStore.id)
          .eq('returnable_item_id', bottleItem.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const prevBal = Number(latestEntry?.balance_quantity || 0);
        const newBal = prevBal + lackingBottles;
        const newVal = newBal * bottlePundoRate;

        await supabase.from('pundo_ledger').insert([
          {
            tenant_id: tenant.id,
            micro_store_id: selectedStore.id,
            returnable_item_id: bottleItem.id,
            transaction_type: 'DELIVERED_CONTAINER',
            quantity_change: lackingBottles,
            pundo_rate: bottlePundoRate,
            balance_quantity: newBal,
            balance_value: newVal,
            reference_id: sale.id,
          },
        ]);
      }

      if (plasticCaseItem && lackingCases > 0) {
        const { data: latestCaseEntry } = await supabase
          .from('pundo_ledger')
          .select('balance_quantity')
          .eq('tenant_id', tenant.id)
          .eq('micro_store_id', selectedStore.id)
          .eq('returnable_item_id', plasticCaseItem.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const prevBal = Number(latestCaseEntry?.balance_quantity || 0);
        const newBal = prevBal + lackingCases;
        const newVal = newBal * casePundoRate;

        await supabase.from('pundo_ledger').insert([
          {
            tenant_id: tenant.id,
            micro_store_id: selectedStore.id,
            returnable_item_id: plasticCaseItem.id,
            transaction_type: 'DELIVERED_CONTAINER',
            quantity_change: lackingCases,
            pundo_rate: casePundoRate,
            balance_quantity: newBal,
            balance_value: newVal,
            reference_id: sale.id,
          },
        ]);
      }

      // 5. Record Returned Empties in PUNDO Ledger & Update Truck Empties Inventory
      for (const { item: retItem, returnedQty } of returnsMap.values()) {
        if (returnedQty > 0) {
          const rate = Number(retItem.deposit_rate || retItem.pundo_value || 0);

          const { data: latestRetEntry } = await supabase
            .from('pundo_ledger')
            .select('balance_quantity')
            .eq('tenant_id', tenant.id)
            .eq('micro_store_id', selectedStore.id)
            .eq('returnable_item_id', retItem.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const prevBal = Number(latestRetEntry?.balance_quantity || 0);
          const newBal = Math.max(0, prevBal - returnedQty);
          const newVal = newBal * rate;

          await supabase.from('pundo_ledger').insert([
            {
              tenant_id: tenant.id,
              micro_store_id: selectedStore.id,
              returnable_item_id: retItem.id,
              transaction_type: 'RETURNED_EMPTY',
              quantity_change: -returnedQty,
              pundo_rate: rate,
              balance_quantity: newBal,
              balance_value: newVal,
              reference_id: sale.id,
            },
          ]);

          if (truck.location_id) {
            const { data: existingTrkBal } = await supabase
              .from('returnable_balances')
              .select('id, quantity')
              .eq('tenant_id', tenant.id)
              .eq('location_id', truck.location_id)
              .eq('returnable_item_id', retItem.id)
              .limit(1)
              .maybeSingle();

            if (existingTrkBal) {
              await supabase
                .from('returnable_balances')
                .update({
                  quantity: Number(existingTrkBal.quantity || 0) + Number(returnedQty),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingTrkBal.id);
            } else {
              await supabase.from('returnable_balances').insert([
                {
                  tenant_id: tenant.id,
                  location_id: truck.location_id,
                  returnable_item_id: retItem.id,
                  quantity: Number(returnedQty),
                },
              ]);
            }
          }
        }
      }

      setSaleRecord(sale);
      setIsPreviewModalOpen(true);
    } catch (err: any) {
      console.error('Delivery submission error:', err);
      setErrorMsg(err.message || 'Delivery confirmation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-md mx-auto pb-20">
      {/* Header Wizard Indicator */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <ShoppingBag className="w-5 h-5 text-indigo-400" />
          <h1 className="text-lg font-extrabold text-white">
            New Delivery <span className="text-xs text-slate-400 font-normal">Step {step} of 4</span>
          </h1>
        </div>
        <div className="flex space-x-1.5">
          {[1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`w-5 h-1.5 rounded-full transition-all ${
                i <= step ? 'bg-indigo-500' : 'bg-slate-800'
              }`}
            />
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl text-xs font-semibold flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Select Micro Store Destination</h2>
          {stores.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs bg-slate-900 border border-slate-800 rounded-2xl">
              No micro stores found in route directory.
            </div>
          ) : (
            <div className="space-y-2.5">
              {stores.map((s) => (
                <div
                  key={s.id}
                  onClick={() => {
                    setSelectedStore(s);
                    setStep(2);
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    selectedStore?.id === s.id
                      ? 'bg-indigo-600/10 border-indigo-500 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <h3 className="font-extrabold text-base text-white">{s.store_name}</h3>
                    <p className="text-xs text-slate-400">Code: <span className="font-mono text-indigo-300">{s.store_code}</span> • Owner: {s.owner_name || 'N/A'}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-500" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 uppercase font-mono block text-[10px]">SELECTED STORE</span>
              <strong className="text-white text-sm">{selectedStore?.store_name}</strong>
            </div>
            <button onClick={() => setStep(1)} className="text-indigo-400 hover:underline">Change</button>
          </div>

          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Select Product Cases to Deliver</h2>

          {truckBalances.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs bg-slate-900 border border-slate-800 rounded-2xl">
              No product stock loaded on truck. Transfer cases from main warehouse first.
            </div>
          ) : (
            <div className="space-y-3">
              {truckBalances.map((bal) => {
                const prod = bal.products;
                const pkg = prod?.product_packaging?.[0];
                const units = Number(pkg?.units_per_package || pkg?.units_per_case || 24);
                const inCart = cart.get(prod.id);
                const currentQty = inCart ? inCart.qtyCases : 0;
                const maxStock = Number(bal.quantity || 0);

                return (
                  <div key={bal.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-base">{prod?.name}</h4>
                      <p className="text-xs text-slate-400">
                        Available: <strong className="text-emerald-400 font-mono">{maxStock} cases</strong> (1 case = {units} btls)
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 bg-slate-950 px-2 py-1.5 rounded-2xl border border-slate-800">
                      <button
                        onClick={() => updateCartQty(bal, -1)}
                        className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center font-bold shrink-0 active:scale-95"
                      >
                        <Minus className="w-4 h-4" />
                      </button>

                      <input
                        type="number"
                        min="0"
                        max={maxStock}
                        value={currentQty === 0 ? '' : currentQty}
                        placeholder="0"
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setCartQtyDirect(bal, isNaN(val) ? 0 : val);
                        }}
                        className="w-14 text-center font-extrabold text-lg text-white font-mono bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg py-1 border border-slate-800"
                      />

                      <button
                        onClick={() => updateCartQty(bal, 1)}
                        className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0 active:scale-95"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Delivered Cases: <strong className="text-white">{totalDeliveredCases} cases</strong></span>
              <span>Calculated Bottles: <strong className="text-indigo-400">{totalDeliveredBottles} btls</strong></span>
            </div>
            <div className="flex justify-between text-base font-black text-white pt-2 border-t border-slate-800">
              <span>Product Case Subtotal:</span>
              <span className="text-emerald-400 font-mono">₱{cartTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex space-x-3 pt-2">
            <button onClick={() => setStep(1)} className="w-1/3 py-4 rounded-2xl bg-slate-800 text-slate-300 font-bold text-sm">Back</button>
            <button
              disabled={cart.size === 0}
              onClick={prepareReturnablesStep}
              className="w-2/3 py-4 rounded-2xl bg-indigo-600 disabled:opacity-40 text-white font-bold text-base flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/30"
            >
              <span>Next: Record Returns</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-indigo-950/60 border border-indigo-800/60 p-4 rounded-2xl text-xs space-y-1.5">
            <div className="flex justify-between font-bold text-indigo-200">
              <span>Required 1:1 Bottle Return:</span>
              <span className="font-mono text-indigo-300 text-sm">{totalDeliveredBottles} bottles</span>
            </div>
            <div className="flex justify-between font-bold text-indigo-200">
              <span>Required 1:1 Shell Case Return:</span>
              <span className="font-mono text-cyan-300 text-sm">{totalDeliveredCases} cases</span>
            </div>
            <p className="text-[10px] text-slate-400 pt-1 border-t border-indigo-800/40">
              💡 Customer pays <strong>₱0.00 PUNDO Deposit</strong> if all required empties are returned! Charges only apply if empties are lacking.
            </p>
          </div>

          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Record Actual Empties Returned by Store</h2>

          <div className="space-y-3">
            {Array.from(returnsMap.values()).map(({ item, returnedQty }) => (
              <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white text-base">{item.name}</h4>
                    <p className="text-xs text-slate-400">
                      Deposit Rate: <strong className="text-amber-400 font-mono">₱{Number(item.deposit_rate || item.pundo_value || 0).toFixed(2)}</strong> / {item.unit}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 uppercase">
                    {item.item_type || item.type}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <span className="text-xs text-slate-400">Returned Count:</span>

                  <div className="flex items-center space-x-2 bg-slate-950 px-2 py-1.5 rounded-2xl border border-slate-800">
                    <button
                      onClick={() => updateReturnedQty(item.id, -1)}
                      className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center font-bold shrink-0 active:scale-95"
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <input
                      type="number"
                      min="0"
                      value={returnedQty === 0 ? '' : returnedQty}
                      placeholder="0"
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setReturnedQtyDirect(item.id, isNaN(val) ? 0 : val);
                      }}
                      className="w-16 text-center font-extrabold text-lg text-white font-mono bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg py-1 border border-slate-800"
                    />

                    <button
                      onClick={() => updateReturnedQty(item.id, 1)}
                      className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0 active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex space-x-3 pt-2">
            <button onClick={() => setStep(2)} className="w-1/3 py-4 rounded-2xl bg-slate-800 text-slate-300 font-bold text-sm">Back</button>
            <button
              onClick={() => setStep(4)}
              className="w-2/3 py-4 rounded-2xl bg-indigo-600 text-white font-bold text-base flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/30"
            >
              <span>Next: Review & Confirm</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Final Delivery & PUNDO Review</h2>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <p className="text-xs text-slate-400 font-bold">Store Account</p>
                <h3 className="text-lg font-black text-white">{selectedStore?.store_name}</h3>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                DELIVERY STATEMENT
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Products Delivered:</span>
                <span className="font-bold text-white">{totalDeliveredCases} cases ({totalDeliveredBottles} btls)</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Beverage Liquid Subtotal:</span>
                <span className="font-mono text-emerald-400 font-bold">₱{cartTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Container Exchange Status Banner */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs uppercase">
                <Coins className="w-4 h-4" />
                <span>Container Exchange & PUNDO Summary</span>
              </div>

              {lackingBottles === 0 && lackingCases === 0 ? (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center space-x-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span><strong>Full 1:1 Empties Returned!</strong> No container PUNDO deposit charge applied.</span>
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  {lackingBottles > 0 && (
                    <div className="flex justify-between text-amber-300 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                      <span>Lacking {lackingBottles} bottles @ ₱{bottlePundoRate.toFixed(2)}:</span>
                      <span className="font-mono font-bold">+₱{bottlePundoCharge.toFixed(2)}</span>
                    </div>
                  )}
                  {lackingCases > 0 && (
                    <div className="flex justify-between text-cyan-300 bg-cyan-500/10 p-2 rounded-lg border border-cyan-500/20">
                      <span>Lacking {lackingCases} cases @ ₱{casePundoRate.toFixed(2)}:</span>
                      <span className="font-mono font-bold">+₱{casePundoCharge.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {extraEmptiesCredit > 0 && (
                <div className="flex justify-between text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 text-xs">
                  <span>Extra Empties Returned Credit:</span>
                  <span className="font-mono font-bold">-₱{extraEmptiesCredit.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-sm font-bold">
                <span className="text-slate-200">Total Net Amount Due:</span>
                <span className="font-mono text-amber-300 text-lg font-black">₱{netTotalPayable.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="flex space-x-3">
            <button onClick={() => setStep(3)} className="w-1/3 py-4 rounded-2xl bg-slate-800 text-slate-300 font-bold text-sm">Back</button>
            <button
              disabled={submitting}
              onClick={handleConfirmDelivery}
              className="w-2/3 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-base shadow-lg shadow-emerald-500/30 touch-target flex items-center justify-center space-x-2"
            >
              <FileText className="w-5 h-5" />
              <span>{submitting ? 'Saving...' : 'CONFIRM & SAVE DELIVERY'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Printable Billing Statement Preview Modal */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl text-slate-100 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
                <h3 className="font-extrabold text-base text-white">Delivery Recorded Successfully!</h3>
              </div>
              <button
                onClick={() => {
                  setIsPreviewModalOpen(false);
                  setStep(1);
                  setCart(new Map());
                  setSelectedStore(null);
                  fetchDeliveryData();
                }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Official Printable Billing Statement Document */}
            <div className="bg-white text-black p-5 rounded-2xl space-y-4 font-sans text-xs border border-slate-300 shadow-inner">
              {/* Distributor Header */}
              <div className="text-center border-b border-slate-300 pb-3">
                <h2 className="text-base font-black uppercase tracking-tight text-slate-900">{tenant?.name || 'BEVERAGE DISTRIBUTION SYSTEM'}</h2>
                <p className="text-[10px] text-slate-600 font-medium">Official Delivery & Container PUNDO Billing Statement</p>
                <span className="inline-block mt-1 text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-200 rounded text-slate-700">
                  * STATEMENT OF ACCOUNT (NOT AN OFFICIAL RECEIPT) *
                </span>
              </div>

              {/* Statement Details */}
              <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block uppercase font-bold text-[8px]">CUSTOMER STORE</span>
                  <span className="font-extrabold text-black block text-xs">{selectedStore?.store_name}</span>
                  <span className="text-slate-600 font-mono">Code: {selectedStore?.store_code}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block uppercase font-bold text-[8px]">STATEMENT REF</span>
                  <span className="font-mono font-bold text-indigo-950 text-xs block">{saleRecord?.sale_number || `STMT-${Date.now().toString().slice(-6)}`}</span>
                  <span className="text-slate-600">{new Date().toLocaleDateString()}</span>
                </div>
              </div>

              {/* Delivered Products Table */}
              <div>
                <h4 className="font-black text-[9px] uppercase tracking-wider text-slate-700 mb-1">1. Delivered Beverage Products</h4>
                <table className="w-full text-left text-[10px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 text-slate-600 font-bold uppercase text-[8px]">
                      <th className="py-1">Product Item</th>
                      <th className="py-1 text-center">Cases</th>
                      <th className="py-1 text-right">Price</th>
                      <th className="py-1 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {Array.from(cart.values()).map((c, i) => (
                      <tr key={i}>
                        <td className="py-1 font-semibold">{c.product.name} ({c.unitsPerCase} btls/cs)</td>
                        <td className="py-1 text-center font-mono font-bold">{c.qtyCases} cs</td>
                        <td className="py-1 text-right font-mono">₱{c.casePrice.toFixed(2)}</td>
                        <td className="py-1 text-right font-mono font-bold">₱{(c.qtyCases * c.casePrice).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Empties Returned Table */}
              {returnedItemsList.length > 0 && (
                <div>
                  <h4 className="font-black text-[9px] uppercase tracking-wider text-cyan-800 mb-1">2. Empties Returned Summary</h4>
                  <table className="w-full text-left text-[10px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-300 text-slate-600 font-bold uppercase text-[8px]">
                        <th className="py-1">Container Returned</th>
                        <th className="py-1 text-center">Qty</th>
                        <th className="py-1 text-right">Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {returnedItemsList.map((r, i) => (
                        <tr key={i}>
                          <td className="py-1 font-semibold">{r.item.name}</td>
                          <td className="py-1 text-center font-mono font-bold">{r.returnedQty} {r.item.unit}</td>
                          <td className="py-1 text-right font-mono font-bold text-slate-700">₱{r.rate.toFixed(2)} / {r.item.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Container Exchange & PUNDO Deposit Penalty */}
              <div>
                <h4 className="font-black text-[9px] uppercase tracking-wider text-amber-800 mb-1">3. Container Exchange & Lacking PUNDO Charges</h4>
                <div className="space-y-1 text-[10px] bg-slate-100 p-2.5 rounded-xl border border-slate-300">
                  {lackingBottles === 0 && lackingCases === 0 ? (
                    <div className="text-emerald-700 font-bold">
                      ✓ Full 1:1 Empties Returned! ₱0.00 Container Deposit Penalty.
                    </div>
                  ) : (
                    <>
                      {lackingBottles > 0 && (
                        <div className="flex justify-between text-amber-900 font-medium">
                          <span>Lacking {lackingBottles} bottles @ ₱{bottlePundoRate.toFixed(2)}:</span>
                          <span className="font-mono font-bold">+₱{bottlePundoCharge.toFixed(2)}</span>
                        </div>
                      )}
                      {lackingCases > 0 && (
                        <div className="flex justify-between text-amber-900 font-medium">
                          <span>Lacking {lackingCases} plastic cases @ ₱{casePundoRate.toFixed(2)}:</span>
                          <span className="font-mono font-bold">+₱{casePundoCharge.toFixed(2)}</span>
                        </div>
                      )}
                    </>
                  )}
                  {extraEmptiesCredit > 0 && (
                    <div className="flex justify-between text-emerald-700 font-bold border-t border-slate-300 pt-1">
                      <span>Extra Empties Credit:</span>
                      <span className="font-mono">-₱{extraEmptiesCredit.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Net Amount Summary */}
              <div className="border-t-2 border-slate-900 pt-2 space-y-1 text-[11px] font-bold">
                <div className="flex justify-between text-slate-700">
                  <span>Product Sales Subtotal:</span>
                  <span className="font-mono">₱{cartTotal.toFixed(2)}</span>
                </div>
                {netPundoDepositDue > 0 && (
                  <div className="flex justify-between text-amber-800">
                    <span>Lacking Container Deposit Charge:</span>
                    <span className="font-mono">+₱{netPundoDepositDue.toFixed(2)}</span>
                  </div>
                )}
                {extraEmptiesCredit > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Surplus Empties Credit:</span>
                    <span className="font-mono">-₱{extraEmptiesCredit.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-black text-slate-950 pt-1 border-t border-slate-400">
                  <span>NET TOTAL PAYABLE DUE:</span>
                  <span className="font-mono text-indigo-950">₱{netTotalPayable.toFixed(2)}</span>
                </div>
              </div>

              {/* Signature Blocks */}
              <div className="pt-4 grid grid-cols-2 gap-4 text-[9px] text-center text-slate-600">
                <div className="border-t border-slate-400 pt-1">
                  <span>Received By (Store Representative)</span>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <span>Delivered By (Route Agent)</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => {
                  setIsPreviewModalOpen(false);
                  setStep(1);
                  setCart(new Map());
                  setSelectedStore(null);
                  fetchDeliveryData();
                }}
                className="w-1/2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
              >
                Close & Return
              </button>

              <button
                onClick={() => window.print()}
                className="w-1/2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2"
              >
                <Printer className="w-4 h-4" />
                <span>Print Billing Statement</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
