import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { useModal } from '../../context/ModalContext';
import { CheckSquare, Package, RotateCcw, Clock, ShieldCheck, PackageX, RefreshCw, CheckCircle2, ShoppingBag, PlusCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';

const BRAND_GROUPS = [
  { key: 'san_miguel', patterns: ['san miguel', 'smb', 'san mig', 'pale pilsen', 'super dry', 'cerveza negra', 'san mig light', 'miguel'] },
  { key: 'red_horse', patterns: ['red horse', 'rh 1l', 'rh1l', 'extra strong', 'redhorse', 'rh'] },
  { key: 'rc_cola', patterns: ['rc cola', 'rc', 'royal crown'] },
  { key: 'coke', patterns: ['coca cola', 'coca-cola', 'coke', 'coke zero', 'sprite', 'royal'] },
  { key: 'pepsi', patterns: ['pepsi', 'mountain dew', 'mirinda', '7up'] },
  { key: 'ginebra', patterns: ['ginebra', 'gsm', 'san miguel ginebra'] },
  { key: 'emperador', patterns: ['emperador', 'empe'] },
  { key: 'tanduay', patterns: ['tanduay', 't5'] },
  { key: 'heineken', patterns: ['heineken'] },
  { key: 'corona', patterns: ['corona'] },
];

const getBrandKey = (text: string): string | null => {
  const lower = (text || '').toLowerCase().trim();
  for (const group of BRAND_GROUPS) {
    for (const pat of group.patterns) {
      if (lower.includes(pat)) {
        return group.key;
      }
    }
  }
  return null;
};

export const AgentReconciliation: React.FC = () => {
  const { tenant } = useTenant();
  const { profile } = useAuth();
  const { showError, confirm } = useModal();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pendingTransfer, setPendingTransfer] = useState<any | null>(null);
  const [completedTransfer, setCompletedTransfer] = useState<any | null>(null);

  const [truck, setTruck] = useState<any | null>(null);
  const [warehouseLocationId, setWarehouseLocationId] = useState<string | null>(null);

  // Unsold Full Cases on Truck
  const [productReconcileItems, setProductReconcileItems] = useState<any[]>([]);

  // Collected Empties (Bottles & Cases) on Truck
  const [emptyReconcileItems, setEmptyReconcileItems] = useState<any[]>([]);

  const [routeRemittanceTotal, setRouteRemittanceTotal] = useState(0);
  const [routeDispatchedCases, setRouteDispatchedCases] = useState(0);

  const fetchReconcileData = async () => {
    if (!tenant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [whRes] = await Promise.all([
        supabase
          .from('locations')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('type', 'WAREHOUSE')
          .limit(1)
          .maybeSingle(),
      ]);

      const whLoc = whRes.data;
      setWarehouseLocationId(whLoc?.id || null);

      let targetTruck: any = null;

      if (profile?.id) {
        const { data: agData } = await supabase
          .from('agents')
          .select('*, trucks(*)')
          .eq('tenant_id', tenant.id)
          .eq('user_id', profile.id)
          .limit(1)
          .maybeSingle();

        if (agData?.trucks) {
          targetTruck = agData.trucks;
        } else if (agData?.assigned_truck_id) {
          const { data: trk } = await supabase
            .from('trucks')
            .select('*')
            .eq('id', agData.assigned_truck_id)
            .maybeSingle();
          targetTruck = trk;
        }
      }

      if (!targetTruck) {
        const { data: firstTrk } = await supabase
          .from('trucks')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('truck_code')
          .limit(1)
          .maybeSingle();
        targetTruck = firstTrk;
      }

      const trk = targetTruck;

      if (trk && trk.location_id) {
        setTruck(trk);

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // Fetch the absolute most recent EOD offload transfer for this truck
        const [latestEodRes, todaySalesRes, trfTodayRes, prodBalsRes, catRetsRes, retBalsRes] = await Promise.all([
          supabase
            .from('stock_transfers')
            .select('*, stock_transfer_items(*, products(name, sku), returnable_items(name, item_type, unit))')
            .eq('tenant_id', tenant.id)
            .eq('from_location_id', trk.location_id)
            .eq('transfer_type', 'TRUCK_OFFLOAD_EOD')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('sales')
            .select('id, created_at, total, sale_items(*)')
            .eq('tenant_id', tenant.id)
            .eq('truck_id', trk.id)
            .gte('created_at', todayStart.toISOString()),
          supabase
            .from('stock_transfers')
            .select('id, created_at')
            .eq('tenant_id', tenant.id)
            .eq('to_location_id', trk.location_id)
            .eq('transfer_type', 'WAREHOUSE_TO_TRUCK')
            .gte('created_at', todayStart.toISOString()),
          supabase
            .from('inventory_balances')
            .select('*, products(*, product_packaging(*))')
            .eq('location_id', trk.location_id),
          supabase.from('returnable_items').select('*').eq('tenant_id', tenant.id),
          supabase
            .from('returnable_balances')
            .select('*, returnable_items(*)')
            .eq('location_id', trk.location_id),
        ]);

        const latestEodTransfer = latestEodRes.data;
        const prodBals = prodBalsRes.data || [];
        const retBals = retBalsRes.data || [];
        const hasActiveStock = prodBals.some((b) => Number(b.quantity || 0) > 0) || retBals.some((b) => Number(b.quantity || 0) > 0);

        if (latestEodTransfer) {
          if (['PENDING', 'PENDING_APPROVAL', 'IN_TRANSIT', 'REQUESTED'].includes(latestEodTransfer.status)) {
            setPendingTransfer(latestEodTransfer);
            setCompletedTransfer(null);
          } else if (latestEodTransfer.status === 'COMPLETED') {
            setPendingTransfer(null);
            // If the truck already has new active stock loaded, don't lock them behind the old completed screen
            if (hasActiveStock) {
              setCompletedTransfer(null);
            } else {
              setCompletedTransfer(latestEodTransfer);
            }
          } else {
            setPendingTransfer(null);
            setCompletedTransfer(null);
          }
        } else {
          setPendingTransfer(null);
          setCompletedTransfer(null);
        }

        let remTotal = 0;
        let totalSoldCasesToday = 0;
        (todaySalesRes.data || []).forEach((s: any) => {
          remTotal += Number(s.total || 0);
          (s.sale_items || []).forEach((si: any) => {
            totalSoldCasesToday += Number(si.quantity || 0);
          });
        });
        setRouteRemittanceTotal(remTotal);

        const trfToday = trfTodayRes.data;
        let transferCasesToday = 0;
        if (trfToday && trfToday.length > 0) {
          const trfIds = trfToday.map((t) => t.id);
          const { data: trfItems } = await supabase
            .from('stock_transfer_items')
            .select('quantity')
            .in('stock_transfer_id', trfIds);

          trfItems?.forEach((i) => (transferCasesToday += Number(i.quantity || 0)));
        }

        let currentTruckCases = 0;
        prodBals.forEach((b) => (currentTruckCases += Number(b.quantity || 0)));

        const trueDispatchedCases = Math.max(transferCasesToday, currentTruckCases + totalSoldCasesToday);
        setRouteDispatchedCases(trueDispatchedCases);

        const prodItems = prodBals
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

        const catRets = catRetsRes.data || [];
        const emptyItemsMap = new Map<string, any>();

        // 1. Add any containers currently on the truck with positive balance
        (retBals || []).forEach((b) => {
          const qty = Number(b.quantity || 0);
          if (qty > 0) {
            const matched = b.returnable_items || catRets.find((r) => r.id === b.returnable_item_id);
            emptyItemsMap.set(b.returnable_item_id, {
              balance_id: b.id,
              returnable_item_id: b.returnable_item_id,
              name: matched?.name || b.returnable_items?.name || 'Returnable Container',
              item_type: matched?.item_type || matched?.type || 'CONTAINER',
              unit: matched?.unit || 'pc',
              expected_qty: qty,
              actual_qty: qty,
              variance: 0,
            });
          }
        });

        // 2. Add containers associated with the products currently on the truck or sold today
        for (const b of prodBals) {
          const prod = b.products;
          if (!prod) continue;
          const pkg = prod.product_packaging?.[0];
          const isRet = pkg ? (pkg.is_returnable !== false) : true;
          if (!isRet) continue;

          const prodName = (prod.name || '').trim();
          const prodBrand = getBrandKey(prodName);

          const matchedBottle = catRets.find(
            (r) => (r.item_type === 'BOTTLE' || r.type === 'BOTTLE') &&
                   (r.product_id === prod.id || (prodBrand && getBrandKey(r.name) === prodBrand) || r.name.toLowerCase().includes(prodName.toLowerCase()))
          );

          const matchedCase = catRets.find(
            (r) => (r.item_type === 'CASE' || r.type === 'CASE') &&
                   (r.product_id === prod.id || (prodBrand && getBrandKey(r.name) === prodBrand) || r.name.toLowerCase().includes(prodName.toLowerCase()))
          );

          if (matchedBottle && !emptyItemsMap.has(matchedBottle.id)) {
            const trkBal = retBals.find((rb) => rb.returnable_item_id === matchedBottle.id);
            const expQty = Number(trkBal?.quantity || 0);
            emptyItemsMap.set(matchedBottle.id, {
              balance_id: trkBal?.id || null,
              returnable_item_id: matchedBottle.id,
              name: matchedBottle.name,
              item_type: matchedBottle.item_type || matchedBottle.type || 'BOTTLE',
              unit: matchedBottle.unit || 'bottle',
              expected_qty: expQty,
              actual_qty: expQty,
              variance: 0,
            });
          }

          if (matchedCase && !emptyItemsMap.has(matchedCase.id)) {
            const trkBal = retBals.find((rb) => rb.returnable_item_id === matchedCase.id);
            const expQty = Number(trkBal?.quantity || 0);
            emptyItemsMap.set(matchedCase.id, {
              balance_id: trkBal?.id || null,
              returnable_item_id: matchedCase.id,
              name: matchedCase.name,
              item_type: matchedCase.item_type || matchedCase.type || 'CASE',
              unit: matchedCase.unit || 'case',
              expected_qty: expQty,
              actual_qty: expQty,
              variance: 0,
            });
          }
        }

        setEmptyReconcileItems(Array.from(emptyItemsMap.values()));
      }
    } catch (err) {
      console.error('Error loading reconciliation data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReconcileData();
  }, [tenant, profile]);

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
    if (pendingTransfer) {
      showError({
        title: 'Pending Request Active',
        description: 'You already have an End-of-Day reconciliation request waiting for warehouse verification and approval.',
      });
      return;
    }

    if (!tenant || !truck || !truck.location_id) return;

    const ok = await confirm({
      title: 'Submit Route Reconciliation',
      description: 'Are you sure you want to submit your route reconciliation and generate an End-of-Day return voucher to the warehouse?',
      confirmText: 'Submit Reconciliation',
    });
    if (!ok) return;

    setSubmitting(true);

    try {
      const recNum = `REC-${Date.now().toString().slice(-6)}`;
      const transferNum = `TRF-EOD-${Date.now().toString().slice(-6)}`;

      let activeAgentId = profile?.id;
      const { data: agt } = await supabase
        .from('agents')
        .select('id')
        .eq('tenant_id', tenant.id)
        .limit(1)
        .maybeSingle();
      activeAgentId = agt?.id || profile?.id;

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

      if (transferRecord?.id) {
        const transferItemsPayload: any[] = [];

        for (const pItem of productReconcileItems) {
          if (pItem.actual_qty > 0) {
            transferItemsPayload.push({
              stock_transfer_id: transferRecord.id,
              product_id: pItem.product_id,
              returnable_item_id: null,
              item_type: 'PRODUCT',
              quantity: pItem.actual_qty,
              unit: 'case',
            });
          }

          if (newRec?.id) {
            try {
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
            } catch (recErr) {
              console.warn('reconciliation_items insert ignored if table missing:', recErr);
            }
          }
        }

        for (const eItem of emptyReconcileItems) {
          if (eItem.actual_qty > 0) {
            transferItemsPayload.push({
              stock_transfer_id: transferRecord.id,
              product_id: null,
              returnable_item_id: eItem.returnable_item_id,
              item_type: 'CONTAINER',
              quantity: eItem.actual_qty,
              unit: eItem.unit || 'pc',
            });
          }
        }

        if (transferItemsPayload.length > 0) {
          const { error: itemsInsErr } = await supabase
            .from('stock_transfer_items')
            .insert(transferItemsPayload);

          if (itemsInsErr) {
            console.warn('Batch insert warning, executing fallback item-by-item insertion:', itemsInsErr);
            const fallbackProdId = productReconcileItems[0]?.product_id || null;

            for (const itemPayload of transferItemsPayload) {
              const res = await supabase.from('stock_transfer_items').insert([itemPayload]);
              if (res.error && res.error.code === '23502') {
                await supabase.from('stock_transfer_items').insert([
                  {
                    ...itemPayload,
                    product_id: fallbackProdId,
                  },
                ]);
              }
            }
          }
        }
      }

      await fetchReconcileData();
    } catch (err: any) {
      console.error('Reconciliation failed:', err);
      showError({
        title: 'Reconciliation Failed',
        description: err.message || 'Failed to submit route reconciliation.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isTruckEmptyToReconcile = productReconcileItems.length === 0 && emptyReconcileItems.length === 0;

  // 1. Render Completed Transfer State if the latest EOD transfer is completed
  if (completedTransfer) {
    const transferItems = completedTransfer.stock_transfer_items || [];
    const transferNum = completedTransfer.transfer_number;
    const completedAt = completedTransfer.updated_at
      ? new Date(completedTransfer.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'Today';

    return (
      <div className="space-y-6 max-w-md mx-auto pb-20">
        <div className="border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-zinc-700" />
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">
              Daily Truck Reconciliation
            </h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1">End-of-Day reconciliation status</p>
        </div>

        <Card className="border-emerald-200 bg-emerald-50/20 shadow-sm">
          <CardHeader className="pb-3 text-center">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <CardTitle className="text-lg font-bold text-zinc-900">
              Reconciliation Completed & Verified
            </CardTitle>
            <CardDescription className="text-xs text-emerald-900/80 font-medium">
              Your End-of-Day transfer has been approved and verified by the warehouse. Your truck inventory has been offloaded.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm space-y-2.5 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
                <span className="text-zinc-500 font-medium">Voucher #</span>
                <span className="font-mono font-bold text-zinc-900">{transferNum}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
                <span className="text-zinc-500 font-medium">Verified At</span>
                <span className="font-medium text-zinc-700">{completedAt}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
                <span className="text-zinc-500 font-medium">Status</span>
                <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[10px]">
                  ✓ Completed & Offloaded
                </Badge>
              </div>

              {completedTransfer.actual_cash_remitted != null && (
                <div className="p-2.5 bg-emerald-50/60 rounded-lg border border-emerald-200/50">
                  <div className="text-[10px] text-emerald-900 uppercase font-semibold">Remittance Verified:</div>
                  <div className="text-base font-bold text-emerald-950 font-mono">
                    ₱{Number(completedTransfer.actual_cash_remitted || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              )}

              {transferItems.length > 0 && (
                <div className="pt-1">
                  <div className="text-[10px] uppercase font-bold text-zinc-500 mb-1.5">Offloaded Items:</div>
                  <div className="space-y-1">
                    {transferItems.map((ti: any, idx: number) => {
                      const itemName = ti.products?.name || ti.returnable_items?.name || (ti.item_type === 'CONTAINER' ? 'Empty Container' : 'Product Case');
                      return (
                        <div key={ti.id || idx} className="flex justify-between items-center text-xs py-0.5">
                          <span className="text-zinc-700 truncate max-w-[200px]">{itemName}</span>
                          <span className="font-mono font-semibold text-zinc-900">
                            {ti.quantity} {ti.unit || (ti.item_type === 'CONTAINER' ? 'pc' : 'case')}s
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-1">
              <Button
                onClick={() => navigate('/agent/deliver')}
                className="w-full gap-2 font-bold h-11"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Start New Delivery / Sale</span>
              </Button>

              <Button
                onClick={() => {
                  setCompletedTransfer(null);
                  fetchReconcileData();
                }}
                variant="outline"
                className="w-full gap-2 border-zinc-300 h-10"
                disabled={loading}
              >
                <PlusCircle className="w-4 h-4" />
                <span>Start New Reconciliation / Load</span>
              </Button>

              <Button
                onClick={() => fetchReconcileData()}
                variant="ghost"
                className="w-full gap-1.5 text-xs text-zinc-500 h-8"
                disabled={loading}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Refreshing...' : 'Refresh Route Status'}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 2. Render Pending Transfer State if agent has an active pending EOD offload
  if (pendingTransfer) {
    const transferItems = pendingTransfer?.stock_transfer_items || [];
    const transferNum = pendingTransfer?.transfer_number || 'TRF-EOD-RECENT';
    const createdAt = pendingTransfer?.created_at ? new Date(pendingTransfer.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today';

    return (
      <div className="space-y-6 max-w-md mx-auto pb-20">
        <div className="border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-zinc-700" />
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">
              Daily Truck Reconciliation
            </h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1">End-of-Day offload and return status</p>
        </div>

        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-3 text-center">
            <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-2">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
            <CardTitle className="text-lg font-bold text-zinc-900">
              Reconciliation Request Pending
            </CardTitle>
            <CardDescription className="text-xs text-amber-900/80 font-medium">
              You have already submitted an End-of-Day offload request. You cannot submit another request until the warehouse approves and completes this transfer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="bg-white p-3.5 rounded-lg border border-amber-200 space-y-2.5 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
                <span className="text-zinc-500 font-medium">Voucher #</span>
                <span className="font-mono font-bold text-zinc-900">{transferNum}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
                <span className="text-zinc-500 font-medium">Submitted At</span>
                <span className="font-medium text-zinc-700">{createdAt}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
                <span className="text-zinc-500 font-medium">Approval Status</span>
                <Badge variant="outline" className="bg-amber-100/60 text-amber-800 border-amber-300 font-semibold text-[10px]">
                  Pending Warehouse Verification
                </Badge>
              </div>

              {routeRemittanceTotal > 0 && (
                <div className="p-2.5 bg-amber-50/80 rounded border border-amber-200/60">
                  <div className="text-[10px] text-amber-900 uppercase font-semibold">Cash Remittance Recorded:</div>
                  <div className="text-base font-bold text-amber-950 font-mono">
                    ₱{routeRemittanceTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-amber-800/80 mt-0.5">
                    Hand over physical cash to the cashier for end-of-day sign-off.
                  </div>
                </div>
              )}

              <div className="pt-1">
                <div className="text-[10px] uppercase font-bold text-zinc-500 mb-1.5">Submitted Offload Summary:</div>
                {transferItems.length > 0 ? (
                  <div className="space-y-1">
                    {transferItems.map((ti: any, idx: number) => {
                      const itemName = ti.products?.name || ti.returnable_items?.name || (ti.item_type === 'CONTAINER' ? 'Empty Container' : 'Product Case');
                      return (
                        <div key={ti.id || idx} className="flex justify-between items-center text-xs py-0.5">
                          <span className="text-zinc-700 truncate max-w-[200px]">{itemName}</span>
                          <span className="font-mono font-semibold text-zinc-900">
                            {ti.quantity} {ti.unit || (ti.item_type === 'CONTAINER' ? 'pc' : 'case')}s
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {productReconcileItems.filter(p => p.actual_qty > 0).map((p) => (
                      <div key={p.product_id} className="flex justify-between text-zinc-800">
                        <span>{p.name}:</span>
                        <span className="font-mono font-semibold">{p.actual_qty} cases</span>
                      </div>
                    ))}
                    {emptyReconcileItems.filter(e => e.actual_qty > 0).map((e) => (
                      <div key={e.returnable_item_id} className="flex justify-between text-zinc-800">
                        <span>{e.name}:</span>
                        <span className="font-mono font-semibold">{e.actual_qty} {e.unit}s</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <Button
              onClick={() => fetchReconcileData()}
              variant="outline"
              className="w-full gap-2 border-zinc-300"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Checking Status...' : 'Check / Refresh Approval Status'}</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-md mx-auto pb-20">
      <div className="border-b border-zinc-200 pb-4">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-zinc-700" />
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">
            Daily Truck Reconciliation
          </h1>
        </div>
        <p className="text-xs text-zinc-500 mt-1">Verify unsold stock and collected empty containers to submit EOD transfer</p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-zinc-400 text-xs">Calculating truck inventory balances...</div>
      ) : isTruckEmptyToReconcile ? (
        <Card className="py-12 px-6 text-center space-y-3">
          <PackageX className="w-10 h-10 text-zinc-400 mx-auto" />
          <CardTitle className="text-lg">Truck is Empty</CardTitle>
          <CardDescription className="text-xs max-w-xs mx-auto">
            No full product cases or collected empty containers on board to reconcile.
          </CardDescription>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Route Cash & Dispatched Load Summary Card */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-semibold uppercase text-zinc-500">
                  Today's Remittance Summary
                </CardDescription>
                <Badge variant="secondary" className="text-[10px]">
                  Live
                </Badge>
              </div>
              <CardTitle className="text-2xl font-bold font-mono text-zinc-900 mt-1">
                ₱{routeRemittanceTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-zinc-500">Total cash collected from store deliveries today</p>
              {routeDispatchedCases > 0 && (
                <div className="flex justify-between items-center text-xs pt-2 mt-2 border-t border-zinc-100">
                  <span className="text-zinc-500">Initial Dispatched:</span>
                  <span className="font-bold text-zinc-900">{routeDispatchedCases} cases</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 1: Unsold Full Product Cases */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 uppercase tracking-wider">
              <Package className="w-4 h-4 text-zinc-600" />
              <span>1. Unsold Full Product Cases on Board</span>
            </div>

            {productReconcileItems.length === 0 ? (
              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg text-center text-xs text-zinc-400">
                No unsold full product cases on board.
              </div>
            ) : (
              productReconcileItems.map((item, idx) => (
                <Card key={item.product_id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-zinc-900 text-base">{item.name}</h4>
                      <span className="text-xs text-zinc-500 font-mono">Expected: <strong className="text-zinc-900">{item.expected_qty} cs</strong></span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-100 items-center">
                      <div>
                        <label className="block text-[10px] uppercase font-semibold text-zinc-500 mb-1">Actual Count</label>
                        <Input
                          type="number"
                          min="0"
                          value={item.actual_qty}
                          onChange={(e) => updateProductActual(idx, parseInt(e.target.value) || 0)}
                          className="font-mono font-bold"
                        />
                      </div>

                      <div className="text-right">
                        <p className="text-[10px] uppercase font-semibold text-zinc-500">Variance</p>
                        <p
                          className={`font-mono text-base font-bold ${
                            item.variance === 0
                              ? 'text-zinc-900'
                              : item.variance < 0
                              ? 'text-red-600'
                              : 'text-zinc-900'
                          }`}
                        >
                          {item.variance > 0 ? `+${item.variance}` : item.variance} cs
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Section 2: Collected Empty Bottles & Cases */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 uppercase tracking-wider">
              <RotateCcw className="w-4 h-4 text-zinc-600" />
              <span>2. Collected Empty Bottles & Cases</span>
            </div>

            {emptyReconcileItems.length === 0 ? (
              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg text-center text-xs text-zinc-400">
                No empty bottles or cases collected on truck.
              </div>
            ) : (
              emptyReconcileItems.map((item, idx) => (
                <Card key={item.returnable_item_id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-zinc-900 text-base">{item.name}</h4>
                        <Badge variant="outline" className="font-mono text-[10px] uppercase mt-0.5">
                          {item.item_type}
                        </Badge>
                      </div>
                      <span className="text-xs text-zinc-500 font-mono">Expected: <strong className="text-zinc-900">{item.expected_qty} {item.unit}s</strong></span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-100 items-center">
                      <div>
                        <label className="block text-[10px] uppercase font-semibold text-zinc-500 mb-1">Actual Count</label>
                        <Input
                          type="number"
                          min="0"
                          value={item.actual_qty}
                          onChange={(e) => updateEmptyActual(idx, parseInt(e.target.value) || 0)}
                          className="font-mono font-bold"
                        />
                      </div>

                      <div className="text-right">
                        <p className="text-[10px] uppercase font-semibold text-zinc-500">Variance</p>
                        <p
                          className={`font-mono text-base font-bold ${
                            item.variance === 0
                              ? 'text-zinc-900'
                              : item.variance < 0
                              ? 'text-red-600'
                              : 'text-zinc-900'
                          }`}
                        >
                          {item.variance > 0 ? `+${item.variance}` : item.variance} {item.unit}s
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <Button
            disabled={submitting}
            onClick={handleConfirmReconciliation}
            className="w-full gap-2 h-12 text-sm font-bold"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{submitting ? 'Submitting Transfer Request...' : 'Submit EOD Offload Transfer'}</span>
          </Button>
        </div>
      )}
    </div>
  );
};
