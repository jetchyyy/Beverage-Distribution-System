import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import type { Product, ProductBatch, ProductPackaging, ProductPrice, Truck, Agent, AdjustmentReason } from '../../types/database.types';
import { Plus, AlertTriangle, Layers, Calendar, Printer, ChevronDown, ChevronRight, Package, RotateCcw, Truck as TruckIcon, User, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export const WarehousePage: React.FC = () => {
  const { tenant } = useTenant();

  const [activeTab, setActiveTab] = useState<'OVERALL_SKU' | 'FIFO_BATCHES' | 'TRUCK_FLEET' | 'RETURNABLES'>('OVERALL_SKU');
  const [products, setProducts] = useState<Product[]>([]);
  const [packagings, setPackagings] = useState<ProductPackaging[]>([]);
  const [prices, setPrices] = useState<ProductPrice[]>([]);
  const [inventoryBalances, setInventoryBalances] = useState<any[]>([]);
  const [returnableBalances, setReturnableBalances] = useState<any[]>([]);
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);

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
      const { data: prods } = await supabase.from('products').select('*').eq('tenant_id', tenant.id).order('name');
      setProducts(prods || []);

      const { data: packs } = await supabase.from('product_packaging').select('*').eq('tenant_id', tenant.id);
      setPackagings(packs || []);

      const { data: prcs } = await supabase.from('product_prices').select('*').eq('tenant_id', tenant.id);
      setPrices(prcs || []);

      const { data: invs } = await supabase
        .from('inventory_balances')
        .select('*, products(name, sku, category, base_unit), locations(name, type)')
        .eq('tenant_id', tenant.id);
      setInventoryBalances(invs || []);

      const { data: rets } = await supabase
        .from('returnable_balances')
        .select('*, returnable_items(name, type, pundo_value, unit)')
        .eq('tenant_id', tenant.id);
      setReturnableBalances(rets || []);

      const { data: btchs } = await supabase
        .from('product_batches')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('expiry_date', { ascending: true });
      setBatches(btchs || []);

      const { data: trks } = await supabase.from('trucks').select('*').eq('tenant_id', tenant.id);
      setTrucks(trks || []);

      const { data: agts } = await supabase.from('agents').select('*').eq('tenant_id', tenant.id);
      setAgents(agts || []);
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

      const targetProd = products.find((p) => p.id === stockInProductId);
      if (newBatch && targetProd) {
        setPrintingBatch({ batch: newBatch, product: targetProd });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to complete stock-in.');
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

      setIsAdjModalOpen(false);
      setSelectedProdId('');
      setDeltaQty(0);
      setAdjNotes('');
      fetchInventoryData();
    } catch (err: any) {
      alert(err.message || 'Adjustment failed');
    } finally {
      setSavingAdj(false);
    }
  };

  // Aggregated Overall SKU Summaries
  const overallSkuSummaries = products.map((p) => {
    const prodBatches = batches.filter((b) => b.product_id === p.id);
    const prodPack = packagings.find((pk) => pk.product_id === p.id);
    const prodPrice = prices.find((pr) => pr.packaging_id === prodPack?.id) || prices.find((pr) => pr.product_id === p.id);

    const unitsPerCase = prodPack?.units_per_package || 24;
    const casePrice = prodPrice?.case_price || prodPrice?.price || 0;

    let totalCases = 0;
    prodBatches.forEach((b) => {
      totalCases += Number(b.remaining_quantity || 0);
    });

    if (prodBatches.length === 0) {
      const inv = inventoryBalances.find((b) => b.product_id === p.id && b.locations?.type === 'WAREHOUSE');
      totalCases = Number(inv?.quantity || 0);
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

  // Calculate Truck Fleet Inventory Summaries
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Main Depot Warehouse Inventory</h1>
          <p className="text-slate-400 text-sm">Overall SKU inventory breakdown, truck fleet inventory & stock management</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsAdjModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold border border-slate-700 flex items-center space-x-2 transition-all"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Manual Stock Adjustment</span>
          </button>

          <button
            onClick={() => openStockInModal()}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center space-x-2 transition-all shadow-lg shadow-emerald-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>+ Stock In (Receive New Batch)</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Header */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-1">
          <span className="text-xs font-mono text-slate-400 uppercase">Warehouse Depot Cases</span>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {grandTotalWarehouseCases.toLocaleString()} <span className="text-sm text-slate-500">cases</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-1">
          <span className="text-xs font-mono text-slate-400 uppercase">Loaded on Trucks Fleet</span>
          <div className="text-2xl font-black text-cyan-400 font-mono">
            {grandTotalTruckCases.toLocaleString()} <span className="text-sm text-slate-500">cases</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-1">
          <span className="text-xs font-mono text-slate-400 uppercase">Depot Asset Valuation</span>
          <div className="text-2xl font-black text-indigo-400 font-mono">
            ₱{grandTotalWarehouseValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-1">
          <span className="text-xs font-mono text-slate-400 uppercase">Active FIFO Batch Lots</span>
          <div className="text-2xl font-black text-amber-400 font-mono">
            {batches.length} <span className="text-sm text-slate-500">batches</span>
          </div>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('OVERALL_SKU')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 ${
            activeTab === 'OVERALL_SKU'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Overall Inventory (SKU Breakdown & Batches)</span>
        </button>

        <button
          onClick={() => setActiveTab('TRUCK_FLEET')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 ${
            activeTab === 'TRUCK_FLEET'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
          }`}
        >
          <TruckIcon className="w-4 h-4 text-cyan-400" />
          <span>🚚 Agent Trucks Fleet Inventory ({trucks.length} Trucks)</span>
        </button>

        <button
          onClick={() => setActiveTab('FIFO_BATCHES')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 ${
            activeTab === 'FIFO_BATCHES'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4 text-amber-400" />
          <span>All FIFO Batch Lots ({batches.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('RETURNABLES')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 ${
            activeTab === 'RETURNABLES'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
          }`}
        >
          <RotateCcw className="w-4 h-4 text-cyan-400" />
          <span>Empty Containers Depot Stock</span>
        </button>
      </div>

      {/* Tab 1: Overall SKU Inventory with Accordion Batch Breakdown */}
      {activeTab === 'OVERALL_SKU' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">Overall Product Inventory & Batch Breakdown</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">Click any SKU row to expand underlying batch lots</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-semibold tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="w-10 px-4 py-4"></th>
                    <th className="px-6 py-4">Product SKU & Name</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Total Stock (Cases)</th>
                    <th className="px-6 py-4">Total Bottles</th>
                    <th className="px-6 py-4">Earliest FIFO Expiry</th>
                    <th className="px-6 py-4 text-right">Asset Valuation</th>
                    <th className="px-6 py-4 text-right">Stock In Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {overallSkuSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-slate-500 text-sm">
                        No product SKUs created yet.
                      </td>
                    </tr>
                  ) : (
                    overallSkuSummaries.map(({ product, prodBatches, totalCases, totalBottles, totalValue, earliestExpiry }) => {
                      const isExpanded = expandedProductIds.has(product.id);

                      return (
                        <React.Fragment key={product.id}>
                          <tr
                            onClick={() => toggleExpandProduct(product.id)}
                            className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                          >
                            <td className="px-4 py-4 text-slate-500 text-center">
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-indigo-400" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                            </td>
                            <td className="px-6 py-4 font-semibold text-white">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-white text-base">{product.name}</span>
                                <span className="text-[10px] font-mono font-bold text-indigo-400 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                                  {product.sku}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 uppercase">
                                {product.category}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-extrabold font-mono text-emerald-400 text-base">
                              {totalCases.toLocaleString()} <span className="text-xs text-slate-500 font-normal">cases</span>
                            </td>
                            <td className="px-6 py-4 font-mono text-slate-300">
                              {totalBottles.toLocaleString()} <span className="text-xs text-slate-500">bottles</span>
                            </td>
                            <td className="px-6 py-4 font-mono text-amber-300 text-xs">
                              {earliestExpiry}
                            </td>
                            <td className="px-6 py-4 text-right font-mono font-black text-indigo-400 text-base">
                              ₱{totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openStockInModal(product.id);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all"
                              >
                                + Stock In
                              </button>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr>
                              <td colSpan={8} className="bg-slate-950/80 p-4 border-t border-b border-indigo-500/30">
                                <div className="space-y-3 pl-8 pr-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2 text-xs font-bold text-amber-400">
                                      <Calendar className="w-4 h-4" />
                                      <span>Batch Lots Breakdown for {product.name} ({prodBatches.length} active lots)</span>
                                    </div>
                                    <button
                                      onClick={() => openStockInModal(product.id)}
                                      className="text-xs text-emerald-400 font-bold hover:underline"
                                    >
                                      + Receive New Batch Lot
                                    </button>
                                  </div>

                                  {prodBatches.length === 0 ? (
                                    <div className="p-4 bg-slate-900/60 rounded-xl text-center text-slate-500 text-xs">
                                      No batch lot records found for this product. Click <strong>+ Stock In</strong> above to receive the first batch.
                                    </div>
                                  ) : (
                                    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                                      <table className="w-full text-left text-xs text-slate-300">
                                        <thead className="bg-slate-950 text-slate-400 uppercase font-mono border-b border-slate-800">
                                          <tr>
                                            <th className="px-4 py-2.5">FIFO Rank</th>
                                            <th className="px-4 py-2.5">Batch / Lot Number</th>
                                            <th className="px-4 py-2.5">Manufacture Date</th>
                                            <th className="px-4 py-2.5">Expiration Date</th>
                                            <th className="px-4 py-2.5">Remaining Stock</th>
                                            <th className="px-4 py-2.5 text-right">Action</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                          {prodBatches.map((b: ProductBatch, idx: number) => {
                                            const expDateObj = new Date(b.expiry_date);
                                            const todayObj = new Date();
                                            const diffDays = Math.ceil((expDateObj.getTime() - todayObj.getTime()) / (1000 * 3600 * 24));
                                            const isExpiringSoon = diffDays <= 30;

                                            return (
                                              <tr key={b.id} className="hover:bg-slate-800/40">
                                                <td className="px-4 py-2.5">
                                                  {idx === 0 ? (
                                                    <span className="font-bold text-emerald-400 px-2 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/20">
                                                      FIFO #1 (Dispatch First)
                                                    </span>
                                                  ) : (
                                                    <span className="text-slate-500 font-mono">Lot #{idx + 1}</span>
                                                  )}
                                                </td>
                                                <td className="px-4 py-2.5 font-mono font-bold text-white">{b.batch_number}</td>
                                                <td className="px-4 py-2.5 font-mono text-slate-400">{b.manufacture_date || 'N/A'}</td>
                                                <td className="px-4 py-2.5 font-mono font-bold">
                                                  <span className={isExpiringSoon ? 'text-rose-400' : 'text-slate-200'}>
                                                    {b.expiry_date}
                                                  </span>
                                                  {isExpiringSoon && (
                                                    <span className="ml-2 text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                                                      FEFO Alert ({diffDays} days left)
                                                    </span>
                                                  )}
                                                </td>
                                                <td className="px-4 py-2.5 font-mono font-extrabold text-emerald-400">
                                                  {b.remaining_quantity} cases
                                                </td>
                                                <td className="px-4 py-2.5 text-right">
                                                  <button
                                                    onClick={() => setPrintingBatch({ batch: b, product })}
                                                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center space-x-1 font-bold text-xs border border-slate-700 ml-auto"
                                                  >
                                                    <Printer className="w-3.5 h-3.5 text-indigo-400" />
                                                    <span>Print Sticker</span>
                                                  </button>
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
          </div>
        </div>
      )}

      {/* Tab 2: Agent Trucks Fleet Inventory Breakdown */}
      {activeTab === 'TRUCK_FLEET' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TruckIcon className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-base">Agent Delivery Trucks Fleet Loaded Inventory</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">Live inventory loaded on agent trucks from stock transfers</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-semibold tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="w-10 px-4 py-4"></th>
                    <th className="px-6 py-4">Truck Code & Plate</th>
                    <th className="px-6 py-4">Assigned Agent / Driver</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Total Loaded Stock</th>
                    <th className="px-6 py-4 text-right">Loaded Valuation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {truckFleetSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500 text-sm">
                        No trucks registered in fleet catalog.
                      </td>
                    </tr>
                  ) : (
                    truckFleetSummaries.map(({ truck, assignedAgent, totalTruckCases, totalTruckValuation, loadedItemsBreakdown }) => {
                      const isExpanded = expandedTruckIds.has(truck.id);

                      return (
                        <React.Fragment key={truck.id}>
                          <tr
                            onClick={() => toggleExpandTruck(truck.id)}
                            className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                          >
                            <td className="px-4 py-4 text-slate-500 text-center">
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-cyan-400" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                            </td>
                            <td className="px-6 py-4 font-semibold text-white">
                              <div className="flex items-center space-x-2">
                                <TruckIcon className="w-4 h-4 text-cyan-400 shrink-0" />
                                <span className="font-bold text-white text-base">{truck.truck_code}</span>
                                <span className="text-xs font-mono font-bold text-slate-400 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                                  {truck.plate_number}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-300 font-medium">
                              <div className="flex items-center space-x-2">
                                <User className="w-3.5 h-3.5 text-slate-500" />
                                <span>{assignedAgent?.full_name || 'Unassigned'}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase">
                                {truck.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-extrabold font-mono text-cyan-400 text-base">
                              {totalTruckCases.toLocaleString()} <span className="text-xs text-slate-500 font-normal">cases</span>
                            </td>
                            <td className="px-6 py-4 text-right font-mono font-black text-indigo-400 text-base">
                              ₱{totalTruckValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>

                          {/* Expanded Truck Loaded Inventory Items */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={6} className="bg-slate-950/80 p-4 border-t border-b border-cyan-500/30">
                                <div className="space-y-3 pl-8 pr-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2 text-xs font-bold text-cyan-400">
                                      <ShieldCheck className="w-4 h-4" />
                                      <span>Current Loaded Stock Breakdown for {truck.truck_code} ({loadedItemsBreakdown.length} product SKUs)</span>
                                    </div>
                                    <Link to="/admin/transfers" className="text-xs text-indigo-400 font-bold hover:underline">
                                      + Execute Stock Transfer →
                                    </Link>
                                  </div>

                                  {loadedItemsBreakdown.length === 0 ? (
                                    <div className="p-4 bg-slate-900/60 rounded-xl text-center text-slate-500 text-xs">
                                      No stock currently loaded on this truck. Create a <strong>Stock Transfer</strong> to load cases.
                                    </div>
                                  ) : (
                                    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                                      <table className="w-full text-left text-xs text-slate-300">
                                        <thead className="bg-slate-950 text-slate-400 uppercase font-mono border-b border-slate-800">
                                          <tr>
                                            <th className="px-4 py-2.5">Product SKU & Name</th>
                                            <th className="px-4 py-2.5">Loaded Cases</th>
                                            <th className="px-4 py-2.5">Bottle Count</th>
                                            <th className="px-4 py-2.5">Selling Case Price</th>
                                            <th className="px-4 py-2.5 text-right">Total Item Value</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                          {loadedItemsBreakdown.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-800/40">
                                              <td className="px-4 py-2.5 font-bold text-white">
                                                {item.product?.name || 'Beverage Item'} ({item.product?.sku})
                                              </td>
                                              <td className="px-4 py-2.5 font-mono font-extrabold text-cyan-300">
                                                {item.qtyCases} cases
                                              </td>
                                              <td className="px-4 py-2.5 font-mono text-slate-400">
                                                {item.bottleCount.toLocaleString()} bottles
                                              </td>
                                              <td className="px-4 py-2.5 font-mono text-emerald-400">
                                                ₱{item.casePrice.toFixed(2)} / cs
                                              </td>
                                              <td className="px-4 py-2.5 text-right font-mono font-bold text-indigo-300">
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
          </div>
        </div>
      )}

      {/* Tab 3: All FIFO Batches View */}
      {activeTab === 'FIFO_BATCHES' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-white text-base">FIFO Expiration Master Lot Directory</h3>
            </div>
            <span className="text-xs text-amber-300 font-mono">Sorted by Earliest Expiration Date</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-semibold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Batch Number</th>
                  <th className="px-6 py-4">Product SKU & Name</th>
                  <th className="px-6 py-4">Manufacture Date</th>
                  <th className="px-6 py-4">Expiration Date</th>
                  <th className="px-6 py-4">Remaining Cases</th>
                  <th className="px-6 py-4 text-right">Thermal Sticker Label</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 text-sm">
                      No active FIFO batch lots recorded. Click <strong>+ Stock In</strong> to receive supplier stock.
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
                      <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-amber-300">{b.batch_number}</td>
                        <td className="px-6 py-4 font-semibold text-white">
                          {prod?.name || 'Unknown Product'} ({prod?.sku})
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-400">{b.manufacture_date || 'N/A'}</td>
                        <td className="px-6 py-4 font-mono font-bold">
                          <span className={isExpiringSoon ? 'text-rose-400' : 'text-slate-200'}>{b.expiry_date}</span>
                          {isExpiringSoon && (
                            <span className="ml-2 text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                              FEFO Alert ({diffDays}d)
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono font-extrabold text-emerald-400 text-base">
                          {b.remaining_quantity} cases
                        </td>
                        <td className="px-6 py-4 text-right">
                          {prod && (
                            <button
                              onClick={() => setPrintingBatch({ batch: b, product: prod })}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg inline-flex items-center space-x-1.5 font-bold text-xs border border-slate-700"
                            >
                              <Printer className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Print Sticker</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Empty Containers Depot Stock */}
      {activeTab === 'RETURNABLES' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <RotateCcw className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-white text-base">Main Warehouse Empty Bottle & Plastic Case Depot Stock</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">{returnableBalances.length} container types</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-semibold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Returnable Container</th>
                  <th className="px-6 py-4">Container Type</th>
                  <th className="px-6 py-4">Main Depot Counted Stock</th>
                  <th className="px-6 py-4">PUNDO Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {returnableBalances.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500 text-xs">
                      No empty bottles or cases currently stored in main warehouse depot.
                    </td>
                  </tr>
                ) : (
                  returnableBalances.map((rb) => (
                    <tr key={rb.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-semibold text-white">{rb.returnable_items?.name || 'Returnable Item'}</td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold uppercase">
                          {rb.returnable_items?.type || 'BOTTLE'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-extrabold font-mono text-amber-300 text-base">
                        {Number(rb.quantity).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-emerald-400">
                        ₱{Number(rb.returnable_items?.pundo_value || 0).toFixed(2)} / {rb.returnable_items?.unit || 'unit'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock In (Receive New Batch) Modal */}
      {isStockInModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                <Plus className="w-5 h-5" />
                <h3 className="text-lg">Warehouse Stock In (Receive Batch)</h3>
              </div>
              <button onClick={() => setIsStockInModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleStockInSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Product SKU *</label>
                <select
                  required
                  value={stockInProductId}
                  onChange={(e) => setStockInProductId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold text-xs"
                >
                  <option value="">Select product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Batch / Lot Number *</label>
                <input
                  type="text"
                  required
                  placeholder="LOT-202609-001"
                  value={stockInBatchNum}
                  onChange={(e) => setStockInBatchNum(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono uppercase text-xs text-amber-300 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Manufacture Date</label>
                  <input
                    type="date"
                    value={stockInMfgDate}
                    onChange={(e) => setStockInMfgDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Expiration Date (FIFO) *</label>
                  <input
                    type="date"
                    required
                    value={stockInExpDate}
                    onChange={(e) => setStockInExpDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-rose-400 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Received Cases Quantity *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={stockInCases}
                  onChange={(e) => setStockInCases(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 font-extrabold"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsStockInModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl">Cancel</button>
                <button type="submit" disabled={savingStockIn} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-600/30">
                  {savingStockIn ? 'Saving...' : 'Complete Stock In & Print Label'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Stock Adjustment Modal */}
      {isAdjModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-bold">Manual Stock Adjustment</h3>
              </div>
              <button onClick={() => setIsAdjModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAdjustment} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Product *</label>
                <select
                  required
                  value={selectedProdId}
                  onChange={(e) => setSelectedProdId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none"
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
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Quantity Change *</label>
                  <input
                    type="number"
                    required
                    placeholder="+5 or -2"
                    value={deltaQty}
                    onChange={(e) => setDeltaQty(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500">Positive for add, negative for deduction</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Reason *</label>
                  <select
                    value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value as AdjustmentReason)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
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

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Notes / Explanation</label>
                <textarea
                  rows={2}
                  placeholder="Explain why adjustment is being performed..."
                  value={adjNotes}
                  onChange={(e) => setAdjNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none text-xs"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAdjModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAdj}
                  className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-500 disabled:opacity-50"
                >
                  {savingAdj ? 'Applying...' : 'Apply Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Thermal Printable Batch Sticker Modal */}
      {printingBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-bold flex items-center space-x-2 text-indigo-400">
                <Printer className="w-4 h-4" />
                <span>Print Thermal Batch Label</span>
              </h3>
              <button onClick={() => setPrintingBatch(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {/* Thermal Label Physical Layout */}
            <div className="p-4 bg-white text-black rounded-xl space-y-2 border-2 border-dashed border-slate-400 font-sans shadow-inner">
              <div className="flex justify-between items-start border-b border-black pb-1.5">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-tight">{tenant?.name || 'BEVERAGE DISTRIBUTOR'}</div>
                  <div className="text-[9px] font-bold text-slate-800 uppercase">{printingBatch.product.brand} • {printingBatch.product.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-mono font-bold bg-black text-white px-1.5 py-0.5 rounded">
                    {printingBatch.product.sku}
                  </div>
                </div>
              </div>

              <div className="py-1 grid grid-cols-2 gap-2 text-center bg-slate-100 rounded border border-slate-300">
                <div>
                  <span className="text-[8px] font-bold text-slate-600 uppercase block">BATCH NUMBER</span>
                  <span className="text-xs font-mono font-black tracking-wider text-indigo-900">{printingBatch.batch.batch_number}</span>
                </div>
                <div>
                  <span className="text-[8px] font-bold text-slate-600 uppercase block">CASES IN BATCH</span>
                  <span className="text-xs font-mono font-black text-emerald-800">{printingBatch.batch.remaining_quantity} CS</span>
                </div>
              </div>

              <div className="pt-1 flex justify-between items-center text-[10px]">
                <div>
                  <span className="text-[8px] font-bold text-slate-500 block uppercase">MANUFACTURED</span>
                  <span className="font-mono font-bold">{printingBatch.batch.manufacture_date || 'N/A'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[8px] font-bold text-rose-700 block uppercase">EXPIRATION (FIFO)</span>
                  <span className="font-mono font-black text-rose-800 text-xs">{printingBatch.batch.expiry_date}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-300 text-center">
                <div className="h-8 bg-slate-900 w-full flex items-center justify-center space-x-1 px-2 rounded-sm">
                  {[1, 2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 1, 4, 1].map((w, i) => (
                    <span key={i} className="bg-white h-full inline-block" style={{ width: `${w * 2}px` }} />
                  ))}
                </div>
                <span className="text-[8px] font-mono tracking-widest text-slate-700 uppercase block mt-1">
                  *{printingBatch.batch.batch_number}*
                </span>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800 mt-4">
              <button onClick={() => setPrintingBatch(null)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl">Cancel</button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center space-x-2"
              >
                <Printer className="w-4 h-4" />
                <span>Print Sticker Label</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
