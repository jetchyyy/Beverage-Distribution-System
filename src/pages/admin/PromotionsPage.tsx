import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import type { Product, Supplier } from '../../types/database.types';
import { EmptyState } from '../../components/EmptyState';
import {
  Tag,
  Plus,
  Gift,
  DollarSign,
  Building2,
  CheckCircle,
  Clock,
  Printer,
  FileText,
  Filter,
} from 'lucide-react';

export const PromotionsPage: React.FC = () => {
  const { tenant } = useTenant();
  const [activeTab, setActiveTab] = useState<'PROMOS' | 'CLAIMS'>('PROMOS');

  const [promotions, setPromotions] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // New Promo Modal State
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [promoName, setPromoName] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [buyQty, setBuyQty] = useState<number>(5);
  const [freeQty, setFreeQty] = useState<number>(1);
  const [claimRate, setClaimRate] = useState<number>(720);
  const [savingPromo, setSavingPromo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter & Claim Settlement State
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
  const [settlementType, setSettlementType] = useState<string>('CASH_REBATE');
  const [settlementNotes, setSettlementNotes] = useState<string>('');
  const [savingSettlement, setSavingSettlement] = useState(false);

  // Printable Claim Statement Modal
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [statementSupplierId, setStatementSupplierId] = useState<string>('');

  const fetchPromotionsData = async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const { data: prods } = await supabase.from('products').select('*').eq('tenant_id', tenant.id).order('name');
      setProducts(prods || []);

      const { data: sups } = await supabase.from('suppliers').select('*').eq('tenant_id', tenant.id).order('name');
      setSuppliers(sups || []);

      const { data: promoData } = await supabase
        .from('promotions')
        .select(`
          *,
          suppliers(name, supplier_code),
          products!buy_product_id(name, sku)
        `)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      setPromotions(promoData || []);

      const { data: claimData } = await supabase
        .from('supplier_promo_claims')
        .select(`
          *,
          promotions(promo_name, promo_code),
          suppliers(name, supplier_code),
          micro_stores(store_name, store_code),
          agents(full_name),
          trucks(truck_code)
        `)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      setClaims(claimData || []);
    } catch (err) {
      console.error('Error fetching promotions data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromotionsData();
  }, [tenant]);

  // Handle Create New Promo
  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !promoName || !promoCode || !selectedProductId) return;

    setSavingPromo(true);
    setError(null);

    try {
      const { error: insertErr } = await supabase.from('promotions').insert([
        {
          tenant_id: tenant.id,
          supplier_id: selectedSupplierId || null,
          promo_code: promoCode.toUpperCase().trim(),
          promo_name: promoName.trim(),
          buy_product_id: selectedProductId,
          buy_quantity: buyQty,
          free_product_id: selectedProductId,
          free_quantity: freeQty,
          claim_rate: claimRate,
          is_active: true,
        },
      ]);

      if (insertErr) throw insertErr;

      setIsPromoModalOpen(false);
      setPromoName('');
      setPromoCode('');
      setSelectedSupplierId('');
      setSelectedProductId('');
      setBuyQty(5);
      setFreeQty(1);
      setClaimRate(720);
      fetchPromotionsData();
    } catch (err: any) {
      setError(err.message || 'Failed to create promotion.');
    } finally {
      setSavingPromo(false);
    }
  };

  // Toggle Promo Active Status
  const togglePromoStatus = async (promoId: string, currentActive: boolean) => {
    try {
      await supabase.from('promotions').update({ is_active: !currentActive }).eq('id', promoId);
      fetchPromotionsData();
    } catch (err) {
      console.error('Error toggling promo:', err);
    }
  };

  // Settle Supplier Claim
  const handleSettleClaim = async () => {
    if (!selectedClaim) return;
    setSavingSettlement(true);
    try {
      await supabase
        .from('supplier_promo_claims')
        .update({
          status: 'REIMBURSED',
          settlement_type: settlementType,
          settled_at: new Date().toISOString(),
          settlement_notes: settlementNotes || null,
        })
        .eq('id', selectedClaim.id);

      setSelectedClaim(null);
      setSettlementNotes('');
      fetchPromotionsData();
    } catch (err: any) {
      alert('Failed to settle claim: ' + err.message);
    } finally {
      setSavingSettlement(false);
    }
  };

  // Filtered Claims
  const filteredClaims = claims.filter((c) => {
    if (supplierFilter !== 'ALL' && c.supplier_id !== supplierFilter) return false;
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    return true;
  });

  // Calculate Metrics
  let totalFreeCases = 0;
  let totalClaimableMoney = 0;
  let totalPendingMoney = 0;
  let totalReimbursedMoney = 0;

  claims.forEach((c) => {
    const freeCs = Number(c.free_cases_awarded || 0);
    const amt = Number(c.total_claim_amount || 0);
    totalFreeCases += freeCs;
    totalClaimableMoney += amt;

    if (c.status === 'REIMBURSED') {
      totalReimbursedMoney += amt;
    } else {
      totalPendingMoney += amt;
    }
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center space-x-2">
            <Tag className="w-6 h-6 text-pink-400" />
            <span>Supplier-Funded Promos & Claims Ledger</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage trade deals (5+1 promo) and track reimbursement claims owed by suppliers (San Miguel, etc.)
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {activeTab === 'CLAIMS' && (
            <button
              onClick={() => {
                setStatementSupplierId(suppliers[0]?.id || '');
                setShowStatementModal(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold border border-slate-800 flex items-center space-x-2 shadow-lg"
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Generate Supplier Claim Invoice</span>
            </button>
          )}

          <button
            onClick={() => setIsPromoModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-xs font-extrabold tracking-wide shadow-lg shadow-pink-500/25 flex items-center space-x-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Supplier Trade Deal</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 max-w-md">
        <button
          onClick={() => setActiveTab('PROMOS')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 ${
            activeTab === 'PROMOS'
              ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Gift className="w-4 h-4" />
          <span>Active Trade Promos ({promotions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('CLAIMS')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 ${
            activeTab === 'CLAIMS'
              ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Supplier Claims Ledger ({claims.length})</span>
        </button>
      </div>

      {/* TAB 1: ACTIVE TRADE PROMOS */}
      {activeTab === 'PROMOS' && (
        <div className="space-y-4">
          {loading ? (
            <div className="py-20 text-center text-slate-500 animate-pulse text-sm">Loading promotions catalog...</div>
          ) : promotions.length === 0 ? (
            <EmptyState
              title="No Active Supplier Trade Deals"
              description="No promotions (such as 5+1 free goods) have been configured. Click '+ Add Supplier Trade Deal' to setup supplier-funded promos."
              icon={<Gift className="w-10 h-10 text-pink-400" />}
              actionText="Add Supplier Trade Deal"
              onAction={() => setIsPromoModalOpen(true)}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {promotions.map((p) => (
                <div
                  key={p.id}
                  className={`bg-slate-900 border rounded-3xl p-5 space-y-4 shadow-xl transition-all ${
                    p.is_active ? 'border-pink-500/40' : 'border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-[10px] font-extrabold px-2 py-0.5 rounded bg-pink-500/10 text-pink-400 border border-pink-500/20">
                        {p.promo_code}
                      </span>
                      <h3 className="text-base font-extrabold text-white mt-1.5">{p.promo_name}</h3>
                      <p className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Supplier: {p.suppliers?.name || 'San Miguel Brewery'}</span>
                      </p>
                    </div>

                    <button
                      onClick={() => togglePromoStatus(p.id, p.is_active)}
                      className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                        p.is_active
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {p.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </button>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between text-slate-300">
                      <span>Qualifying Product:</span>
                      <span className="font-bold text-white">{p.products?.name}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Promo Threshold Deal:</span>
                      <span className="font-bold text-cyan-300">
                        Buy {p.buy_quantity} cs $\rightarrow$ Get +{p.free_quantity} cs FREE
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Supplier Claim Rate:</span>
                      <span className="font-bold text-emerald-400">₱{Number(p.claim_rate).toFixed(2)} / free cs</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 italic">
                    💡 Customer pays ₱0.00 for the +{p.free_quantity} promo case. Physical stock is deducted from truck and ₱{p.claim_rate} is billed to {p.suppliers?.name || 'Supplier'}.
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SUPPLIER REIMBURSEMENT CLAIMS LEDGER */}
      {activeTab === 'CLAIMS' && (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
              <span className="text-[10px] text-slate-400 uppercase font-bold block flex items-center gap-1">
                <Gift className="w-3.5 h-3.5 text-pink-400" />
                Promo Cases Given
              </span>
              <span className="text-2xl font-black text-white block mt-2">{totalFreeCases} cases</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Free goods given to stores</span>
            </div>

            <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-5 shadow-xl">
              <span className="text-[10px] text-emerald-400 uppercase font-bold block flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" />
                Total Owed by Suppliers
              </span>
              <span className="text-2xl font-black text-emerald-400 block mt-2">
                ₱{totalClaimableMoney.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Total promo claim value</span>
            </div>

            <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-5 shadow-xl">
              <span className="text-[10px] text-amber-300 uppercase font-bold block flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Pending Claims
              </span>
              <span className="text-2xl font-black text-amber-300 block mt-2">
                ₱{totalPendingMoney.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Awaiting supplier payment</span>
            </div>

            <div className="bg-slate-900 border border-cyan-500/30 rounded-3xl p-5 shadow-xl">
              <span className="text-[10px] text-cyan-300 uppercase font-bold block flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                Reimbursed Claims
              </span>
              <span className="text-2xl font-black text-cyan-300 block mt-2">
                ₱{totalReimbursedMoney.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Settled by suppliers</span>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center space-x-3">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-300 uppercase font-mono">Filter Ledger:</span>

              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="ALL">All Suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="ALL">All Claim Statuses</option>
                <option value="PENDING_CLAIM">Pending Claim</option>
                <option value="REIMBURSED">Reimbursed / Settled</option>
              </select>
            </div>

            <span className="text-xs font-mono text-slate-400">
              Showing {filteredClaims.length} claim entries
            </span>
          </div>

          {/* Claims Table */}
          {loading ? (
            <div className="py-20 text-center text-slate-500 animate-pulse text-sm">Loading supplier claims ledger...</div>
          ) : filteredClaims.length === 0 ? (
            <EmptyState
              title="No Supplier Claims Logged"
              description="No promo redemption claims have been recorded yet. When agents complete store deliveries with active promos (5+1), claim records automatically log here."
              icon={<DollarSign className="w-10 h-10 text-emerald-400" />}
            />
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-bold tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-5 py-4">Claim Date</th>
                      <th className="px-5 py-4">Supplier</th>
                      <th className="px-5 py-4">Promo Name</th>
                      <th className="px-5 py-4">Micro Store Delivered</th>
                      <th className="px-5 py-4 text-center">Cases (Sold / Free)</th>
                      <th className="px-5 py-4 text-right">Claim Amount (₱)</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {filteredClaims.map((c) => {
                      const isReimbursed = c.status === 'REIMBURSED';
                      const dateStr = new Date(c.created_at).toLocaleDateString();

                      return (
                        <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-5 py-4 font-bold text-slate-300">{dateStr}</td>
                          <td className="px-5 py-4 font-extrabold text-white">
                            {c.suppliers?.name || 'San Miguel Brewery'}
                          </td>
                          <td className="px-5 py-4 font-bold text-pink-400">
                            {c.promotions?.promo_name || '5+1 Trade Deal'}
                          </td>
                          <td className="px-5 py-4 font-medium text-slate-300">
                            {c.micro_stores?.store_name || 'Micro Store'}
                          </td>
                          <td className="px-5 py-4 text-center font-bold">
                            <span className="text-slate-300">{c.qualifying_cases_sold} cs sold</span> $\rightarrow${' '}
                            <span className="text-emerald-400">+{c.free_cases_awarded} free</span>
                          </td>
                          <td className="px-5 py-4 text-right font-black text-emerald-400 text-sm">
                            ₱{Number(c.total_claim_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                                isReimbursed
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              }`}
                            >
                              {isReimbursed ? 'REIMBURSED' : 'PENDING CLAIM'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            {!isReimbursed ? (
                              <button
                                onClick={() => setSelectedClaim(c)}
                                className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-md shadow-emerald-600/30 font-sans"
                              >
                                Settle Claim
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-sans">Settled</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create New Promo Modal */}
      {isPromoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-pink-400 font-extrabold">
                <Gift className="w-5 h-5" />
                <h3 className="text-lg text-white">Setup Supplier Trade Deal (Promo)</h3>
              </div>
              <button onClick={() => setIsPromoModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleCreatePromo} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Funding Supplier (e.g. San Miguel) *</label>
                <select
                  required
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-white focus:outline-none focus:border-pink-500"
                >
                  <option value="">Select funding supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.supplier_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Promo Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="PROMO-SMB-5P1"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2.5 text-white font-mono uppercase focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-300 mb-1">Promotion Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="San Miguel Redhorse 5+1 Deal"
                    value={promoName}
                    onChange={(e) => setPromoName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-white focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Beverage Product *</label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-white focus:outline-none focus:border-pink-500"
                >
                  <option value="">Select target product...</option>
                  {products.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name} ({prod.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Buy Qty (Cases) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={buyQty}
                    onChange={(e) => setBuyQty(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2.5 text-white font-mono text-center focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Free Qty (Cases) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={freeQty}
                    onChange={(e) => setFreeQty(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2.5 text-emerald-400 font-mono text-center font-bold focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Claim Rate (₱) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={claimRate}
                    onChange={(e) => setClaimRate(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2.5 text-emerald-400 font-mono text-center font-bold focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsPromoModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPromo}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold shadow-lg shadow-pink-500/25 disabled:opacity-50"
                >
                  {savingPromo ? 'Saving Trade Deal...' : 'Create Trade Deal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Supplier Claim Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white">Settle Supplier Promo Claim</h3>
              <button onClick={() => setSelectedClaim(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs font-mono space-y-1.5">
              <div className="flex justify-between text-slate-400">
                <span>Funding Supplier:</span>
                <span className="font-bold text-white">{selectedClaim.suppliers?.name || 'San Miguel Brewery'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Free Cases Awarded:</span>
                <span className="font-bold text-emerald-400">+{selectedClaim.free_cases_awarded} cases</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Total Claim Amount:</span>
                <span className="font-black text-emerald-400 text-sm">
                  ₱{Number(selectedClaim.total_claim_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Reimbursement Method *</label>
                <select
                  value={settlementType}
                  onChange={(e) => setSettlementType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none"
                >
                  <option value="CASH_REBATE">Direct Cash Rebate / Wire</option>
                  <option value="STOCK_CREDIT">In-Kind Stock Replacement</option>
                  <option value="INVOICE_DEDUCTION">Supplier Accounts Payable Credit Memo</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Settlement Reference / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. San Miguel Credit Memo #CM-9984"
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedClaim(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingSettlement}
                onClick={handleSettleClaim}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/30"
              >
                {savingSettlement ? 'Updating Ledger...' : 'Confirm Claim Settled'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Supplier Claim Statement Modal */}
      {showStatementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl text-slate-100 space-y-4 font-mono">
            <div className="border-b-2 border-slate-700 pb-3 text-center">
              <h2 className="text-sm font-black text-white uppercase tracking-wider">
                OFFICIAL SUPPLIER PROMO REIMBURSEMENT CLAIM STATEMENT
              </h2>
              <p className="text-xs text-pink-400 font-bold mt-1">
                Supplier: {suppliers.find((s) => s.id === statementSupplierId)?.name || 'San Miguel Brewery'}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Date Generated: {new Date().toLocaleDateString()}</p>
            </div>

            <div className="flex justify-between items-center bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs">
              <span>Select Supplier to Bill:</span>
              <select
                value={statementSupplierId}
                onChange={(e) => setStatementSupplierId(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.supplier_code})
                  </option>
                ))}
              </select>
            </div>

            {/* Itemized Claim Statement Table */}
            {(() => {
              const pendingSupplierClaims = claims.filter(
                (c) => c.supplier_id === statementSupplierId && c.status !== 'REIMBURSED'
              );

              let totalClaim = 0;
              pendingSupplierClaims.forEach((c) => (totalClaim += Number(c.total_claim_amount || 0)));

              return (
                <div className="space-y-3">
                  <div className="max-h-60 overflow-y-auto border border-slate-800 rounded-2xl bg-slate-950">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-slate-400 uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Date</th>
                          <th className="p-3">Store</th>
                          <th className="p-3 text-center">Free Cases</th>
                          <th className="p-3 text-right">Claim ₱</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {pendingSupplierClaims.map((c) => (
                          <tr key={c.id}>
                            <td className="p-3 text-slate-300">{new Date(c.created_at).toLocaleDateString()}</td>
                            <td className="p-3 text-white font-bold">{c.micro_stores?.store_name || 'Store'}</td>
                            <td className="p-3 text-center text-emerald-400 font-bold">+{c.free_cases_awarded} cs</td>
                            <td className="p-3 text-right text-emerald-400 font-bold">
                              ₱{Number(c.total_claim_amount).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex justify-between items-center text-xs">
                    <span className="font-bold text-white uppercase">TOTAL REIMBURSEMENT CLAIMED:</span>
                    <span className="text-lg font-black text-emerald-400">
                      ₱{totalClaim.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-between items-center pt-3 border-t border-slate-800 font-sans">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1.5 border border-slate-700"
              >
                <Printer className="w-4 h-4 text-pink-400" />
                <span>Print Supplier Claim Statement</span>
              </button>

              <button
                onClick={() => setShowStatementModal(false)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
