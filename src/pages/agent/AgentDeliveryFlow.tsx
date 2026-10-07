import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import type { MicroStore, ReturnableItem, Truck, Agent } from '../../types/database.types';
import {
  ShoppingBag,
  ArrowRight,
  Minus,
  Plus,
  Coins,
  CheckCircle2,
  Printer,
  FileText,
  AlertCircle,
  Check,
  Trash2,
  Store,
  MapPin,
  Phone,
  Search,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';

// Known brand clusters for strict brand-level container isolation
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

// Helper to strictly resolve the exact matching returnable containers for a specific product
const resolveProductContainers = (
  prod: any,
  catalog: ReturnableItem[]
): { bottleItem: ReturnableItem | null; caseItem: ReturnableItem | null; isReturnable: boolean } => {
  const pkg = prod?.product_packaging?.[0];
  const isReturnable = pkg ? (pkg.is_returnable !== false) : true;
  if (!isReturnable) {
    return { bottleItem: null, caseItem: null, isReturnable: false };
  }

  const prodName = (prod?.name || '').trim();
  const prodBrand = getBrandKey(prodName);

  // Strict Brand Conflict Checker: reject any container that belongs to a different brand
  const isBrandConflict = (r: ReturnableItem) => {
    if (r.product_id && r.product_id === prod.id) return false;
    const rBrand = getBrandKey((r.name || '') + ' ' + (r.code || ''));
    if (prodBrand && rBrand && prodBrand !== rBrand) return true;
    return false;
  };

  // 1. Find matching Bottle
  let bottleItem: ReturnableItem | null = null;

  // A. Check if directly linked by product_id
  bottleItem = catalog.find(
    (r) => r.product_id === prod.id && (r.item_type === 'BOTTLE' || r.type === 'BOTTLE')
  ) || null;

  // B. Check pkg.returnable_item_id if no brand conflict
  if (!bottleItem && pkg?.returnable_item_id) {
    const directRet = catalog.find((r) => r.id === pkg.returnable_item_id);
    if (directRet && !isBrandConflict(directRet)) {
      bottleItem = directRet;
    }
  }

  // C. Match by brand / name
  if (!bottleItem) {
    bottleItem = catalog.find((r) => {
      if (r.item_type !== 'BOTTLE' && r.type !== 'BOTTLE') return false;
      if (isBrandConflict(r)) return false;
      const rBrand = getBrandKey(r.name);
      if (prodBrand && rBrand && prodBrand === rBrand) return true;
      if (r.name.toLowerCase().includes(prodName.toLowerCase()) || prodName.toLowerCase().includes(r.name.toLowerCase())) return true;
      return false;
    }) || null;
  }

  // D. Fallback: Always generate a specific, perfectly named bottle item for this product
  if (!bottleItem) {
    bottleItem = {
      id: `virtual-btl-${prod.id}`,
      tenant_id: prod.tenant_id || '',
      code: `RET-${(prod.sku || prodName).replace(/[^a-zA-Z0-9]/g, '-').toUpperCase()}-BTL`,
      name: `${prodName} Bottle`,
      item_type: 'BOTTLE',
      type: 'BOTTLE',
      deposit_rate: 10.00,
      pundo_value: 10.00,
      unit: 'bottle',
      product_id: prod.id,
      is_active: true,
      created_at: new Date().toISOString(),
    };
  }

  // 2. Find matching Case
  let caseItem: ReturnableItem | null = null;

  // A. Check if directly linked by product_id
  caseItem = catalog.find(
    (r) => r.product_id === prod.id && (r.item_type === 'CASE' || r.type === 'CASE')
  ) || null;

  // B. Match by brand / name
  if (!caseItem) {
    caseItem = catalog.find((r) => {
      if (r.item_type !== 'CASE' && r.type !== 'CASE') return false;
      if (isBrandConflict(r)) return false;
      const rBrand = getBrandKey(r.name);
      if (prodBrand && rBrand && prodBrand === rBrand) return true;
      if (r.name.toLowerCase().includes(prodName.toLowerCase()) || prodName.toLowerCase().includes(r.name.toLowerCase())) return true;
      return false;
    }) || null;
  }

  // C. Fallback: Always generate a specific, perfectly named case item for this product
  if (!caseItem) {
    caseItem = {
      id: `virtual-case-${prod.id}`,
      tenant_id: prod.tenant_id || '',
      code: `RET-${(prod.sku || prodName).replace(/[^a-zA-Z0-9]/g, '-').toUpperCase()}-CASE`,
      name: `${prodName} Case`,
      item_type: 'CASE',
      type: 'CASE',
      deposit_rate: 50.00,
      pundo_value: 50.00,
      unit: 'case',
      product_id: prod.id,
      is_active: true,
      created_at: new Date().toISOString(),
    };
  }

  return {
    bottleItem,
    caseItem,
    isReturnable: true,
  };
};

export const AgentDeliveryFlow: React.FC = () => {
  const { tenant } = useTenant();
  const { profile } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [stores, setStores] = useState<MicroStore[]>([]);
  const [selectedStore, setSelectedStore] = useState<MicroStore | null>(null);
  const [truck, setTruck] = useState<Truck | null>(null);
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [truckBalances, setTruckBalances] = useState<any[]>([]);
  const [returnableCatalog, setReturnableCatalog] = useState<ReturnableItem[]>([]);

  // Store Search & On-Route Field Store Creation
  const [storeSearch, setStoreSearch] = useState('');
  const [isAddStoreModalOpen, setIsAddStoreModalOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [creatingStore, setCreatingStore] = useState(false);
  const [storeCreationError, setStoreCreationError] = useState<string | null>(null);

  // Cart State: Map<productId, { product, qtyCases, casePrice, unitsPerCase }>
  const [cart, setCart] = useState<Map<string, { product: any; qtyCases: number; casePrice: number; unitsPerCase: number }>>(new Map());

  // Returns State: Map<returnableItemId, { item, returnedQty }>
  const [returnsMap, setReturnsMap] = useState<Map<string, { item: ReturnableItem; returnedQty: number }>>(new Map());

  const [submitting, setSubmitting] = useState(false);
  const [saleRecord, setSaleRecord] = useState<any>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [promotionsCatalog, setPromotionsCatalog] = useState<any[]>([]);
  const [selectedExtraReturnableId, setSelectedExtraReturnableId] = useState<string>('');

  const fetchDeliveryData = async () => {
    if (!tenant) return;
    try {
      const [stRes, retsRes, promosRes] = await Promise.all([
        supabase.from('micro_stores').select('*').eq('tenant_id', tenant.id).order('store_name'),
        supabase.from('returnable_items').select('*').eq('tenant_id', tenant.id).order('name'),
        supabase
          .from('promotions')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('is_active', true),
      ]);

      const initialCatalog = retsRes.data || [];
      const allStores: MicroStore[] = stRes.data || [];
      setReturnableCatalog(initialCatalog);
      setPromotionsCatalog(promosRes.data || []);

      let targetTruck: Truck | null = null;

      let matchedAgent: any = null;
      if (profile?.id) {
        const { data: agData } = await supabase
          .from('agents')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('user_id', profile.id)
          .limit(1)
          .maybeSingle();

        if (agData) {
          matchedAgent = agData;
          if (agData.assigned_truck_id) {
            const { data: trk } = await supabase
              .from('trucks')
              .select('*')
              .eq('id', agData.assigned_truck_id)
              .maybeSingle();
            targetTruck = trk;
          }
        }
      }

      if (!matchedAgent && profile?.full_name) {
        const { data: agByName } = await supabase
          .from('agents')
          .select('*')
          .eq('tenant_id', tenant.id)
          .ilike('full_name', profile.full_name)
          .limit(1)
          .maybeSingle();

        if (agByName) {
          matchedAgent = agByName;
          if (agByName.assigned_truck_id) {
            const { data: trk } = await supabase
              .from('trucks')
              .select('*')
              .eq('id', agByName.assigned_truck_id)
              .maybeSingle();
            targetTruck = trk;
          }
        }
      }

      // Filter visible stores for this agent (assigned stores + stores created by this agent)
      if (matchedAgent) {
        setCurrentAgent(matchedAgent);
        const filtered = allStores.filter(
          (s) => s.assigned_agent_id === matchedAgent.id || s.created_by_agent_id === matchedAgent.id
        );
        setStores(filtered);
      } else {
        setStores(allStores);
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

      if (targetTruck) {
        setTruck(targetTruck);
        if (targetTruck.location_id) {
          const { data: bals } = await supabase
            .from('inventory_balances')
            .select('*, products(*, product_packaging(*), product_prices(*))')
            .eq('location_id', targetTruck.location_id);

          setTruckBalances(bals || []);

          // Auto-sync product-matched returnables in the database
          const workingCatalog: ReturnableItem[] = [...initialCatalog];
          let catalogUpdated = false;

          for (const b of bals || []) {
            const prod = b.products;
            if (!prod) continue;
            const pkg = prod.product_packaging?.[0];
            const isRet = pkg ? (pkg.is_returnable !== false) : true;
            if (!isRet) continue;

            const prodName = (prod.name || '').trim();
            const prodBrand = getBrandKey(prodName);

            // Check if matching bottle already exists in catalog
            let existingBottle = workingCatalog.find(
              (r) => (r.item_type === 'BOTTLE' || r.type === 'BOTTLE') &&
                (r.product_id === prod.id || (prodBrand && getBrandKey(r.name) === prodBrand) || r.name.toLowerCase().includes(prodName.toLowerCase()))
            );

            if (!existingBottle) {
              const bottleCode = `RET-${(prod.sku || prodName).replace(/[^a-zA-Z0-9]/g, '-').toUpperCase()}-BTL`;
              const { data: newBtl } = await supabase
                .from('returnable_items')
                .upsert(
                  [
                    {
                      tenant_id: tenant.id,
                      code: bottleCode,
                      name: `${prodName} Bottle`,
                      item_type: 'BOTTLE',
                      type: 'BOTTLE',
                      deposit_rate: 10.00,
                      pundo_value: 10.00,
                      unit: 'bottle',
                      product_id: prod.id,
                      is_active: true,
                    },
                  ],
                  { onConflict: 'tenant_id,code' }
                )
                .select()
                .maybeSingle();

              if (newBtl) {
                existingBottle = newBtl;
                workingCatalog.push(newBtl);
                catalogUpdated = true;
              }
            }

            // Check if matching case already exists in catalog
            let existingCase = workingCatalog.find(
              (r) => (r.item_type === 'CASE' || r.type === 'CASE') &&
                (r.product_id === prod.id || (prodBrand && getBrandKey(r.name) === prodBrand) || r.name.toLowerCase().includes(prodName.toLowerCase()))
            );

            if (!existingCase) {
              const caseCode = `RET-${(prod.sku || prodName).replace(/[^a-zA-Z0-9]/g, '-').toUpperCase()}-CASE`;
              const { data: newCs } = await supabase
                .from('returnable_items')
                .upsert(
                  [
                    {
                      tenant_id: tenant.id,
                      code: caseCode,
                      name: `${prodName} Case`,
                      item_type: 'CASE',
                      type: 'CASE',
                      deposit_rate: 50.00,
                      pundo_value: 50.00,
                      unit: 'case',
                      product_id: prod.id,
                      is_active: true,
                    },
                  ],
                  { onConflict: 'tenant_id,code' }
                )
                .select()
                .maybeSingle();

              if (newCs) {
                existingCase = newCs;
                workingCatalog.push(newCs);
                catalogUpdated = true;
              }
            }

            // If pkg.returnable_item_id is misaligned, link it properly to the matching bottle
            if (existingBottle && pkg && pkg.returnable_item_id !== existingBottle.id) {
              await supabase
                .from('product_packaging')
                .update({ returnable_item_id: existingBottle.id })
                .eq('id', pkg.id);
            }
          }

          if (catalogUpdated) {
            setReturnableCatalog(workingCatalog);
          }
        }
      }
    } catch (err) {
      console.error('Error initializing delivery data:', err);
    }
  };

  useEffect(() => {
    fetchDeliveryData();
  }, [tenant, profile]);

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

  // 1. Delivered Products & Return Requirements Calculation
  let totalDeliveredCases = 0;
  let totalDeliveredBottles = 0;
  let totalRequiredBottles = 0;
  let totalRequiredCases = 0;
  let totalFreePromoCases = 0;
  let cartTotal = 0;

  // Map of returnable_item_id -> { item, requiredQty, sourceProducts }
  const requiredByReturnableId = new Map<string, { item: ReturnableItem; requiredQty: number; sourceProducts: string[] }>();

  cart.forEach((val, prodId) => {
    const { product, qtyCases, casePrice, unitsPerCase } = val;
    totalDeliveredCases += qtyCases;
    totalDeliveredBottles += qtyCases * unitsPerCase;
    cartTotal += qtyCases * casePrice;

    // Calculate free promo cases
    const activePromo = promotionsCatalog.find((p) => p.buy_product_id === prodId && p.is_active);
    if (activePromo) {
      const buyQty = Number(activePromo.buy_quantity || 5);
      const freeQtyPerDeal = Number(activePromo.free_quantity || 1);
      const promoDeals = Math.floor(qtyCases / buyQty);
      totalFreePromoCases += promoDeals * freeQtyPerDeal;
    }

    const { bottleItem, caseItem, isReturnable } = resolveProductContainers(product, returnableCatalog);
    if (isReturnable) {
      const bQty = qtyCases * unitsPerCase;
      const cQty = qtyCases;

      totalRequiredBottles += bQty;
      totalRequiredCases += cQty;

      if (bottleItem) {
        const existing = requiredByReturnableId.get(bottleItem.id) || { item: bottleItem, requiredQty: 0, sourceProducts: [] };
        existing.requiredQty += bQty;
        if (!existing.sourceProducts.includes(product.name)) existing.sourceProducts.push(product.name);
        requiredByReturnableId.set(bottleItem.id, existing);
      }

      if (caseItem) {
        const existing = requiredByReturnableId.get(caseItem.id) || { item: caseItem, requiredQty: 0, sourceProducts: [] };
        existing.requiredQty += cQty;
        if (!existing.sourceProducts.includes(product.name)) existing.sourceProducts.push(product.name);
        requiredByReturnableId.set(caseItem.id, existing);
      }
    }
  });

  const totalPhysicalOffloadCases = totalDeliveredCases + totalFreePromoCases;

  // Prepare Step 3: Populate ONLY returnables strictly associated with the delivered products in cart
  const prepareReturnablesStep = () => {
    setReturnsMap((prev) => {
      const nextReturns = new Map<string, { item: ReturnableItem; returnedQty: number }>();

      // 1. Add all returnables strictly required by the current cart
      // Default to 1:1 complete return exchange (requiredQty) for standard beverage delivery workflow
      requiredByReturnableId.forEach(({ item, requiredQty }) => {
        const existing = prev.get(item.id);
        nextReturns.set(item.id, {
          item,
          returnedQty: existing !== undefined ? existing.returnedQty : requiredQty,
        });
      });

      // 2. Preserve manually added extra returnables with returnedQty > 0
      prev.forEach(({ item, returnedQty }) => {
        if (returnedQty > 0 && !nextReturns.has(item.id)) {
          nextReturns.set(item.id, { item, returnedQty });
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

  const handleAddExtraReturnable = (returnableId: string) => {
    const item = returnableCatalog.find((r) => r.id === returnableId);
    if (!item) return;
    setReturnsMap((prev) => {
      const next = new Map(prev);
      if (!next.has(item.id)) {
        next.set(item.id, { item, returnedQty: 0 });
      }
      return next;
    });
    setSelectedExtraReturnableId('');
  };

  const handleRemoveExtraReturnable = (returnableId: string) => {
    setReturnsMap((prev) => {
      const next = new Map(prev);
      next.delete(returnableId);
      return next;
    });
  };

  // 2. Deposit Breakdown, Shortage & Surplus Calculations per Returnable Item
  let totalBottlePundoCharge = 0;
  let totalCasePundoCharge = 0;
  let totalEmptiesCredit = 0;

  const allActiveReturnableIds = new Set([
    ...Array.from(requiredByReturnableId.keys()),
    ...Array.from(returnsMap.keys()),
  ]);

  interface ReturnableBreakdownRow {
    item: ReturnableItem;
    requiredQty: number;
    returnedQty: number;
    rate: number;
    shortage: number;
    charge: number;
    surplus: number;
    credit: number;
    isBottle: boolean;
    isCase: boolean;
    sourceProducts: string[];
  }

  const breakdownList: ReturnableBreakdownRow[] = [];
  const returnedItemsList: { item: ReturnableItem; returnedQty: number; rate: number; totalValue: number }[] = [];

  allActiveReturnableIds.forEach((id) => {
    const reqObj = requiredByReturnableId.get(id);
    const retObj = returnsMap.get(id);
    const item = reqObj?.item || retObj?.item || returnableCatalog.find((r) => r.id === id);
    if (!item) return;

    const requiredQty = reqObj?.requiredQty || 0;
    const returnedQty = retObj?.returnedQty || 0;
    const rate = Number(item.deposit_rate || item.pundo_value || 0);

    const isBottle = item.item_type === 'BOTTLE' || item.type === 'BOTTLE';
    const isCase = item.item_type === 'CASE' || item.type === 'CASE';

    const shortage = Math.max(0, requiredQty - returnedQty);
    const charge = shortage * rate;

    const surplus = Math.max(0, returnedQty - requiredQty);
    const credit = surplus * rate;

    if (isBottle) {
      totalBottlePundoCharge += charge;
    } else {
      totalCasePundoCharge += charge;
    }
    totalEmptiesCredit += credit;

    breakdownList.push({
      item,
      requiredQty,
      returnedQty,
      rate,
      shortage,
      charge,
      surplus,
      credit,
      isBottle,
      isCase,
      sourceProducts: reqObj?.sourceProducts || [],
    });

    if (returnedQty > 0) {
      returnedItemsList.push({
        item,
        returnedQty,
        rate,
        totalValue: returnedQty * rate,
      });
    }
  });

  const totalShortageBottles = breakdownList
    .filter((r) => r.isBottle)
    .reduce((sum, r) => sum + r.shortage, 0);

  const totalShortageCases = breakdownList
    .filter((r) => r.isCase)
    .reduce((sum, r) => sum + r.shortage, 0);

  const netPundoDepositDue = (totalBottlePundoCharge + totalCasePundoCharge) - totalEmptiesCredit;
  const netTotalPayable = Math.max(0, cartTotal + netPundoDepositDue);

  const handleConfirmDelivery = async () => {
    if (!tenant || !selectedStore || !truck) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
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
        bottle_pundo_amount: totalBottlePundoCharge,
        case_pundo_amount: totalCasePundoCharge,
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

      // 2. Insert Delivered Sale Items & Supplier Promo Claims
      if (sale?.id) {
        const saleItemsPayload: any[] = [];
        const promoClaimsPayload: any[] = [];

        for (const [prodId, val] of cart.entries()) {
          saleItemsPayload.push({
            sale_id: sale.id,
            product_id: prodId,
            quantity: val.qtyCases,
            unit_price: val.casePrice,
            subtotal: val.qtyCases * val.casePrice,
            unit: 'case',
            is_promo_free: false,
          });

          const activePromo = promotionsCatalog.find((p) => p.buy_product_id === prodId && p.is_active);
          if (activePromo) {
            const buyQty = Number(activePromo.buy_quantity || 5);
            const freeQtyPerDeal = Number(activePromo.free_quantity || 1);
            const promoDeals = Math.floor(val.qtyCases / buyQty);
            const totalFreeCases = promoDeals * freeQtyPerDeal;

            if (totalFreeCases > 0) {
              saleItemsPayload.push({
                sale_id: sale.id,
                product_id: activePromo.free_product_id || prodId,
                quantity: totalFreeCases,
                unit_price: 0,
                subtotal: 0,
                unit: 'case',
                is_promo_free: true,
                promo_id: activePromo.id,
              });

              promoClaimsPayload.push({
                tenant_id: tenant.id,
                promo_id: activePromo.id,
                supplier_id: activePromo.supplier_id || null,
                sale_id: sale.id,
                micro_store_id: selectedStore.id,
                agent_id: activeAgentId,
                truck_id: truck.id,
                qualifying_cases_sold: val.qtyCases,
                free_cases_awarded: totalFreeCases,
                claim_rate: Number(activePromo.claim_rate || 720),
                total_claim_amount: totalFreeCases * Number(activePromo.claim_rate || 720),
                status: 'PENDING_CLAIM',
              });
            }
          }
        }

        if (saleItemsPayload.length > 0) {
          const { error: sItemsErr } = await supabase.from('sale_items').insert(saleItemsPayload);
          if (sItemsErr) {
            console.warn('Initial sale_items insert failed (missing column), retrying with base columns:', sItemsErr.message);
            const fallbackPayload = saleItemsPayload.map(({ sale_id, product_id, quantity, unit_price, unit }) => ({
              sale_id,
              product_id,
              quantity,
              unit_price,
              unit: unit || 'case',
            }));
            const { error: fbErr } = await supabase.from('sale_items').insert(fallbackPayload);
            if (fbErr) console.error('Fallback sale_items insert error:', fbErr);
            else console.log('✅ sale_items inserted successfully via fallback payload');
          }
        }

        if (promoClaimsPayload.length > 0) {
          const { error: claimErr } = await supabase.from('supplier_promo_claims').insert(promoClaimsPayload);
          if (claimErr) console.error('Error inserting supplier_promo_claims:', claimErr);
        }
      }

      // 3. Deduct Truck Inventory Balance
      for (const [prodId, val] of cart.entries()) {
        const bal = truckBalances.find((b) => b.product_id === prodId);
        if (bal) {
          let totalDeductCases = val.qtyCases;

          const activePromo = promotionsCatalog.find((p) => p.buy_product_id === prodId && p.is_active);
          if (activePromo) {
            const buyQty = Number(activePromo.buy_quantity || 5);
            const freeQtyPerDeal = Number(activePromo.free_quantity || 1);
            const promoDeals = Math.floor(val.qtyCases / buyQty);
            totalDeductCases += promoDeals * freeQtyPerDeal;
          }

          await supabase
            .from('inventory_balances')
            .update({ quantity: Math.max(0, Number(bal.quantity) - totalDeductCases) })
            .eq('id', bal.id);
        }
      }

      // 4. Record PUNDO Ledger Entries & Update Truck Returnable Balances
      for (const row of breakdownList) {
        let realReturnableId = row.item.id;

        // If this returnable was a newly generated virtual item, persist it in returnable_items first
        if (realReturnableId.startsWith('virtual-') || realReturnableId.startsWith('btl-') || realReturnableId.startsWith('case-')) {
          const { data: existingRet } = await supabase
            .from('returnable_items')
            .select('id')
            .eq('tenant_id', tenant.id)
            .or(`code.eq.${row.item.code},name.eq.${row.item.name}`)
            .limit(1)
            .maybeSingle();

          if (existingRet?.id) {
            realReturnableId = existingRet.id;
          } else {
            const { data: insertedRet, error: insErr } = await supabase
              .from('returnable_items')
              .insert([
                {
                  tenant_id: tenant.id,
                  code: row.item.code,
                  name: row.item.name,
                  item_type: row.item.item_type || row.item.type,
                  type: row.item.type || row.item.item_type,
                  deposit_rate: row.rate,
                  pundo_value: row.rate,
                  unit: row.item.unit || (row.isBottle ? 'bottle' : 'case'),
                  product_id: row.item.product_id || null,
                  is_active: true,
                },
              ])
              .select('id')
              .maybeSingle();

            if (insertedRet?.id) {
              realReturnableId = insertedRet.id;
            } else {
              console.warn('Could not insert returnable item, re-querying:', insErr);
              const { data: retryRet } = await supabase
                .from('returnable_items')
                .select('id')
                .eq('tenant_id', tenant.id)
                .eq('name', row.item.name)
                .limit(1)
                .maybeSingle();
              if (retryRet?.id) realReturnableId = retryRet.id;
            }
          }
        }

        // Validate UUID syntax before passing to Postgres UUID columns to avoid HTTP 400
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(realReturnableId);
        if (!isUUID) {
          console.error(`⚠️ Skipping invalid non-UUID returnable_id: ${realReturnableId}`);
          continue;
        }

        // Record DELIVERED_CONTAINER for any lacking containers (shortage)
        if (row.shortage > 0) {
          const { data: latestEntry } = await supabase
            .from('pundo_ledger')
            .select('balance_quantity')
            .eq('tenant_id', tenant.id)
            .eq('micro_store_id', selectedStore.id)
            .eq('returnable_item_id', realReturnableId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const prevBal = Number(latestEntry?.balance_quantity || 0);
          const newBal = prevBal + row.shortage;
          const newVal = newBal * row.rate;

          const delivPayload: any = {
            tenant_id: tenant.id,
            micro_store_id: selectedStore.id,
            returnable_item_id: realReturnableId,
            transaction_type: 'DELIVERED_CONTAINER',
            quantity_change: row.shortage,
            pundo_rate: row.rate,
            balance_quantity: newBal,
            balance_value: newVal,
            reference_id: sale.id,
          };

          let { error: delivErr } = await supabase.from('pundo_ledger').insert([delivPayload]);
          if (delivErr && delivErr.message?.includes('pundo_rate')) {
            const { pundo_rate, ...fallbackPayload } = delivPayload;
            const res = await supabase.from('pundo_ledger').insert([fallbackPayload]);
            delivErr = res.error;
          }

          if (delivErr) console.error('❌ Error inserting DELIVERED_CONTAINER into pundo_ledger:', delivErr);
          else console.log(`✅ [pundo_ledger] Logged DELIVERED_CONTAINER for ${row.item.name}: +${row.shortage}`);
        }

        // Record RETURNED_EMPTY for all actual empties returned
        if (row.returnedQty > 0) {
          const { data: latestRetEntry } = await supabase
            .from('pundo_ledger')
            .select('balance_quantity')
            .eq('tenant_id', tenant.id)
            .eq('micro_store_id', selectedStore.id)
            .eq('returnable_item_id', realReturnableId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const prevBal = Number(latestRetEntry?.balance_quantity || 0);
          const newBal = Math.max(0, prevBal - row.returnedQty);
          const newVal = newBal * row.rate;

          const retPayload: any = {
            tenant_id: tenant.id,
            micro_store_id: selectedStore.id,
            returnable_item_id: realReturnableId,
            transaction_type: 'RETURNED_EMPTY',
            quantity_change: -row.returnedQty,
            pundo_rate: row.rate,
            balance_quantity: newBal,
            balance_value: newVal,
            reference_id: sale.id,
          };

          let { error: pundoErr } = await supabase.from('pundo_ledger').insert([retPayload]);
          if (pundoErr && pundoErr.message?.includes('pundo_rate')) {
            const { pundo_rate, ...fallbackPayload } = retPayload;
            const res = await supabase.from('pundo_ledger').insert([fallbackPayload]);
            pundoErr = res.error;
          }

          if (pundoErr) console.error('❌ Error inserting RETURNED_EMPTY into pundo_ledger:', pundoErr);
          else console.log(`✅ [pundo_ledger] Logged RETURNED_EMPTY for ${row.item.name}: -${row.returnedQty}`);

          if (truck.location_id) {
            const { data: existingTrkBal } = await supabase
              .from('returnable_balances')
              .select('id, quantity')
              .eq('tenant_id', tenant.id)
              .eq('location_id', truck.location_id)
              .eq('returnable_item_id', realReturnableId)
              .limit(1)
              .maybeSingle();

            if (existingTrkBal) {
              const updatedQty = Number(existingTrkBal.quantity || 0) + Number(row.returnedQty);
              await supabase
                .from('returnable_balances')
                .update({
                  quantity: updatedQty,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingTrkBal.id);
              console.log(`📦 [AgentDeliveryFlow] Updated truck returnable balance (${row.item.name}): +${row.returnedQty} (New total: ${updatedQty})`);
            } else {
              await supabase.from('returnable_balances').insert([
                {
                  tenant_id: tenant.id,
                  location_id: truck.location_id,
                  returnable_item_id: realReturnableId,
                  quantity: Number(row.returnedQty),
                },
              ]);
              console.log(`📦 [AgentDeliveryFlow] Inserted truck returnable balance (${row.item.name}): ${row.returnedQty}`);
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

  const handleAgentCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !newStoreName.trim()) return;
    setCreatingStore(true);
    setStoreCreationError(null);

    try {
      const genCode = `STR-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;

      // 1. Create location
      const { data: loc } = await supabase
        .from('locations')
        .insert([
          {
            tenant_id: tenant.id,
            name: newStoreName.trim(),
            type: 'MICRO_STORE',
            is_active: true,
          },
        ])
        .select()
        .maybeSingle();

      // 2. Insert micro_store with assigned and created_by agent links
      const storePayload: any = {
        tenant_id: tenant.id,
        store_code: genCode,
        store_name: newStoreName.trim(),
        owner_name: newOwnerName.trim() || null,
        phone: newPhone.trim() || null,
        address: newAddress.trim() || null,
        location_id: loc?.id || null,
        assigned_agent_id: currentAgent?.id || null,
        created_by_agent_id: currentAgent?.id || null,
        status: 'ACTIVE',
      };

      let insertRes = await supabase.from('micro_stores').insert([storePayload]).select().single();
      if (insertRes.error && (insertRes.error.message?.includes('assigned_agent_id') || insertRes.error.message?.includes('created_by_agent_id'))) {
        const { assigned_agent_id, created_by_agent_id, ...fallbackPayload } = storePayload;
        insertRes = await supabase.from('micro_stores').insert([fallbackPayload]).select().single();
      }

      if (insertRes.error || !insertRes.data) {
        throw (insertRes.error || new Error('Failed to register store in database'));
      }

      const createdStore: MicroStore = insertRes.data;

      // Add to local state
      setStores((prev) => [createdStore, ...prev]);

      // Automatically select and advance to Step 2
      setSelectedStore(createdStore);
      setIsAddStoreModalOpen(false);
      setNewStoreName('');
      setNewOwnerName('');
      setNewPhone('');
      setNewAddress('');
      setStep(2);
    } catch (err: any) {
      console.error('Error creating micro store:', err);
      setStoreCreationError(err.message || 'Failed to create micro store');
    } finally {
      setCreatingStore(false);
    }
  };

  // Available unused containers in catalog for extra surplus return
  const availableExtraContainers = returnableCatalog.filter((r) => !returnsMap.has(r.id));

  const filteredStepStores = stores.filter((s) => {
    const q = storeSearch.toLowerCase();
    return (
      s.store_name.toLowerCase().includes(q) ||
      s.store_code.toLowerCase().includes(q) ||
      s.owner_name?.toLowerCase().includes(q) ||
      s.address?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-20">
      {/* Header Wizard Indicator */}
      <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-zinc-700" />
          <div>
            <h1 className="text-lg font-bold text-zinc-900">Store Delivery</h1>
            <span className="text-xs text-zinc-500">Step {step} of 4</span>
          </div>
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all ${i === step ? 'w-6 bg-zinc-900' : i < step ? 'w-4 bg-zinc-700' : 'w-4 bg-zinc-200'
                }`}
            />
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STEP 1: Select Micro-Store */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Select Store Destination</h2>
              <p className="text-[11px] text-zinc-400">Stores assigned to your route ({stores.length})</p>
            </div>
            <Button
              onClick={() => {
                setStoreCreationError(null);
                setIsAddStoreModalOpen(true);
              }}
              size="sm"
              className="gap-1 text-xs h-8 bg-zinc-900 text-white hover:bg-zinc-800 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Store</span>
            </Button>
          </div>

          {stores.length > 0 && (
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
              <Input
                type="text"
                placeholder="Search assigned stores..."
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>
          )}

          {filteredStepStores.length === 0 ? (
            <div className="p-8 text-center bg-zinc-50 border border-dashed border-zinc-200 rounded-xl space-y-3">
              <Store className="w-8 h-8 text-zinc-400 mx-auto" />
              <div>
                <p className="text-xs font-semibold text-zinc-800">
                  {stores.length === 0 ? 'No Assigned Route Stores Found' : 'No Stores Match Search'}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {stores.length === 0
                    ? 'You have not been assigned stores by admin yet, or you can register a new store right now.'
                    : 'Try another search term or register a new customer store.'}
                </p>
              </div>
              <Button
                onClick={() => {
                  setStoreCreationError(null);
                  setIsAddStoreModalOpen(true);
                }}
                size="sm"
                className="gap-1.5 text-xs bg-zinc-900 text-white hover:bg-zinc-800"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register New Store</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredStepStores.map((s) => {
                const isCreatedByMe = currentAgent && s.created_by_agent_id === currentAgent.id;

                return (
                  <Card
                    key={s.id}
                    onClick={() => {
                      setSelectedStore(s);
                      setStep(2);
                    }}
                    className={`cursor-pointer transition hover:border-zinc-400 border-zinc-200 shadow-xs ${selectedStore?.id === s.id ? 'border-zinc-900 ring-1 ring-zinc-900' : ''
                      }`}
                  >
                    <CardContent className="p-3.5 flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-zinc-900">{s.store_name}</span>
                          <Badge variant="outline" className="font-mono text-[10px] text-zinc-600">
                            {s.store_code}
                          </Badge>
                          {isCreatedByMe && (
                            <Badge variant="secondary" className="text-[9px] bg-zinc-100 text-zinc-700 gap-0.5">
                              <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                              <span>Field Added</span>
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-500 space-y-0.5">
                          {s.owner_name && <p>Owner: {s.owner_name}</p>}
                          {s.phone && (
                            <p className="flex items-center gap-1 font-mono">
                              <Phone className="w-3 h-3 text-zinc-400 shrink-0" />
                              <span>{s.phone}</span>
                            </p>
                          )}
                          {s.address && (
                            <p className="flex items-center gap-1 line-clamp-1">
                              <MapPin className="w-3 h-3 text-zinc-400 shrink-0" />
                              <span>{s.address}</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-zinc-400 shrink-0" />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Field Store Creation Modal */}
      <Dialog open={isAddStoreModalOpen} onOpenChange={setIsAddStoreModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Store className="w-4 h-4 text-zinc-700" />
              <span>Register New Micro Store</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Add a new customer store on-route. It will be added to your route and synced to the admin dashboard.
            </DialogDescription>
          </DialogHeader>

          {storeCreationError && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{storeCreationError}</span>
            </div>
          )}

          <form onSubmit={handleAgentCreateStore} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-medium text-zinc-700 mb-1">Store Name *</label>
              <Input
                type="text"
                required
                placeholder="e.g. Aling Nena Sari-Sari Store"
                value={newStoreName}
                onChange={(e) => setNewStoreName(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-medium text-zinc-700 mb-1">Owner Name</label>
                <Input
                  type="text"
                  placeholder="Elena Santos"
                  value={newOwnerName}
                  onChange={(e) => setNewOwnerName(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="block font-medium text-zinc-700 mb-1">Phone Number</label>
                <Input
                  type="text"
                  placeholder="+63 918..."
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-zinc-700 mb-1">Address / Landmark</label>
              <Input
                type="text"
                placeholder="Corner St., Brgy. Mabolo"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddStoreModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creatingStore} className="bg-zinc-900 text-white hover:bg-zinc-800">
                {creatingStore ? 'Saving...' : 'Create & Select Store'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* STEP 2: Select Products to Deliver */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-lg flex items-center justify-between text-xs">
            <div>
              <span className="text-zinc-500 uppercase font-mono block text-[10px]">SELECTED STORE</span>
              <strong className="text-zinc-900 text-sm font-semibold">{selectedStore?.store_name}</strong>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="h-7 text-xs">
              Change
            </Button>
          </div>

          {/* Active Promo Guidance Banner */}
          {promotionsCatalog.some((p) => p.is_active) && (
            <div className="bg-blue-50/90 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 space-y-1 shadow-xs">
              <div className="flex items-center gap-1.5 font-bold text-blue-950">

                <span>Trade Promotion Notice for Agents:</span>
              </div>
              <p className="text-blue-800 leading-relaxed text-[11px]">
                Enter <strong>only the paid cases</strong> the store is purchasing (e.g. enter <strong>5</strong>). The system will <strong>automatically grant the +1 FREE case</strong>, bill the store for 5 cases, and deduct all 6 physical cases from your truck load.
              </p>
            </div>
          )}

          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Products to Deliver</h2>

          {truckBalances.length === 0 ? (
            <div className="p-8 text-center text-zinc-400 text-xs border border-dashed border-zinc-200 rounded-lg">
              No product stock loaded on truck. Transfer cases from main warehouse first.
            </div>
          ) : (
            <div className="space-y-2.5">
              {truckBalances.map((bal) => {
                const prod = bal.products;
                const pkg = prod?.product_packaging?.[0];
                const units = Number(pkg?.units_per_package || pkg?.units_per_case || 24);
                const isRet = pkg ? (pkg.is_returnable !== false) : true;
                const inCart = cart.get(prod.id);
                const currentQty = inCart ? inCart.qtyCases : 0;
                const maxStock = Number(bal.quantity || 0);

                return (
                  <Card key={bal.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-zinc-900 text-base">{prod?.name}</h4>
                            {!isRet && (
                              <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                                Non-Returnable
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500">
                            Available: <strong className="text-zinc-900 font-mono">{maxStock} cases</strong> ({units} btls/case)
                          </p>

                          {/* Active Promo Badge & Helper */}
                          {(() => {
                            const activePromo = promotionsCatalog.find((p) => p.buy_product_id === prod.id && p.is_active);
                            if (!activePromo) return null;

                            const buyQty = Number(activePromo.buy_quantity || 5);
                            const freeQtyPerDeal = Number(activePromo.free_quantity || 1);
                            const deals = Math.floor(currentQty / buyQty);
                            const freeCs = deals * freeQtyPerDeal;

                            return (
                              <div className="mt-2 space-y-1.5">
                                <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-900 font-semibold border-blue-200">
                                  Deal: Buy {buyQty} &rarr; +{freeQtyPerDeal} FREE
                                </Badge>

                                {freeCs > 0 ? (
                                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-md text-[11px] text-emerald-900 space-y-0.5">
                                    <div className="font-bold flex items-center gap-1 text-emerald-800">
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>+{freeCs} Free Promo Case{freeCs > 1 ? 's' : ''} auto-granted!</span>
                                    </div>
                                    <p className="text-[10px] text-emerald-700">
                                      Store pays for {currentQty} cs • Offload from truck: <strong>{currentQty + freeCs} physical cases</strong> ({currentQty} paid + {freeCs} free @ ₱0.00)
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-zinc-500">
                                    💡 Enter {buyQty} cases to auto-unlock +{freeQtyPerDeal} free promo case!
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        <div className="flex items-center gap-1.5 bg-zinc-50 p-1 rounded-lg border border-zinc-200 shrink-0">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => updateCartQty(bal, -1)}
                            className="h-8 w-8"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </Button>

                          <Input
                            type="number"
                            min="0"
                            max={maxStock}
                            value={currentQty === 0 ? '' : currentQty}
                            placeholder="0"
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              setCartQtyDirect(bal, isNaN(val) ? 0 : val);
                            }}
                            className="w-14 text-center font-bold text-base font-mono h-8 p-0"
                          />

                          <Button
                            variant="default"
                            size="icon"
                            onClick={() => updateCartQty(bal, 1)}
                            className="h-8 w-8"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-lg space-y-2 text-xs">
            <div className="flex justify-between text-zinc-600">
              <span>Paid Products: <strong className="text-zinc-900">{totalDeliveredCases} cases</strong></span>
              <span>Total Units: <strong className="text-zinc-900">{totalDeliveredBottles} bottles</strong></span>
            </div>
            {totalFreePromoCases > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold pt-1 border-t border-zinc-200/60 text-xs">
                <span>+ Free Promo Cases (₱0.00):</span>
                <span>+{totalFreePromoCases} cases</span>
              </div>
            )}
            <div className="flex justify-between text-zinc-700 font-medium text-xs">
              <span>Total Physical Cases to Offload:</span>
              <strong className="text-zinc-900 font-mono">{totalPhysicalOffloadCases} cases</strong>
            </div>
            <div className="flex justify-between text-sm font-bold text-zinc-900 pt-2 border-t border-zinc-200">
              <span>Product Subtotal:</span>
              <span className="font-mono">₱{cartTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(1)} className="w-1/3">
              Back
            </Button>
            <Button
              disabled={cart.size === 0}
              onClick={prepareReturnablesStep}
              className="w-2/3 gap-1.5"
            >
              <span>Next: Record Returns</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Record Empties Returned */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Requirement Banner */}
          <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-lg text-xs space-y-1.5">
            {totalRequiredBottles > 0 || totalRequiredCases > 0 ? (
              <>
                <div className="flex justify-between font-medium text-zinc-800">
                  <span>Required Bottle Returns:</span>
                  <span className="font-mono font-bold text-zinc-900">{totalRequiredBottles} bottles</span>
                </div>
                <div className="flex justify-between font-medium text-zinc-800">
                  <span>Required Shell Case Returns:</span>
                  <span className="font-mono font-bold text-zinc-900">{totalRequiredCases} cases</span>
                </div>
                <p className="text-[11px] text-zinc-500 pt-1 border-t border-zinc-200">
                  Customer pays <strong>₱0.00 PUNDO Deposit</strong> if all required empties are returned.
                </p>
              </>
            ) : (
              <div className="text-zinc-600">
                <span className="font-semibold text-zinc-900">No Returnables Required.</span>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Delivered products do not require empty container returns. You can still record surplus empties below.
                </p>
              </div>
            )}
          </div>

          {/* Section: Expected Container Returns strictly for delivered items */}
          <div className="space-y-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Expected Container Returns
            </h2>

            {Array.from(returnsMap.values())
              .filter(({ item }) => requiredByReturnableId.has(item.id))
              .map(({ item, returnedQty }) => {
                const reqObj = requiredByReturnableId.get(item.id);
                const reqQty = reqObj?.requiredQty || 0;
                const depositRate = Number(item.deposit_rate || item.pundo_value || 0);
                const isSatisfied = returnedQty >= reqQty;

                return (
                  <Card key={item.id} className={isSatisfied ? 'border-emerald-200 bg-emerald-50/20' : ''}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-zinc-900 text-base">{item.name}</h4>
                          {reqObj?.sourceProducts && reqObj.sourceProducts.length > 0 && (
                            <p className="text-[11px] text-zinc-500">
                              For: {reqObj.sourceProducts.join(', ')}
                            </p>
                          )}
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Deposit Rate: <strong className="text-zinc-900 font-mono">₱{depositRate.toFixed(2)}</strong> / {item.unit || (item.item_type === 'BOTTLE' ? 'bottle' : 'case')}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="outline" className="font-mono text-xs uppercase">
                            {item.item_type || item.type}
                          </Badge>
                          <Badge variant={isSatisfied ? 'default' : 'secondary'} className="text-[10px] font-mono">
                            Req: {reqQty}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setReturnedQtyDirect(item.id, reqQty)}
                          className="h-7 text-xs text-zinc-600 hover:text-zinc-900 px-2"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          <span>Return Full ({reqQty})</span>
                        </Button>

                        <div className="flex items-center gap-1.5 bg-zinc-50 p-1 rounded-lg border border-zinc-200">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => updateReturnedQty(item.id, -1)}
                            className="h-8 w-8"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </Button>

                          <Input
                            type="number"
                            min="0"
                            value={returnedQty === 0 ? '' : returnedQty}
                            placeholder="0"
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              setReturnedQtyDirect(item.id, isNaN(val) ? 0 : val);
                            }}
                            className="w-16 text-center font-bold text-base font-mono h-8 p-0"
                          />

                          <Button
                            variant="default"
                            size="icon"
                            onClick={() => updateReturnedQty(item.id, 1)}
                            className="h-8 w-8"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>

          {/* Section: Additional / Surplus Empty Returns */}
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Additional / Surplus Empties
              </h2>
            </div>

            {Array.from(returnsMap.values())
              .filter(({ item }) => !requiredByReturnableId.has(item.id))
              .map(({ item, returnedQty }) => (
                <Card key={item.id} className="border-dashed border-zinc-300">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-zinc-900 text-base">{item.name}</h4>
                          <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200 bg-emerald-50 font-mono">
                            Extra Credit
                          </Badge>
                        </div>
                        <p className="text-xs text-zinc-500">
                          Refund Rate: <strong className="text-zinc-900 font-mono">₱{Number(item.deposit_rate || item.pundo_value || 0).toFixed(2)}</strong> / {item.unit || 'pc'}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveExtraReturnable(item.id)}
                        className="h-7 w-7 text-zinc-400 hover:text-red-600"
                        title="Remove container"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                      <span className="text-xs text-zinc-600">Returned Count:</span>
                      <div className="flex items-center gap-1.5 bg-zinc-50 p-1 rounded-lg border border-zinc-200">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateReturnedQty(item.id, -1)}
                          className="h-8 w-8"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </Button>

                        <Input
                          type="number"
                          min="0"
                          value={returnedQty === 0 ? '' : returnedQty}
                          placeholder="0"
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setReturnedQtyDirect(item.id, isNaN(val) ? 0 : val);
                          }}
                          className="w-16 text-center font-bold text-base font-mono h-8 p-0"
                        />

                        <Button
                          variant="default"
                          size="icon"
                          onClick={() => updateReturnedQty(item.id, 1)}
                          className="h-8 w-8"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

            {availableExtraContainers.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <Select
                  value={selectedExtraReturnableId}
                  onValueChange={(val) => {
                    if (val) handleAddExtraReturnable(val);
                  }}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="+ Add other empty container to return..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableExtraContainers.map((r) => (
                      <SelectItem key={r.id} value={r.id} className="text-xs">
                        {r.name} ({r.item_type || r.type} - ₱{Number(r.deposit_rate || r.pundo_value || 0).toFixed(2)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => setStep(2)} className="w-1/3">
              Back
            </Button>
            <Button
              onClick={() => setStep(4)}
              className="w-2/3 gap-1.5"
            >
              <span>Review & Confirm</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: Review & Confirm */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Final Delivery & PUNDO Review</h2>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <CardDescription className="text-xs">Store Account</CardDescription>
                  <CardTitle className="text-base">{selectedStore?.store_name}</CardTitle>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  STATEMENT
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-0">
              <div className="space-y-1.5 text-xs text-zinc-600">
                <div className="flex justify-between">
                  <span>Paid Cases:</span>
                  <span className="font-semibold text-zinc-900">{totalDeliveredCases} cases ({totalDeliveredBottles} bottles)</span>
                </div>
                {totalFreePromoCases > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>+ Free Promo Cases (₱0.00):</span>
                    <span>+{totalFreePromoCases} cases auto-granted</span>
                  </div>
                )}
                <div className="flex justify-between font-medium text-zinc-800">
                  <span>Total Physical Cases to Offload:</span>
                  <span className="font-semibold text-zinc-900">{totalPhysicalOffloadCases} cases</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-zinc-100">
                  <span>Beverage Subtotal:</span>
                  <span className="font-mono font-semibold text-zinc-900">₱{cartTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Container Exchange Summary */}
              <div className="bg-zinc-50 p-3.5 rounded-lg border border-zinc-200 space-y-2.5">
                <div className="flex items-center gap-1.5 font-bold text-xs uppercase text-zinc-800">
                  <Coins className="w-4 h-4 text-zinc-600" />
                  <span>Container Exchange Summary</span>
                </div>

                {totalShortageBottles === 0 && totalShortageCases === 0 ? (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-xs flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0" />
                    <span><strong>1:1 Empties Returned.</strong> No PUNDO deposit charge applied.</span>
                  </div>
                ) : (
                  <div className="space-y-1.5 text-xs">
                    {breakdownList
                      .filter((r) => r.shortage > 0)
                      .map((r) => (
                        <div key={r.item.id} className="flex justify-between text-zinc-700 bg-white p-2 rounded border border-zinc-200">
                          <span>Lacking {r.shortage}x {r.item.name} @ ₱{r.rate.toFixed(2)}:</span>
                          <span className="font-mono font-semibold text-zinc-900">+₱{r.charge.toFixed(2)}</span>
                        </div>
                      ))}
                  </div>
                )}

                {totalEmptiesCredit > 0 && (
                  <div className="flex justify-between text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200 text-xs font-medium">
                    <span>Extra Empties Credit:</span>
                    <span className="font-mono">-₱{totalEmptiesCredit.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-zinc-200 text-sm font-bold">
                  <span className="text-zinc-900">Total Payable:</span>
                  <span className="font-mono text-base font-bold text-zinc-900">₱{netTotalPayable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(3)} className="w-1/3">
              Back
            </Button>
            <Button
              disabled={submitting}
              onClick={handleConfirmDelivery}
              className="w-2/3 gap-1.5"
            >
              <FileText className="w-4 h-4" />
              <span>{submitting ? 'Saving...' : 'Confirm & Save Delivery'}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Printable Billing Statement Preview Modal */}
      <Dialog
        open={isPreviewModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsPreviewModalOpen(false);
            setStep(1);
            setCart(new Map());
            setSelectedStore(null);
            fetchDeliveryData();
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
              <DialogTitle>Delivery Recorded</DialogTitle>
            </div>
            <DialogDescription>
              Transaction has been committed to the ledger.
            </DialogDescription>
          </DialogHeader>

          {/* Official Printable Billing Statement Document */}
          <div className="bg-white text-zinc-900 p-4 rounded-lg space-y-3 font-sans text-xs border border-zinc-200">
            {/* Distributor Header */}
            <div className="text-center border-b border-zinc-200 pb-2">
              <h2 className="text-sm font-bold uppercase tracking-tight text-zinc-900">{tenant?.name || 'BEVERAGE DISTRIBUTION SYSTEM'}</h2>
              <p className="text-[10px] text-zinc-500">Delivery & Container Deposit Billing Statement</p>
              <span className="inline-block mt-0.5 text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 bg-zinc-100 rounded text-zinc-600">
                STATEMENT OF ACCOUNT
              </span>
            </div>

            {/* Statement Details */}
            <div className="grid grid-cols-2 gap-2 text-[10px] bg-zinc-50 p-2 rounded border border-zinc-200">
              <div>
                <span className="text-zinc-500 block uppercase font-bold text-[8px]">STORE</span>
                <span className="font-semibold text-zinc-900 block text-xs">{selectedStore?.store_name}</span>
                <span className="text-zinc-500 font-mono">Code: {selectedStore?.store_code}</span>
              </div>
              <div className="text-right">
                <span className="text-zinc-500 block uppercase font-bold text-[8px]">STATEMENT #</span>
                <span className="font-mono font-bold text-zinc-900 text-xs block">{saleRecord?.sale_number || `STMT-${Date.now().toString().slice(-6)}`}</span>
                <span className="text-zinc-500">{new Date().toLocaleDateString()}</span>
              </div>
            </div>

            {/* Delivered Products Table */}
            <div>
              <h4 className="font-bold text-[9px] uppercase tracking-wider text-zinc-700 mb-1">1. Delivered Products</h4>
              <table className="w-full text-left text-[10px] border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-500 font-semibold uppercase text-[8px]">
                    <th className="py-1">Product</th>
                    <th className="py-1 text-center">Cases</th>
                    <th className="py-1 text-right">Price</th>
                    <th className="py-1 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {Array.from(cart.values()).map((c, i) => (
                    <tr key={i}>
                      <td className="py-1 font-medium">{c.product.name}</td>
                      <td className="py-1 text-center font-mono">{c.qtyCases} cs</td>
                      <td className="py-1 text-right font-mono">₱{c.casePrice.toFixed(2)}</td>
                      <td className="py-1 text-right font-mono font-semibold">₱{(c.qtyCases * c.casePrice).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Empties Returned Table */}
            {returnedItemsList.length > 0 && (
              <div>
                <h4 className="font-bold text-[9px] uppercase tracking-wider text-zinc-700 mb-1">2. Returned Empties</h4>
                <table className="w-full text-left text-[10px] border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 text-zinc-500 font-semibold uppercase text-[8px]">
                      <th className="py-1">Container</th>
                      <th className="py-1 text-center">Qty</th>
                      <th className="py-1 text-right">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {returnedItemsList.map((r, i) => (
                      <tr key={i}>
                        <td className="py-1 font-medium">{r.item.name}</td>
                        <td className="py-1 text-center font-mono">{r.returnedQty} {r.item.unit || 'pcs'}</td>
                        <td className="py-1 text-right font-mono">₱{r.rate.toFixed(2)} / {r.item.unit || 'pc'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Net Amount Summary */}
            <div className="border-t border-zinc-900 pt-2 space-y-1 text-[11px] font-medium">
              <div className="flex justify-between text-zinc-600">
                <span>Product Subtotal:</span>
                <span className="font-mono font-semibold text-zinc-900">₱{cartTotal.toFixed(2)}</span>
              </div>
              {netPundoDepositDue > 0 && (
                <div className="flex justify-between text-zinc-600">
                  <span>Lacking Container Deposit:</span>
                  <span className="font-mono font-semibold text-zinc-900">+₱{netPundoDepositDue.toFixed(2)}</span>
                </div>
              )}
              {totalEmptiesCredit > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Surplus Empties Credit:</span>
                  <span className="font-mono">-₱{totalEmptiesCredit.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-zinc-900 pt-1 border-t border-zinc-200">
                <span>Net Total Paid:</span>
                <span className="font-mono text-base">₱{netTotalPayable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setIsPreviewModalOpen(false);
                setStep(1);
                setCart(new Map());
                setSelectedStore(null);
                fetchDeliveryData();
              }}
            >
              Done & Return
            </Button>
            <Button onClick={() => window.print()} className="gap-1.5">
              <Printer className="w-4 h-4" />
              <span>Print Statement</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
