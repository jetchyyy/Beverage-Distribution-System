import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useModal } from '../../context/ModalContext';
import type { Product, ProductBatch, ProductPackaging, ProductPrice, Truck, Agent, AdjustmentReason } from '../../types/database.types';
import { Plus, AlertTriangle, Layers, Calendar, Printer, ChevronDown, ChevronRight, Package, RotateCcw, Truck as TruckIcon, User, ShieldCheck, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';

export const WarehousePage: React.FC = () => {
  const { tenant } = useTenant();
  const { showError, showSuccess } = useModal();

  const [activeTab, setActiveTab] = useState<'OVERALL_SKU' | 'FIFO_BATCHES' | 'TRUCK_FLEET' | 'RETURNABLES'>('OVERALL_SKU');
  const [products, setProducts] = useState<Product[]>([]);
  const [packagings, setPackagings] = useState<ProductPackaging[]>([]);
  const [prices, setPrices] = useState<ProductPrice[]>([]);
  const [inventoryBalances, setInventoryBalances] = useState<any[]>([]);
  const [returnableBalances, setReturnableBalances] = useState<any[]>([]);
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [containerLocFilter, setContainerLocFilter] = useState<string>('ALL');

  // Accordion Expand State for Overall Inventory View & Trucks View
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set());
  const [expandedTruckIds, setExpandedTruckIds] = useState<Set<string>>(new Set());

  // Modals
  const [isStockInModalOpen, setIsStockInModalOpen] = useState(false);
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [printingBatch, setPrintingBatch] = useState<{ batch: ProductBatch; product: Product } | null>(null);

  // Stock In Form State (Receiving New Batch)
  const [stockInProductId, setStockInProductId] = useState('');
  const [stockInBatchNum, setStockInBatchNum] = useState('');
  const [stockInMfgDate, setStockInMfgDate] = useState('');
  const [stockInExpDate, setStockInExpDate] = useState('');
  const [stockInCases, setStockInCases] = useState<number>(50);

  // Adjustment Form State
  const [selectedProdId, setSelectedProdId] = useState('');
  const [deltaQty, setDeltaQty] = useState(0);
  const [adjReason, setAdjReason] = useState<AdjustmentReason>('COUNTING_ERROR');
  const [adjNotes, setAdjNotes] = useState('');
  const [savingAdj, setSavingAdj] = useState(false);
  const [savingStockIn, setSavingStockIn] = useState(false);

  const fetchInventoryData = async () => {
    if (!tenant) return;
    try {
      const [
        prodsRes,
        packsRes,
        prcsRes,
        invsRes,
        retsRes,
        btchsRes,
        trksRes,
        agtsRes,
      ] = await Promise.all([
        supabase.from('products').select('*').eq('tenant_id', tenant.id).order('name'),
        supabase.from('product_packaging').select('*').eq('tenant_id', tenant.id),
        supabase.from('product_prices').select('*').eq('tenant_id', tenant.id),
        supabase
          .from('inventory_balances')
          .select('*, products(name, sku, category, base_unit), locations(name, type)')
          .eq('tenant_id', tenant.id),
        supabase
          .from('returnable_balances')
          .select('*, returnable_items(name, type, pundo_value, unit, deposit_rate, item_type), locations(name, type)')
          .eq('tenant_id', tenant.id),
        supabase
          .from('product_batches')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('expiry_date', { ascending: true }),
        supabase.from('trucks').select('*').eq('tenant_id', tenant.id),
        supabase.from('agents').select('*').eq('tenant_id', tenant.id),
      ]);

      setProducts(prodsRes.data || []);
      setPackagings(packsRes.data || []);
      setPrices(prcsRes.data || []);
      setInventoryBalances(invsRes.data || []);
      setReturnableBalances(retsRes.data || []);
      setBatches(btchsRes.data || []);
      setTrucks(trksRes.data || []);
      setAgents(agtsRes.data || []);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    }
  };

  useEffect(() => {
    fetchInventoryData();
  }, [tenant]);

  const toggleExpandProduct = (productId: string) => {
    setExpandedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const toggleExpandTruck = (truckId: string) => {
    setExpandedTruckIds((prev) => {
      const next = new Set(prev);
      if (next.has(truckId)) next.delete(truckId);
      else next.add(truckId);
      return next;
    });
  };

  const openStockInModal = (productId?: string) => {
    const targetProd = productId || (products.length > 0 ? products[0].id : '');
    setStockInProductId(targetProd);

    const today = new Date();
    const nextYear = new Date(today);
    nextYear.setFullYear(today.getFullYear() + 1);

    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');

    setStockInBatchNum(`LOT-${y}${m}-${Math.floor(1000 + Math.random() * 9000)}`);
    setStockInMfgDate(today.toISOString().split('T')[0]);
    setStockInExpDate(nextYear.toISOString().split('T')[0]);
    setStockInCases(50);
    setIsStockInModalOpen(true);
  };

  const handleStockInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !stockInProductId || !stockInBatchNum || !stockInExpDate) return;

    setSavingStockIn(true);
    try {
      const { data: newBatch, error: bErr } = await supabase
        .from('product_batches')
        .insert([
          {
            tenant_id: tenant.id,
            product_id: stockInProductId,
            batch_number: stockInBatchNum.toUpperCase().trim(),
            manufacture_date: stockInMfgDate || null,
            expiry_date: stockInExpDate,
            initial_quantity: Number(stockInCases),
            remaining_quantity: Number(stockInCases),
            unit: 'case',
            status: 'ACTIVE',
          },
        ])
        .select()
        .single();

      if (bErr) throw bErr;

      let { data: whLoc } = await supabase
        .from('locations')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('type', 'WAREHOUSE')
        .limit(1)
        .single();

      if (!whLoc) {
        const { data: newLoc } = await supabase
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
        whLoc = newLoc;
      }

      if (whLoc) {
        const existingInv = inventoryBalances.find(
          (b) => b.product_id === stockInProductId && b.location_id === whLoc.id
        );

        if (existingInv) {
          await supabase
            .from('inventory_balances')
            .update({
              quantity: Number(existingInv.quantity) + Number(stockInCases),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingInv.id);
        } else {
          await supabase.from('inventory_balances').insert([
            {
              tenant_id: tenant.id,
              location_id: whLoc.id,
              product_id: stockInProductId,
              quantity: Number(stockInCases),
              unit: 'case',
            },
          ]);
        }
      }

      setIsStockInModalOpen(false);
      await fetchInventoryData();
      showSuccess({ title: 'Stock-In Complete', description: 'Batch recorded and added to warehouse inventory.' });

      const targetProd = products.find((p) => p.id === stockInProductId);
      if (newBatch && targetProd) {
        setPrintingBatch({ batch: newBatch, product: targetProd });
      }
    } catch (err: any) {
      showError({ title: 'Stock-In Failed', description: err.message || 'Failed to complete stock-in.' });
    } finally {
      setSavingStockIn(false);
    }
  };

  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !selectedProdId || deltaQty === 0) return;

    setSavingAdj(true);
    try {
      const whLoc = inventoryBalances.find((b) => b.locations?.type === 'WAREHOUSE')?.location_id;
      if (!whLoc) throw new Error('Warehouse location not found');

      const existingInv = inventoryBalances.find((b) => b.product_id === selectedProdId && b.location_id === whLoc);

      if (existingInv) {
        const newQty = Math.max(0, Number(existingInv.quantity) + Number(deltaQty));
        await supabase
          .from('inventory_balances')
          .update({ quantity: newQty, updated_at: new Date().toISOString() })
          .eq('id', existingInv.id);
      }

      if (deltaQty < 0) {
        let remainingToDeduct = Math.abs(deltaQty);
        const prodBatches = batches.filter((b) => b.product_id === selectedProdId && Number(b.remaining_quantity || 0) > 0);
        for (const b of prodBatches) {
          if (remainingToDeduct <= 0) break;
          const curQty = Number(b.remaining_quantity || 0);
          if (curQty <= remainingToDeduct) {
            remainingToDeduct -= curQty;
            await supabase.from('product_batches').update({ remaining_quantity: 0, status: 'DEPLETED' }).eq('id', b.id);
          } else {
            const newQty = curQty - remainingToDeduct;
            remainingToDeduct = 0;
            await supabase.from('product_batches').update({ remaining_quantity: newQty }).eq('id', b.id);
          }
        }
      } else if (deltaQty > 0) {
        const prodBatches = batches.filter((b) => b.product_id === selectedProdId);
        if (prodBatches.length > 0) {
          const targetBatch = prodBatches[prodBatches.length - 1];
          const newQty = Number(targetBatch.remaining_quantity || 0) + Number(deltaQty);
          await supabase.from('product_batches').update({ remaining_quantity: newQty, status: 'ACTIVE' }).eq('id', targetBatch.id);
        }
      }

      setIsAdjModalOpen(false);
      setSelectedProdId('');
      setDeltaQty(0);
      setAdjNotes('');
      fetchInventoryData();
      showSuccess({ title: 'Adjustment Recorded', description: 'Inventory balances have been successfully adjusted.' });
    } catch (err: any) {
      showError({ title: 'Adjustment Failed', description: err.message || 'Failed to record stock adjustment.' });
    } finally {
      setSavingAdj(false);
    }
  };

  const overallSkuSummaries = products.map((p) => {
    const prodBatches = batches.filter((b) => b.product_id === p.id);
    const prodPack = packagings.find((pk) => pk.product_id === p.id);
    const prodPrice = prices.find((pr) => pr.packaging_id === prodPack?.id) || prices.find((pr) => pr.product_id === p.id);

    const unitsPerCase = prodPack?.units_per_package || 24;
    const casePrice = prodPrice?.case_price || prodPrice?.price || 0;

    const inv = inventoryBalances.find((b) => b.product_id === p.id && b.locations?.type === 'WAREHOUSE');
    let totalCases = Number(inv?.quantity ?? -1);

    if (totalCases < 0) {
      totalCases = 0;
      prodBatches.forEach((b) => {
        totalCases += Number(b.remaining_quantity || 0);
      });
    }

    const totalBottles = totalCases * unitsPerCase;
    const totalValue = totalCases * casePrice;
    const earliestExpiry = prodBatches.length > 0 ? prodBatches[0].expiry_date : 'N/A';

    return {
      product: p,
      prodPack,
      prodPrice,
      prodBatches,
      totalCases,
      totalBottles,
      totalValue,
      earliestExpiry,
    };
  });

  const truckFleetSummaries = trucks.map((trk) => {
    const assignedAgent = agents.find((a) => a.assigned_truck_id === trk.id);
    const truckItems = inventoryBalances.filter((inv) => inv.location_id === trk.location_id && Number(inv.quantity) > 0);

    let totalTruckCases = 0;
    let totalTruckValuation = 0;

    const loadedItemsBreakdown = truckItems.map((inv) => {
      const p = products.find((prod) => prod.id === inv.product_id);
      const pack = packagings.find((pk) => pk.product_id === inv.product_id);
      const prc = prices.find((pr) => pr.product_id === inv.product_id);

      const qtyCases = Number(inv.quantity || 0);
      const casePrice = Number(prc?.case_price || prc?.price || 0);
      const bottleCount = qtyCases * Number(pack?.units_per_package || 24);
      const itemValuation = qtyCases * casePrice;

      totalTruckCases += qtyCases;
      totalTruckValuation += itemValuation;

      return {
        product: p,
        qtyCases,
        bottleCount,
        casePrice,
        itemValuation,
      };
    });

    return {
      truck: trk,
      assignedAgent,
      totalTruckCases,
      totalTruckValuation,
      loadedItemsBreakdown,
    };
  });

  const grandTotalWarehouseCases = overallSkuSummaries.reduce((sum, item) => sum + item.totalCases, 0);
  const grandTotalWarehouseValue = overallSkuSummaries.reduce((sum, item) => sum + item.totalValue, 0);
  const grandTotalTruckCases = truckFleetSummaries.reduce((sum, item) => sum + item.totalTruckCases, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900">Main Depot Warehouse Inventory</h1>
          <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">Overall SKU inventory breakdown, truck fleet inventory & stock management</p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdjModalOpen(true)}
            className="flex items-center space-x-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-zinc-700" />
            <span>Stock Adjustment</span>
          </Button>

          <Button
            size="sm"
            onClick={() => openStockInModal()}
            className="flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Stock In Batch</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-zinc-500 uppercase font-medium">Depot Cases</span>
            <div className="text-xl font-bold text-zinc-900">
              {grandTotalWarehouseCases.toLocaleString()} <span className="text-xs text-zinc-500 font-normal">cases</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-zinc-500 uppercase font-medium">Trucks Fleet Cases</span>
            <div className="text-xl font-bold text-zinc-900">
              {grandTotalTruckCases.toLocaleString()} <span className="text-xs text-zinc-500 font-normal">cases</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-zinc-500 uppercase font-medium">Depot Valuation</span>
            <div className="text-xl font-bold text-zinc-900">
              ₱{grandTotalWarehouseValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-zinc-500 uppercase font-medium">FIFO Batches</span>
            <div className="text-xl font-bold text-zinc-900">
              {batches.length} <span className="text-xs text-zinc-500 font-normal">lots</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center space-x-1.5 border-b border-zinc-200 pb-2 overflow-x-auto">
        <Button
          variant={activeTab === 'OVERALL_SKU' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('OVERALL_SKU')}
          className="text-xs shrink-0"
        >
          <Layers className="w-3.5 h-3.5 mr-1" />
          <span>Overall Inventory</span>
        </Button>

        <Button
          variant={activeTab === 'TRUCK_FLEET' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('TRUCK_FLEET')}
          className="text-xs shrink-0"
        >
          <TruckIcon className="w-3.5 h-3.5 mr-1" />
          <span>Trucks Fleet ({trucks.length})</span>
        </Button>

        <Button
          variant={activeTab === 'FIFO_BATCHES' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('FIFO_BATCHES')}
          className="text-xs shrink-0"
        >
          <Calendar className="w-3.5 h-3.5 mr-1" />
          <span>FIFO Batches ({batches.length})</span>
        </Button>

        <Button
          variant={activeTab === 'RETURNABLES' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('RETURNABLES')}
          className="text-xs shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          <span>Empty Containers</span>
        </Button>
      </div>

      {/* Tab 1: Overall SKU Inventory */}
      {activeTab === 'OVERALL_SKU' && (
        <Card className="overflow-hidden">
          <div className="p-3.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Package className="w-4 h-4 text-zinc-700" />
              <h3 className="font-semibold text-zinc-900 text-sm">Product Inventory & Batch Breakdown</h3>
            </div>
            <span className="text-xs text-zinc-500">Click SKU row to view batches</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-zinc-700">
              <thead className="bg-zinc-50 text-zinc-500 uppercase text-[11px] font-medium tracking-wider border-b border-zinc-200">
                <tr>
                  <th className="w-8 px-3 py-3"></th>
                  <th className="px-4 py-3">Product SKU & Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Total Cases</th>
                  <th className="px-4 py-3">Total Bottles</th>
                  <th className="px-4 py-3">Earliest Expiry</th>
                  <th className="px-4 py-3 text-right">Valuation</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {overallSkuSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-zinc-400 text-sm">
                      No product SKUs registered yet.
                    </td>
                  </tr>
                ) : (
                  overallSkuSummaries.map(({ product, prodBatches, totalCases, totalBottles, totalValue, earliestExpiry }) => {
                    const isExpanded = expandedProductIds.has(product.id);

                    return (
                      <React.Fragment key={product.id}>
                        <tr
                          onClick={() => toggleExpandProduct(product.id)}
                          className="hover:bg-zinc-50 cursor-pointer transition-colors"
                        >
                          <td className="px-3 py-3 text-zinc-400 text-center">
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-900" /> : <ChevronRight className="w-4 h-4" />}
                          </td>
                          <td className="px-4 py-3 font-medium text-zinc-900">
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-zinc-900">{product.name}</span>
                              <Badge variant="outline" className="font-mono text-[10px]">
                                {product.sku}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="text-[10px]">
                              {product.category}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-semibold text-zinc-900">
                            {totalCases.toLocaleString()} <span className="text-xs text-zinc-500 font-normal">cs</span>
                          </td>
                          <td className="px-4 py-3 text-zinc-600">
                            {totalBottles.toLocaleString()} btls
                          </td>
                          <td className="px-4 py-3 font-mono text-zinc-700 text-xs">
                            {earliestExpiry}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                            ₱{totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                openStockInModal(product.id);
                              }}
                              className="h-7 text-xs"
                            >
                              + Stock In
                            </Button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan={8} className="bg-zinc-50 p-4 border-t border-b border-zinc-200">
                              <div className="space-y-3 pl-6 pr-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2 text-xs font-semibold text-zinc-800">
                                    <Calendar className="w-3.5 h-3.5 text-zinc-600" />
                                    <span>Batches for {product.name} ({prodBatches.length} lots)</span>
                                  </div>
                                  <button
                                    onClick={() => openStockInModal(product.id)}
                                    className="text-xs text-zinc-900 font-medium hover:underline cursor-pointer"
                                  >
                                    + Receive New Batch
                                  </button>
                                </div>

                                {prodBatches.length === 0 ? (
                                  <div className="p-3 bg-white border border-zinc-200 rounded-md text-center text-zinc-400 text-xs">
                                    No batch lot records found. Click + Stock In to receive stock.
                                  </div>
                                ) : (
                                  <div className="bg-white rounded-md border border-zinc-200 overflow-hidden">
                                    <table className="w-full text-left text-xs text-zinc-700">
                                      <thead className="bg-zinc-50 text-zinc-500 uppercase font-mono border-b border-zinc-200 text-[10px]">
                                        <tr>
                                          <th className="px-3 py-2">FIFO Rank</th>
                                          <th className="px-3 py-2">Batch / Lot #</th>
                                          <th className="px-3 py-2">Mfg Date</th>
                                          <th className="px-3 py-2">Expiry Date</th>
                                          <th className="px-3 py-2">Remaining</th>
                                          <th className="px-3 py-2 text-right">Action</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-zinc-100">
                                        {prodBatches.map((b: ProductBatch, idx: number) => {
                                          const expDateObj = new Date(b.expiry_date);
                                          const todayObj = new Date();
                                          const diffDays = Math.ceil((expDateObj.getTime() - todayObj.getTime()) / (1000 * 3600 * 24));
                                          const isExpiringSoon = diffDays <= 30;

                                          return (
                                            <tr key={b.id} className="hover:bg-zinc-50">
                                              <td className="px-3 py-2">
                                                {idx === 0 ? (
                                                  <Badge variant="default" className="text-[9px]">
                                                    FIFO #1 (Dispatch First)
                                                  </Badge>
                                                ) : (
                                                  <span className="text-zinc-500 font-mono">Lot #{idx + 1}</span>
                                                )}
                                              </td>
                                              <td className="px-3 py-2 font-mono font-medium text-zinc-900">{b.batch_number}</td>
                                              <td className="px-3 py-2 font-mono text-zinc-500">{b.manufacture_date || 'N/A'}</td>
                                              <td className="px-3 py-2 font-mono font-medium">
                                                <span className={isExpiringSoon ? 'text-red-600' : 'text-zinc-900'}>
                                                  {b.expiry_date}
                                                </span>
                                                {isExpiringSoon && (
                                                  <Badge variant="destructive" className="ml-1.5 text-[9px]">
                                                    {diffDays}d left
                                                  </Badge>
                                                )}
                                              </td>
                                              <td className="px-3 py-2 font-mono font-semibold text-zinc-900">
                                                {b.remaining_quantity} cs
                                              </td>
                                              <td className="px-3 py-2 text-right">
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => setPrintingBatch({ batch: b, product })}
                                                  className="h-6 px-2 text-xs ml-auto"
                                                >
                                                  <Printer className="w-3 h-3 mr-1" />
                                                  <span>Label</span>
                                                </Button>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 2: Agent Trucks Fleet Inventory */}
      {activeTab === 'TRUCK_FLEET' && (
        <Card className="overflow-hidden">
          <div className="p-3.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TruckIcon className="w-4 h-4 text-zinc-700" />
              <h3 className="font-semibold text-zinc-900 text-sm">Delivery Trucks Loaded Stock</h3>
            </div>
            <span className="text-xs text-zinc-500">Live inventory from transfers</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-zinc-700">
              <thead className="bg-zinc-50 text-zinc-500 uppercase text-[11px] font-medium tracking-wider border-b border-zinc-200">
                <tr>
                  <th className="w-8 px-3 py-3"></th>
                  <th className="px-4 py-3">Truck Code & Plate</th>
                  <th className="px-4 py-3">Assigned Agent</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Loaded Stock</th>
                  <th className="px-4 py-3 text-right">Loaded Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {truckFleetSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-400 text-sm">
                      No trucks registered in fleet.
                    </td>
                  </tr>
                ) : (
                  truckFleetSummaries.map(({ truck, assignedAgent, totalTruckCases, totalTruckValuation, loadedItemsBreakdown }) => {
                    const isExpanded = expandedTruckIds.has(truck.id);

                    return (
                      <React.Fragment key={truck.id}>
                        <tr
                          onClick={() => toggleExpandTruck(truck.id)}
                          className="hover:bg-zinc-50 cursor-pointer transition-colors"
                        >
                          <td className="px-3 py-3 text-zinc-400 text-center">
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-900" /> : <ChevronRight className="w-4 h-4" />}
                          </td>
                          <td className="px-4 py-3 font-semibold text-zinc-900">
                            <div className="flex items-center space-x-2">
                              <TruckIcon className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                              <span>{truck.truck_code}</span>
                              <Badge variant="outline" className="font-mono text-[10px]">
                                {truck.plate_number}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            <div className="flex items-center space-x-1.5">
                              <User className="w-3.5 h-3.5 text-zinc-400" />
                              <span>{assignedAgent?.full_name || 'Unassigned'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="text-[10px]">
                              {truck.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-semibold text-zinc-900">
                            {totalTruckCases.toLocaleString()} <span className="text-xs text-zinc-500 font-normal">cs</span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                            ₱{totalTruckValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan={6} className="bg-zinc-50 p-4 border-t border-b border-zinc-200">
                              <div className="space-y-3 pl-6 pr-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2 text-xs font-semibold text-zinc-800">
                                    <ShieldCheck className="w-3.5 h-3.5 text-zinc-600" />
                                    <span>Stock Breakdown for {truck.truck_code} ({loadedItemsBreakdown.length} items)</span>
                                  </div>
                                  <Link to="/admin/transfers" className="text-xs text-zinc-900 font-medium hover:underline">
                                    + Stock Transfer →
                                  </Link>
                                </div>

                                {loadedItemsBreakdown.length === 0 ? (
                                  <div className="p-3 bg-white border border-zinc-200 rounded-md text-center text-zinc-400 text-xs">
                                    No stock currently loaded on this truck.
                                  </div>
                                ) : (
                                  <div className="bg-white rounded-md border border-zinc-200 overflow-hidden">
                                    <table className="w-full text-left text-xs text-zinc-700">
                                      <thead className="bg-zinc-50 text-zinc-500 uppercase font-mono border-b border-zinc-200 text-[10px]">
                                        <tr>
                                          <th className="px-3 py-2">Product</th>
                                          <th className="px-3 py-2">Loaded Cases</th>
                                          <th className="px-3 py-2">Bottle Count</th>
                                          <th className="px-3 py-2">Case Price</th>
                                          <th className="px-3 py-2 text-right">Value</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-zinc-100">
                                        {loadedItemsBreakdown.map((item, idx) => (
                                          <tr key={idx} className="hover:bg-zinc-50">
                                            <td className="px-3 py-2 font-medium text-zinc-900">
                                              {item.product?.name || 'Beverage Item'} ({item.product?.sku})
                                            </td>
                                            <td className="px-3 py-2 font-mono font-semibold text-zinc-900">
                                              {item.qtyCases} cs
                                            </td>
                                            <td className="px-3 py-2 font-mono text-zinc-500">
                                              {item.bottleCount.toLocaleString()} btls
                                            </td>
                                            <td className="px-3 py-2 font-mono text-zinc-700">
                                              ₱{item.casePrice.toFixed(2)} / cs
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono font-semibold text-zinc-900">
                                              ₱{item.itemValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 3: FIFO Batches */}
      {activeTab === 'FIFO_BATCHES' && (
        <Card className="overflow-hidden">
          <div className="p-3.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-zinc-700" />
              <h3 className="font-semibold text-zinc-900 text-sm">FIFO Expiration Master Lot Directory</h3>
            </div>
            <span className="text-xs text-zinc-500">Sorted by Earliest Expiration</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-zinc-700">
              <thead className="bg-zinc-50 text-zinc-500 uppercase text-[11px] font-medium tracking-wider border-b border-zinc-200">
                <tr>
                  <th className="px-4 py-3">Batch Number</th>
                  <th className="px-4 py-3">Product SKU & Name</th>
                  <th className="px-4 py-3">Mfg Date</th>
                  <th className="px-4 py-3">Expiry Date</th>
                  <th className="px-4 py-3">Remaining Cases</th>
                  <th className="px-4 py-3 text-right">Label</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-400 text-sm">
                      No active FIFO batch lots recorded.
                    </td>
                  </tr>
                ) : (
                  batches.map((b) => {
                    const prod = products.find((p) => p.id === b.product_id);
                    const expDateObj = new Date(b.expiry_date);
                    const todayObj = new Date();
                    const diffDays = Math.ceil((expDateObj.getTime() - todayObj.getTime()) / (1000 * 3600 * 24));
                    const isExpiringSoon = diffDays <= 30;

                    return (
                      <tr key={b.id} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-4 py-3 font-mono font-medium text-zinc-900">{b.batch_number}</td>
                        <td className="px-4 py-3 font-medium text-zinc-900">
                          {prod?.name || 'Unknown Product'} ({prod?.sku})
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-500">{b.manufacture_date || 'N/A'}</td>
                        <td className="px-4 py-3 font-mono font-medium">
                          <span className={isExpiringSoon ? 'text-red-600' : 'text-zinc-900'}>{b.expiry_date}</span>
                          {isExpiringSoon && (
                            <Badge variant="destructive" className="ml-1.5 text-[9px]">
                              {diffDays}d left
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-zinc-900">
                          {b.remaining_quantity} cs
                        </td>
                        <td className="px-4 py-3 text-right">
                          {prod && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPrintingBatch({ batch: b, product: prod })}
                              className="h-7 text-xs"
                            >
                              <Printer className="w-3.5 h-3.5 mr-1 text-zinc-600" />
                              <span>Print</span>
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 4: Empty Containers */}
      {activeTab === 'RETURNABLES' && (() => {
        // Group by unique container item: normalized name + item_type
        const consolidatedMap = new Map<string, {
          id: string;
          name: string;
          itemType: string;
          unit: string;
          pundoRate: number;
          depotQty: number;
          trucksQty: number;
          totalQty: number;
          trucksBreakdown: { locationName: string; qty: number }[];
        }>();

        (returnableBalances || []).forEach((rb) => {
          const rawName = rb.returnable_items?.name || 'Returnable Container';
          const cleanName = rawName.trim();
          const itemType = (rb.returnable_items?.item_type || rb.returnable_items?.type || 'CONTAINER').toUpperCase();
          const unit = rb.returnable_items?.unit || (itemType === 'CASE' ? 'case' : 'bottle');
          const pundoRate = Number(rb.returnable_items?.pundo_value || rb.returnable_items?.deposit_rate || 0);
          const qty = Number(rb.quantity || 0);

          const isWarehouse = !rb.locations || rb.locations?.type === 'WAREHOUSE';
          const locName = isWarehouse ? 'Main Warehouse Depot' : (rb.locations?.name || 'Truck');

          // Location filtering check
          if (containerLocFilter === 'WAREHOUSE' && !isWarehouse) return;
          if (containerLocFilter !== 'ALL' && containerLocFilter !== 'WAREHOUSE' && rb.location_id !== containerLocFilter) return;

          const key = `${cleanName.toLowerCase()}__${itemType}`;

          if (!consolidatedMap.has(key)) {
            consolidatedMap.set(key, {
              id: rb.returnable_item_id || rb.id,
              name: cleanName,
              itemType,
              unit,
              pundoRate,
              depotQty: isWarehouse ? qty : 0,
              trucksQty: !isWarehouse ? qty : 0,
              totalQty: qty,
              trucksBreakdown: !isWarehouse && qty > 0 ? [{ locationName: locName, qty }] : [],
            });
          } else {
            const existing = consolidatedMap.get(key)!;
            if (isWarehouse) {
              existing.depotQty += qty;
            } else {
              existing.trucksQty += qty;
              if (qty > 0) {
                existing.trucksBreakdown.push({ locationName: locName, qty });
              }
            }
            existing.totalQty += qty;
            if (existing.pundoRate === 0 && pundoRate > 0) {
              existing.pundoRate = pundoRate;
            }
          }
        });

        const consolidatedList = Array.from(consolidatedMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name)
        );

        // Overall Depot KPI calculations (always based on warehouse stock)
        let totalWarehouseBottles = 0;
        let totalWarehouseShellCases = 0;

        (returnableBalances || []).forEach((rb) => {
          const isWh = !rb.locations || rb.locations?.type === 'WAREHOUSE';
          if (isWh) {
            const itemType = (rb.returnable_items?.item_type || rb.returnable_items?.type || 'BOTTLE').toUpperCase();
            if (itemType === 'BOTTLE') totalWarehouseBottles += Number(rb.quantity || 0);
            if (itemType === 'CASE') totalWarehouseShellCases += Number(rb.quantity || 0);
          }
        });

        const bottlesPerCase = 24;
        const fullEmptyCases = Math.min(Math.floor(totalWarehouseBottles / bottlesPerCase), totalWarehouseShellCases);
        const looseBottles = totalWarehouseBottles - (fullEmptyCases * bottlesPerCase);
        const looseShellCases = totalWarehouseShellCases - fullEmptyCases;

        return (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs font-semibold text-zinc-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5 text-zinc-700" />
                  <span>Depot Returnables Breakdown</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="bg-zinc-50 p-3 rounded-md border border-zinc-200">
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold block">Full Empty Cases (Sets)</span>
                    <span className="text-lg font-bold text-zinc-900 block mt-0.5">
                      {fullEmptyCases} <span className="text-xs text-zinc-500 font-normal">cases</span>
                    </span>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">
                      ({fullEmptyCases * bottlesPerCase} btls + {fullEmptyCases} crates)
                    </span>
                  </div>

                  <div className="bg-zinc-50 p-3 rounded-md border border-zinc-200">
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold block">Loose Bottles</span>
                    <span className="text-lg font-bold text-zinc-900 block mt-0.5">
                      {looseBottles} <span className="text-xs text-zinc-500 font-normal">bottles</span>
                    </span>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">Unpaired loose bottles</span>
                  </div>

                  <div className="bg-zinc-50 p-3 rounded-md border border-zinc-200">
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold block">Loose Crates</span>
                    <span className="text-lg font-bold text-zinc-900 block mt-0.5">
                      {looseShellCases} <span className="text-xs text-zinc-500 font-normal">cases</span>
                    </span>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">Empty crates without bottles</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-zinc-200 shadow-xs">
              <div className="p-3.5 bg-zinc-50 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <RotateCcw className="w-4 h-4 text-zinc-700" />
                  <h3 className="font-semibold text-zinc-900 text-sm">Container Balances</h3>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {consolidatedList.length} items
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 font-medium">Filter Location:</span>
                  <select
                    value={containerLocFilter}
                    onChange={(e) => setContainerLocFilter(e.target.value)}
                    className="bg-white border border-zinc-300 rounded-md px-2.5 py-1 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 cursor-pointer"
                  >
                    <option value="ALL">All Locations (Consolidated)</option>
                    <option value="WAREHOUSE">Main Warehouse Depot Only</option>
                    {trucks.map((t) => (
                      <option key={t.id} value={t.location_id || t.id}>
                        {t.truck_code} ({t.plate_number})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm text-zinc-700">
                  <thead className="bg-zinc-50 text-zinc-500 uppercase text-[11px] font-medium tracking-wider border-b border-zinc-200">
                    <tr>
                      <th className="px-4 py-3">Container Item</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Depot Stock</th>
                      <th className="px-4 py-3">Trucks Fleet</th>
                      <th className="px-4 py-3">Total Balances</th>
                      <th className="px-4 py-3">PUNDO Rate</th>
                      <th className="px-4 py-3 text-right">Total Valuation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 bg-white">
                    {consolidatedList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-zinc-400 text-xs">
                          No returnable containers found for the selected location filter.
                        </td>
                      </tr>
                    ) : (
                      consolidatedList.map((item) => {
                        const totalValuation = item.totalQty * item.pundoRate;

                        return (
                          <tr key={item.id} className="hover:bg-zinc-50 transition-colors">
                            <td className="px-4 py-3 font-semibold text-zinc-900">
                              {item.name}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="text-[10px]">
                                {item.itemType}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 font-mono text-zinc-800">
                              {item.depotQty.toLocaleString()} <span className="text-xs text-zinc-500 font-normal">{item.unit}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-zinc-700">
                                  {item.trucksQty.toLocaleString()} {item.unit}
                                </span>
                                {item.trucksBreakdown.length > 0 && (
                                  <div className="flex gap-1 flex-wrap">
                                    {item.trucksBreakdown.map((tb, idx) => (
                                      <Badge key={idx} variant="secondary" className="text-[9px] font-mono bg-zinc-100 text-zinc-600">
                                        {tb.locationName}: {tb.qty}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 font-bold text-zinc-900 font-mono">
                              {item.totalQty.toLocaleString()} <span className="text-xs text-zinc-500 font-normal">{item.unit}</span>
                            </td>
                            <td className="px-4 py-3 text-xs font-mono font-medium text-zinc-900">
                              ₱{item.pundoRate.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900">
                              ₱{totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        );
      })()}

      {/* Stock In Modal */}
      {isStockInModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-zinc-200 rounded-lg max-w-md w-full p-6 shadow-xl text-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3 mb-4">
              <div className="flex items-center space-x-2 font-semibold text-zinc-900">
                <Plus className="w-4 h-4" />
                <h3 className="text-base">Warehouse Stock In (Receive Batch)</h3>
              </div>
              <button onClick={() => setIsStockInModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStockInSubmit} className="space-y-4 text-sm">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">Select Product SKU *</label>
                <select
                  required
                  value={stockInProductId}
                  onChange={(e) => setStockInProductId(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-md px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-950 cursor-pointer"
                >
                  <option value="">Select product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">Batch / Lot Number *</label>
                <Input
                  type="text"
                  required
                  placeholder="LOT-202609-001"
                  value={stockInBatchNum}
                  onChange={(e) => setStockInBatchNum(e.target.value)}
                  className="font-mono uppercase text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-zinc-700">Manufacture Date</label>
                  <Input
                    type="date"
                    value={stockInMfgDate}
                    onChange={(e) => setStockInMfgDate(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-zinc-700">Expiration Date (FIFO) *</label>
                  <Input
                    type="date"
                    required
                    value={stockInExpDate}
                    onChange={(e) => setStockInExpDate(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">Received Cases Quantity *</label>
                <Input
                  type="number"
                  required
                  min={1}
                  value={stockInCases}
                  onChange={(e) => setStockInCases(Number(e.target.value))}
                  className="text-xs font-mono font-semibold"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-zinc-200">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsStockInModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={savingStockIn}>
                  {savingStockIn ? 'Saving...' : 'Receive Stock'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Stock Adjustment Modal */}
      {isAdjModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-zinc-200 rounded-lg max-w-md w-full p-6 shadow-xl text-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3 mb-4">
              <div className="flex items-center space-x-2 font-semibold text-zinc-900">
                <AlertTriangle className="w-4 h-4 text-zinc-700" />
                <h3 className="text-base">Manual Stock Adjustment</h3>
              </div>
              <button onClick={() => setIsAdjModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustment} className="space-y-4 text-sm">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">Select Product *</label>
                <select
                  required
                  value={selectedProdId}
                  onChange={(e) => setSelectedProdId(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-md px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-950 cursor-pointer"
                >
                  <option value="">Select product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-zinc-700">Quantity Change *</label>
                  <Input
                    type="number"
                    required
                    placeholder="+5 or -2"
                    value={deltaQty}
                    onChange={(e) => setDeltaQty(parseFloat(e.target.value) || 0)}
                    className="font-mono text-xs"
                  />
                  <span className="text-[10px] text-zinc-500">Positive to add, negative to deduct</span>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-zinc-700">Reason *</label>
                  <select
                    value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value as AdjustmentReason)}
                    className="w-full bg-white border border-zinc-300 rounded-md px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-950 cursor-pointer"
                  >
                    <option value="DAMAGED">DAMAGED</option>
                    <option value="BROKEN">BROKEN</option>
                    <option value="LOST">LOST</option>
                    <option value="COUNTING_ERROR">COUNTING ERROR</option>
                    <option value="SYSTEM_CORRECTION">SYSTEM CORRECTION</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">Notes / Explanation</label>
                <textarea
                  rows={2}
                  placeholder="Explain reason for adjustment..."
                  value={adjNotes}
                  onChange={(e) => setAdjNotes(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-md px-3 py-2 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-zinc-200 flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAdjModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingAdj}
                >
                  {savingAdj ? 'Applying...' : 'Apply Adjustment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Thermal Printable Batch Sticker Modal */}
      {printingBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-zinc-200 rounded-lg max-w-sm w-full p-6 shadow-xl text-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3 mb-4">
              <h3 className="text-sm font-semibold flex items-center space-x-2 text-zinc-900">
                <Printer className="w-4 h-4" />
                <span>Print Thermal Batch Label</span>
              </h3>
              <button onClick={() => setPrintingBatch(null)} className="text-zinc-400 hover:text-zinc-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-white text-black rounded-lg space-y-2 border-2 border-dashed border-zinc-400 font-sans">
              <div className="flex justify-between items-start border-b border-black pb-1.5">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-tight">{tenant?.name || 'BEVERAGE DISTRIBUTOR'}</div>
                  <div className="text-[9px] font-bold text-zinc-800 uppercase">{printingBatch.product.brand} • {printingBatch.product.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-mono font-bold bg-black text-white px-1.5 py-0.5 rounded">
                    {printingBatch.product.sku}
                  </div>
                </div>
              </div>

              <div className="py-1 grid grid-cols-2 gap-2 text-center bg-zinc-100 rounded border border-zinc-300">
                <div>
                  <span className="text-[8px] font-bold text-zinc-600 uppercase block">BATCH NUMBER</span>
                  <span className="text-xs font-mono font-black tracking-wider text-zinc-900">{printingBatch.batch.batch_number}</span>
                </div>
                <div>
                  <span className="text-[8px] font-bold text-zinc-600 uppercase block">CASES IN BATCH</span>
                  <span className="text-xs font-mono font-black text-zinc-900">{printingBatch.batch.remaining_quantity} CS</span>
                </div>
              </div>

              <div className="pt-1 flex justify-between items-center text-[10px]">
                <div>
                  <span className="text-[8px] font-bold text-zinc-500 block uppercase">MANUFACTURED</span>
                  <span className="font-mono font-bold">{printingBatch.batch.manufacture_date || 'N/A'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[8px] font-bold text-red-700 block uppercase">EXPIRATION (FIFO)</span>
                  <span className="font-mono font-black text-red-800 text-xs">{printingBatch.batch.expiry_date}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-300 text-center">
                <div className="h-8 bg-zinc-900 w-full flex items-center justify-center space-x-1 px-2 rounded-xs">
                  {[1, 2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 1, 4, 1].map((w, i) => (
                    <span key={i} className="bg-white h-full inline-block" style={{ width: `${w * 2}px` }} />
                  ))}
                </div>
                <span className="text-[8px] font-mono tracking-widest text-zinc-700 uppercase block mt-1">
                  *{printingBatch.batch.batch_number}*
                </span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t border-zinc-200 mt-4">
              <Button variant="outline" size="sm" onClick={() => setPrintingBatch(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => window.print()}
                className="flex items-center space-x-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Sticker</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
