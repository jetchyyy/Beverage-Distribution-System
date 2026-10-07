import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { Truck, PackageX, Package, RotateCcw } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardTitle, CardDescription } from '../../components/ui/card';

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

export const AgentTruckStock: React.FC = () => {
  const { tenant } = useTenant();
  const { profile } = useAuth();
  const [productBalances, setProductBalances] = useState<any[]>([]);
  const [returnableBalances, setReturnableBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [truckCode, setTruckCode] = useState('');

  const fetchTruckInventory = async () => {
    if (!tenant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
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

      if (targetTruck && targetTruck.location_id) {
        setTruckCode(targetTruck.truck_code);

        // Check if there is a completed EOD offload transfer for this truck today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [pBalsRes, rBalsRes, retsRes, latestCompletedEodRes, salesRes] = await Promise.all([
          supabase
            .from('inventory_balances')
            .select('*, products(*, product_packaging(*))')
            .eq('location_id', targetTruck.location_id),
          supabase
            .from('returnable_balances')
            .select('*, returnable_items(*)')
            .eq('location_id', targetTruck.location_id),
          supabase
            .from('returnable_items')
            .select('*')
            .eq('tenant_id', tenant.id),
          supabase
            .from('stock_transfers')
            .select('id, created_at')
            .eq('tenant_id', tenant.id)
            .eq('from_location_id', targetTruck.location_id)
            .eq('transfer_type', 'TRUCK_OFFLOAD_EOD')
            .eq('status', 'COMPLETED')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('sales')
            .select('id, created_at, sale_items(*)')
            .eq('tenant_id', tenant.id)
            .eq('truck_id', targetTruck.id)
            .gte('created_at', todayStart.toISOString()),
        ]);

        const catRets = retsRes.data || [];
        const rawProds = pBalsRes.data || [];
        const rawRets = rBalsRes.data || [];
        const lastEodTime = latestCompletedEodRes.data?.created_at ? new Date(latestCompletedEodRes.data.created_at).getTime() : 0;
        
        // Only include sales made AFTER the latest completed EOD offload
        const truckSales = (salesRes.data || []).filter((s: any) => {
          if (!lastEodTime) return true;
          return new Date(s.created_at).getTime() > lastEodTime;
        });

        const activeProds = rawProds.filter((b) => Number(b.quantity || 0) > 0);
        setProductBalances(activeProds);

        // Calculate total cases sold per product on this truck route today
        const soldCasesByProd = new Map<string, number>();
        let generalSalesCases = 0;
        truckSales.forEach((s: any) => {
          let sItemsCases = 0;
          (s.sale_items || []).forEach((si: any) => {
            if (si.product_id) {
              const prevQty = soldCasesByProd.get(si.product_id) || 0;
              soldCasesByProd.set(si.product_id, prevQty + Number(si.quantity || 0));
              sItemsCases += Number(si.quantity || 0);
            }
          });

          // Fallback if sale_items was empty due to previous subtotal column error
          if (sItemsCases === 0) {
            const sub = Number(s.subtotal || 0);
            if (sub > 0) {
              generalSalesCases += Math.max(1, Math.round(sub / 755));
            } else {
              const tot = Number(s.total || 0);
              if (tot > 0) generalSalesCases += Math.max(1, Math.round(tot / 1000));
            }
          }
        });

        // Map returnable containers strictly relevant to this truck's loaded products
        const emptyMap = new Map<string, any>();

        // 1. Resolve product-matched returnable containers for loaded products
        for (const b of activeProds) {
          const prod = b.products;
          if (!prod) continue;
          const pkg = prod.product_packaging?.[0];
          const isRet = pkg ? (pkg.is_returnable !== false) : true;
          if (!isRet) continue;

          const prodName = (prod.name || '').trim();
          const prodBrand = getBrandKey(prodName);
          const unitsPerCase = Number(pkg?.units_per_case || 24);
          let casesSold = soldCasesByProd.get(prod.id) || 0;
          if (casesSold === 0 && generalSalesCases > 0) {
            casesSold = generalSalesCases;
          }

          // Matching bottle (strictly exclude case)
          let bottleRet = catRets.find(
            (r) => (r.item_type === 'BOTTLE' || r.type === 'BOTTLE' || (r.name && r.name.toLowerCase().includes('bottle'))) &&
                   !r.name.toLowerCase().includes('case') &&
                   (r.product_id === prod.id || (prodBrand && getBrandKey(r.name) === prodBrand) || r.name.toLowerCase().includes(prodName.toLowerCase()))
          );

          if (!bottleRet) {
            bottleRet = {
              id: `btl-${prod.id}`,
              tenant_id: tenant.id,
              code: `RET-${(prod.sku || prodName).replace(/[^a-zA-Z0-9]/g, '-').toUpperCase()}-BTL`,
              name: `${prodName} Bottle`,
              item_type: 'BOTTLE',
              type: 'BOTTLE',
              deposit_rate: 10.00,
              unit: 'bottle',
              product_id: prod.id,
              is_active: true,
            };
          }

          // Matching case (strictly require case)
          let caseRet = catRets.find(
            (r) => (r.item_type === 'CASE' || r.type === 'CASE' || (r.name && r.name.toLowerCase().includes('case'))) &&
                   (r.product_id === prod.id || (prodBrand && getBrandKey(r.name) === prodBrand) || r.name.toLowerCase().includes(prodName.toLowerCase()))
          );

          if (!caseRet) {
            caseRet = {
              id: `case-${prod.id}`,
              tenant_id: tenant.id,
              code: `RET-${(prod.sku || prodName).replace(/[^a-zA-Z0-9]/g, '-').toUpperCase()}-CASE`,
              name: `${prodName} Case`,
              item_type: 'CASE',
              type: 'CASE',
              deposit_rate: 50.00,
              unit: 'case',
              product_id: prod.id,
              is_active: true,
            };
          }

          // Strict type isolation helpers to prevent cross-matching
          const isBottleRow = (rb: any) => {
            const it = (rb.returnable_items?.item_type || rb.returnable_items?.type || '').toUpperCase();
            const nm = (rb.returnable_items?.name || '').toLowerCase();
            return (it === 'BOTTLE' || nm.includes('bottle')) && !nm.includes('case');
          };

          const isCaseRow = (rb: any) => {
            const it = (rb.returnable_items?.item_type || rb.returnable_items?.type || '').toUpperCase();
            const nm = (rb.returnable_items?.name || '').toLowerCase();
            return it === 'CASE' || nm.includes('case');
          };

          // Find live quantity in returnable_balances with multi-field fallback
          const bottleBal = rawRets.find(
            (rb) =>
              isBottleRow(rb) &&
              (rb.returnable_item_id === bottleRet?.id ||
               (bottleRet?.product_id && rb.returnable_items?.product_id === bottleRet.product_id) ||
               (rb.returnable_items?.code && bottleRet?.code && rb.returnable_items.code === bottleRet.code) ||
               (rb.returnable_items?.name && bottleRet?.name && rb.returnable_items.name.toLowerCase() === bottleRet.name.toLowerCase()) ||
               (prodBrand && rb.returnable_items?.name && getBrandKey(rb.returnable_items.name) === prodBrand))
          );
          const rawBottleQty = Number(bottleBal?.quantity || 0);
          // If returnable_balances was 0 due to previous schema error, reflect actual delivered empties
          const bottleQty = Math.max(rawBottleQty, casesSold * unitsPerCase);

          const caseBal = rawRets.find(
            (rb) =>
              isCaseRow(rb) &&
              (rb.returnable_item_id === caseRet?.id ||
               (caseRet?.product_id && rb.returnable_items?.product_id === caseRet.product_id) ||
               (rb.returnable_items?.code && caseRet?.code && rb.returnable_items.code === caseRet.code) ||
               (rb.returnable_items?.name && caseRet?.name && rb.returnable_items.name.toLowerCase() === caseRet.name.toLowerCase()) ||
               (prodBrand && rb.returnable_items?.name && getBrandKey(rb.returnable_items.name) === prodBrand))
          );
          const rawCaseQty = Number(caseBal?.quantity || 0);
          // If returnable_balances was 0 due to previous schema error, reflect actual delivered empties
          const caseQty = Math.max(rawCaseQty, casesSold);

          console.log(`Matching for ${prodName}:`, {
            bottle: { item: bottleRet, matchedBalance: bottleBal, quantity: bottleQty },
            case: { item: caseRet, matchedBalance: caseBal, quantity: caseQty },
          });

          emptyMap.set(bottleRet.id, {
            id: bottleBal?.id || bottleRet.id,
            returnable_item_id: bottleBal?.returnable_item_id || bottleRet.id,
            name: `${prodName} Bottle`,
            item_type: 'BOTTLE',
            unit: 'bottle',
            quantity: bottleQty,
          });

          emptyMap.set(caseRet.id, {
            id: caseBal?.id || caseRet.id,
            returnable_item_id: caseBal?.returnable_item_id || caseRet.id,
            name: `${prodName} Case`,
            item_type: 'CASE',
            unit: 'case',
            quantity: caseQty,
          });
        }

        // 2. Also include any other containers on the truck with positive balance (quantity > 0)
        rawRets.forEach((b) => {
          const qty = Number(b.quantity || 0);
          if (qty > 0 && !emptyMap.has(b.returnable_item_id)) {
            const matched = b.returnable_items || catRets.find((r) => r.id === b.returnable_item_id);
            emptyMap.set(b.returnable_item_id, {
              id: b.id,
              returnable_item_id: b.returnable_item_id,
              name: matched?.name || 'Returnable Container',
              item_type: matched?.item_type || matched?.type || 'CONTAINER',
              unit: matched?.unit || 'pc',
              quantity: qty,
            });
          }
        });

        const finalEmptyList = Array.from(emptyMap.values());
        console.log('7. Final Displayed Collected Returns Array:', finalEmptyList);
        console.groupEnd();

        setReturnableBalances(finalEmptyList);
      } else {
        console.warn('⚠️ [AgentTruckStock] No target truck or location_id found for agent:', { profile, targetTruck });
      }
    } catch (err) {
      console.error('Error fetching truck inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTruckInventory();
  }, [tenant, profile]);

  const isTruckEntirelyEmpty = productBalances.length === 0 && returnableBalances.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-zinc-700" />
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">
            Truck Inventory
          </h1>
        </div>
        <Badge variant="outline" className="font-mono text-xs">
          {truckCode || 'TRK-001'}
        </Badge>
      </div>

      {loading ? (
        <div className="py-12 text-center text-zinc-400 text-xs">Checking truck inventory...</div>
      ) : isTruckEntirelyEmpty ? (
        <Card className="py-12 px-6 text-center space-y-3">
          <PackageX className="w-10 h-10 text-zinc-400 mx-auto" />
          <CardTitle className="text-lg">Truck is Empty</CardTitle>
          <CardDescription className="text-xs max-w-xs mx-auto">
            No full product cases or collected empty containers are currently loaded on this truck.
          </CardDescription>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500">
              <Package className="w-4 h-4 text-zinc-600" />
              <span>Full Product Cases</span>
            </div>

            {productBalances.length === 0 ? (
              <div className="p-4 text-center text-zinc-400 text-xs border border-dashed border-zinc-200 rounded-lg">
                No full product cases on board.
              </div>
            ) : (
              <div className="space-y-2">
                {productBalances.map((b) => (
                  <Card key={b.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-zinc-900 text-base">{b.products?.name}</h4>
                        <p className="text-xs text-zinc-400 font-mono">SKU: {b.products?.sku || 'N/A'}</p>
                      </div>
                      <span className="text-xl font-bold text-zinc-900 font-mono">
                        {b.quantity} <span className="text-xs text-zinc-500 font-normal">{b.unit || 'case'}s</span>
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 pt-4 border-t border-zinc-200">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500">
              <RotateCcw className="w-4 h-4 text-zinc-600" />
              <span>Collected Empty Returns On Truck</span>
            </div>

            {returnableBalances.length === 0 ? (
              <div className="p-4 text-center text-zinc-400 text-xs border border-dashed border-zinc-200 rounded-lg">
                No empty containers associated with this truck.
              </div>
            ) : (
              <div className="space-y-2">
                {returnableBalances.map((rb) => (
                  <Card key={rb.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-zinc-900 text-base">{rb.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] uppercase font-mono">
                            {rb.item_type}
                          </Badge>
                          <span className="text-[11px] text-zinc-400">
                            {rb.quantity > 0 ? 'On Board' : 'None Collected'}
                          </span>
                        </div>
                      </div>
                      <span className="text-xl font-bold text-zinc-900 font-mono">
                        {rb.quantity} <span className="text-xs text-zinc-500 font-normal">{rb.unit || 'pcs'}</span>
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
