import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useModal } from '../../context/ModalContext';
import type { Product, Supplier } from '../../types/database.types';
import { EmptyState } from '../../components/EmptyState';
import {
  Tag,
  Plus,
  Gift,
  DollarSign,
  Building2,
  Printer,
  FileText,
  Filter,
  X,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';

export const PromotionsPage: React.FC = () => {
  const { tenant } = useTenant();
  const { showError, showSuccess } = useModal();
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
    if (!tenant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [prodsRes, supsRes, promoRes, claimRes, storesRes, agentsRes, trucksRes] = await Promise.all([
        supabase.from('products').select('*').eq('tenant_id', tenant.id).order('name'),
        supabase.from('suppliers').select('*').eq('tenant_id', tenant.id).order('name'),
        supabase.from('promotions').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
        supabase.from('supplier_promo_claims').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
        supabase.from('micro_stores').select('id, store_name, store_code').eq('tenant_id', tenant.id),
        supabase.from('agents').select('id, full_name, employee_code').eq('tenant_id', tenant.id),
        supabase.from('trucks').select('id, truck_code, plate_number').eq('tenant_id', tenant.id),
      ]);

      if (prodsRes.error) console.warn('Products query warning:', prodsRes.error);
      if (supsRes.error) console.warn('Suppliers query warning:', supsRes.error);
      if (promoRes.error) console.warn('Promotions query warning:', promoRes.error);
      if (claimRes.error) console.warn('Claims query warning:', claimRes.error);

      const prodsList = prodsRes.data || [];
      const supsList = supsRes.data || [];
      const rawPromos = promoRes.data || [];
      const rawClaims = claimRes.data || [];
      const storesList = storesRes.data || [];
      const agentsList = agentsRes.data || [];
      const trucksList = trucksRes.data || [];

      // In-memory relational mapping to prevent PostgREST ambiguity errors
      const enrichedPromos = rawPromos.map((p: any) => ({
        ...p,
        suppliers: supsList.find((s: any) => s.id === p.supplier_id) || null,
        products: prodsList.find((prod: any) => prod.id === p.buy_product_id) || null,
        free_product: prodsList.find((prod: any) => prod.id === p.free_product_id) || null,
      }));

      const enrichedClaims = rawClaims.map((c: any) => ({
        ...c,
        promotions: rawPromos.find((pr: any) => pr.id === c.promo_id) || null,
        suppliers: supsList.find((s: any) => s.id === c.supplier_id) || null,
        micro_stores: storesList.find((st: any) => st.id === c.micro_store_id) || null,
        agents: agentsList.find((ag: any) => ag.id === c.agent_id) || null,
        trucks: trucksList.find((tr: any) => tr.id === c.truck_id) || null,
      }));

      setProducts(prodsList);
      setSuppliers(supsList);
      setPromotions(enrichedPromos);
      setClaims(enrichedClaims);
    } catch (err) {
      console.error('Error fetching promotions data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromotionsData();
  }, [tenant]);

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    if (!promoName.trim() || !promoCode.trim() || !selectedSupplierId || !selectedProductId) {
      setError('Please fill in all required fields.');
      return;
    }

    setSavingPromo(true);
    setError(null);
    try {
      const { error: pErr } = await supabase.from('promotions').insert([
        {
          tenant_id: tenant.id,
          supplier_id: selectedSupplierId,
          promo_code: promoCode.toUpperCase().trim(),
          promo_name: promoName.trim(),
          buy_product_id: selectedProductId,
          buy_quantity: Number(buyQty) || 5,
          free_product_id: selectedProductId,
          free_quantity: Number(freeQty) || 1,
          claim_rate: Number(claimRate) || 0,
          is_active: true,
        },
      ]);

      if (pErr) {
        console.error('Create promo database error:', pErr);
        throw pErr;
      }

      setIsPromoModalOpen(false);
      setPromoName('');
      setPromoCode('');
      setSelectedSupplierId('');
      setSelectedProductId('');
      setBuyQty(5);
      setFreeQty(1);
      setClaimRate(720);
      showSuccess({
        title: 'Promotion Created',
        description: 'New supplier trade deal promotion has been saved.',
      });
      fetchPromotionsData();
    } catch (err: any) {
      const msg = err.message || err.details || 'Failed to create promotion.';
      setError(msg);
      showError({
        title: 'Promotion Error',
        description: msg,
      });
    } finally {
      setSavingPromo(false);
    }
  };

  const togglePromoStatus = async (promoId: string, currentStatus: boolean) => {
    try {
      await supabase
        .from('promotions')
        .update({ is_active: !currentStatus })
        .eq('id', promoId);
      fetchPromotionsData();
    } catch (err) {
      console.error('Error toggling promo status:', err);
    }
  };

  const handleSettleClaim = async () => {
    if (!selectedClaim || !tenant) return;
    setSavingSettlement(true);
    try {
      const { error: sErr } = await supabase
        .from('supplier_promo_claims')
        .update({
          status: 'REIMBURSED',
          settlement_type: settlementType,
          settlement_notes: settlementNotes || 'Direct Settlement',
          settled_at: new Date().toISOString(),
        })
        .eq('id', selectedClaim.id);

      if (sErr) throw sErr;

      setSelectedClaim(null);
      setSettlementNotes('');
      fetchPromotionsData();
      showSuccess({
        title: 'Claim Reimbursed',
        description: 'Supplier promotion claim has been successfully marked as reimbursed.',
      });
    } catch (err: any) {
      showError({
        title: 'Settlement Failed',
        description: err.message || 'Failed to settle claim.',
      });
    } finally {
      setSavingSettlement(false);
    }
  };

  const filteredClaims = claims.filter((c) => {
    if (supplierFilter !== 'ALL' && c.supplier_id !== supplierFilter) return false;
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    return true;
  });

  let totalFreeCases = 0;
  let totalClaimableMoney = 0;
  let totalPendingMoney = 0;
  let totalReimbursedMoney = 0;

  claims.forEach((c) => {
    const free = Number(c.free_cases_awarded || 0);
    const amt = Number(c.total_claim_amount || 0);

    totalFreeCases += free;
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 flex items-center space-x-2">
            <Tag className="w-5 h-5 text-zinc-800" />
            <span>Supplier Promos & Claims</span>
          </h1>
          <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">
            Manage trade deals (5+1 promo) and track reimbursement claims owed by suppliers
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {activeTab === 'CLAIMS' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatementSupplierId(suppliers[0]?.id || '');
                setShowStatementModal(true);
              }}
              className="flex items-center space-x-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Claim Invoice</span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => setIsPromoModalOpen(true)}
            className="flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Trade Deal</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1.5 border-b border-zinc-200 pb-2">
        <Button
          variant={activeTab === 'PROMOS' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('PROMOS')}
          className="text-xs"
        >
          <Gift className="w-3.5 h-3.5 mr-1" />
          <span>Active Trade Promos ({promotions.length})</span>
        </Button>

        <Button
          variant={activeTab === 'CLAIMS' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('CLAIMS')}
          className="text-xs"
        >
          <DollarSign className="w-3.5 h-3.5 mr-1" />
          <span>Supplier Claims ({claims.length})</span>
        </Button>
      </div>

      {/* TAB 1: ACTIVE TRADE PROMOS */}
      {activeTab === 'PROMOS' && (
        <div className="space-y-4">
          {loading ? (
            <div className="py-20 text-center text-zinc-400 animate-pulse text-xs">Loading promotions catalog...</div>
          ) : promotions.length === 0 ? (
            <EmptyState
              title="No Active Trade Deals"
              description="No promotions (such as 5+1 free goods) have been configured. Click 'Add Trade Deal' to setup supplier promos."
              icon={<Gift className="w-8 h-8 text-zinc-400" />}
              actionText="Add Trade Deal"
              onAction={() => setIsPromoModalOpen(true)}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {promotions.map((p) => (
                <Card
                  key={p.id}
                  className={`flex flex-col justify-between ${!p.is_active ? 'opacity-60' : ''}`}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {p.promo_code}
                        </Badge>
                        <h3 className="text-base font-semibold text-zinc-900 mt-1">{p.promo_name}</h3>
                        <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Supplier: {p.suppliers?.name || 'San Miguel'}</span>
                        </p>
                      </div>

                      <button
                        onClick={() => togglePromoStatus(p.id, p.is_active)}
                        className="cursor-pointer"
                      >
                        <Badge variant={p.is_active ? 'default' : 'secondary'} className="text-[10px]">
                          {p.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </Badge>
                      </button>
                    </div>

                    <div className="bg-zinc-50 p-3 rounded-md border border-zinc-200 space-y-1 text-xs">
                      <div className="flex justify-between text-zinc-600">
                        <span>Product:</span>
                        <span className="font-medium text-zinc-900">{p.products?.name}</span>
                      </div>
                      <div className="flex justify-between text-zinc-600">
                        <span>Deal:</span>
                        <span className="font-semibold text-zinc-900">
                          Buy {p.buy_quantity} cs → +{p.free_quantity} cs FREE
                        </span>
                      </div>
                      <div className="flex justify-between text-zinc-600">
                        <span>Claim Rate:</span>
                        <span className="font-semibold text-zinc-900">₱{Number(p.claim_rate).toFixed(2)} / free cs</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-zinc-500">
                      Customer pays ₱0.00 for the +{p.free_quantity} promo case. Stock is deducted and ₱{p.claim_rate} is billed to supplier.
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CLAIMS */}
      {activeTab === 'CLAIMS' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 space-y-1">
                <span className="text-xs text-zinc-500 uppercase font-medium">Promo Cases Given</span>
                <div className="text-xl font-bold text-zinc-900">{totalFreeCases} cs</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-1">
                <span className="text-xs text-zinc-500 uppercase font-medium">Total Claimable</span>
                <div className="text-xl font-bold text-zinc-900">
                  ₱{totalClaimableMoney.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-1">
                <span className="text-xs text-zinc-500 uppercase font-medium">Pending Claims</span>
                <div className="text-xl font-bold text-zinc-900">
                  ₱{totalPendingMoney.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-1">
                <span className="text-xs text-zinc-500 uppercase font-medium">Reimbursed</span>
                <div className="text-xl font-bold text-zinc-900">
                  ₱{totalReimbursedMoney.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-zinc-200">
            <div className="flex items-center space-x-2">
              <Filter className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs font-semibold text-zinc-700">Filters:</span>

              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="bg-white border border-zinc-300 rounded-md px-2.5 py-1 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 cursor-pointer"
              >
                <option value="ALL">All Suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-zinc-300 rounded-md px-2.5 py-1 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING_CLAIM">Pending Claim</option>
                <option value="REIMBURSED">Reimbursed</option>
              </select>
            </div>

            <span className="text-xs text-zinc-500">
              {filteredClaims.length} entries
            </span>
          </div>

          {loading ? (
            <div className="py-20 text-center text-zinc-400 animate-pulse text-xs">Loading claims ledger...</div>
          ) : filteredClaims.length === 0 ? (
            <EmptyState
              title="No Claims Logged"
              description="No promo redemption claims have been recorded yet. When agents complete deliveries with active promos, claim records appear here."
              icon={<DollarSign className="w-8 h-8 text-zinc-400" />}
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm text-zinc-700">
                  <thead className="bg-zinc-50 text-zinc-500 uppercase text-[11px] font-medium tracking-wider border-b border-zinc-200">
                    <tr>
                      <th className="px-4 py-3">Claim Date</th>
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-4 py-3">Promo</th>
                      <th className="px-4 py-3">Store</th>
                      <th className="px-4 py-3 text-center">Cases (Sold / Free)</th>
                      <th className="px-4 py-3 text-right">Claim Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 bg-white">
                    {filteredClaims.map((c) => {
                      const isReimbursed = c.status === 'REIMBURSED';
                      const dateStr = new Date(c.created_at).toLocaleDateString();

                      return (
                        <tr key={c.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="px-4 py-3 text-zinc-600">{dateStr}</td>
                          <td className="px-4 py-3 font-medium text-zinc-900">
                            {c.suppliers?.name || 'San Miguel'}
                          </td>
                          <td className="px-4 py-3 text-zinc-900">
                            {c.promotions?.promo_name || 'Trade Deal'}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            {c.micro_stores?.store_name || 'Micro Store'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span>{c.qualifying_cases_sold} sold</span> →{' '}
                            <span className="font-semibold text-zinc-900">+{c.free_cases_awarded} free</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-zinc-900">
                            ₱{Number(c.total_claim_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={isReimbursed ? 'default' : 'secondary'} className="text-[10px]">
                              {isReimbursed ? 'REIMBURSED' : 'PENDING'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {!isReimbursed ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedClaim(c)}
                                className="h-7 text-xs"
                              >
                                Settle
                              </Button>
                            ) : (
                              <span className="text-xs text-zinc-400">Settled</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Create Promo Modal */}
      {isPromoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-zinc-200 rounded-lg max-w-lg w-full p-6 shadow-xl text-zinc-900 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center space-x-2 font-semibold">
                <Gift className="w-4 h-4 text-zinc-700" />
                <h3 className="text-base">Setup Supplier Trade Deal (Promo)</h3>
              </div>
              <button onClick={() => setIsPromoModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded-md text-red-700 text-xs">{error}</div>}

            <form onSubmit={handleCreatePromo} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block font-medium text-zinc-700">Funding Supplier *</label>
                <select
                  required
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-md px-3 py-2 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 cursor-pointer"
                >
                  <option value="">Select supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block font-medium text-zinc-700">Promo Code *</label>
                  <Input
                    type="text"
                    required
                    placeholder="PROMO-SMB-5P1"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="font-mono uppercase text-xs"
                  />
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="block font-medium text-zinc-700">Promo Name *</label>
                  <Input
                    type="text"
                    required
                    placeholder="San Miguel 5+1 Deal"
                    value={promoName}
                    onChange={(e) => setPromoName(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-medium text-zinc-700">Product *</label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-md px-3 py-2 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 cursor-pointer"
                >
                  <option value="">Select product...</option>
                  {products.map((prod) => (
                    <option key={prod.id} value={prod.id}>{prod.name} ({prod.sku})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block font-medium text-zinc-700">Buy Qty (Cases) *</label>
                  <Input
                    type="number"
                    min="1"
                    required
                    value={buyQty}
                    onChange={(e) => setBuyQty(parseInt(e.target.value) || 1)}
                    className="font-mono text-center text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-medium text-zinc-700">Free Qty (Cases) *</label>
                  <Input
                    type="number"
                    min="1"
                    required
                    value={freeQty}
                    onChange={(e) => setFreeQty(parseInt(e.target.value) || 1)}
                    className="font-mono text-center text-xs font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-medium text-zinc-700">Claim Rate (₱) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    required
                    value={claimRate}
                    onChange={(e) => setClaimRate(parseFloat(e.target.value) || 0)}
                    className="font-mono text-center text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-200 flex justify-end space-x-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsPromoModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={savingPromo}>
                  {savingPromo ? 'Saving...' : 'Create Deal'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Claim Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-zinc-200 rounded-lg max-w-md w-full p-6 shadow-xl text-zinc-900 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <h3 className="text-base font-semibold text-zinc-900">Settle Supplier Claim</h3>
              <button onClick={() => setSelectedClaim(null)} className="text-zinc-400 hover:text-zinc-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-zinc-50 p-3 rounded-md border border-zinc-200 text-xs space-y-1 font-mono">
              <div className="flex justify-between text-zinc-600">
                <span>Supplier:</span>
                <span className="font-semibold text-zinc-900">{selectedClaim.suppliers?.name || 'San Miguel'}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>Free Cases:</span>
                <span className="font-semibold text-zinc-900">+{selectedClaim.free_cases_awarded} cs</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>Total Claim:</span>
                <span className="font-bold text-zinc-900">
                  ₱{Number(selectedClaim.total_claim_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block font-medium text-zinc-700">Reimbursement Method *</label>
                <select
                  value={settlementType}
                  onChange={(e) => setSettlementType(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-md px-3 py-2 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 cursor-pointer"
                >
                  <option value="CASH_REBATE">Direct Cash Rebate / Wire</option>
                  <option value="STOCK_CREDIT">In-Kind Stock Replacement</option>
                  <option value="INVOICE_DEDUCTION">AP Credit Memo</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-medium text-zinc-700">Reference / Notes</label>
                <Input
                  type="text"
                  placeholder="e.g. Credit Memo #CM-9984"
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-zinc-200">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedClaim(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={savingSettlement}
                onClick={handleSettleClaim}
              >
                {savingSettlement ? 'Saving...' : 'Confirm Settle'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Claim Statement Modal */}
      {showStatementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-zinc-200 rounded-lg max-w-xl w-full p-6 shadow-xl text-zinc-900 space-y-4 font-mono text-xs">
            <div className="border-b border-zinc-200 pb-3 text-center font-sans">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900">
                Supplier Promo Claim Statement
              </h2>
              <p className="text-xs text-zinc-500 font-mono mt-0.5">
                Supplier: {suppliers.find((s) => s.id === statementSupplierId)?.name || 'San Miguel'}
              </p>
            </div>

            <div className="flex justify-between items-center bg-zinc-50 p-2.5 rounded-md border border-zinc-200">
              <span>Select Supplier:</span>
              <select
                value={statementSupplierId}
                onChange={(e) => setStatementSupplierId(e.target.value)}
                className="bg-white border border-zinc-300 rounded-md px-2 py-1 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 cursor-pointer"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {(() => {
              const pendingSupplierClaims = claims.filter(
                (c) => c.supplier_id === statementSupplierId && c.status !== 'REIMBURSED'
              );

              let totalClaim = 0;
              pendingSupplierClaims.forEach((c) => (totalClaim += Number(c.total_claim_amount || 0)));

              return (
                <div className="space-y-3">
                  <div className="max-h-52 overflow-y-auto border border-zinc-200 rounded-md bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-50 text-zinc-500 uppercase text-[10px] border-b border-zinc-200">
                        <tr>
                          <th className="p-2.5">Date</th>
                          <th className="p-2.5">Store</th>
                          <th className="p-2.5 text-center">Free</th>
                          <th className="p-2.5 text-right">Amount (₱)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {pendingSupplierClaims.map((c) => (
                          <tr key={c.id}>
                            <td className="p-2.5 text-zinc-600">{new Date(c.created_at).toLocaleDateString()}</td>
                            <td className="p-2.5 font-medium text-zinc-900">{c.micro_stores?.store_name || 'Store'}</td>
                            <td className="p-2.5 text-center font-medium text-zinc-900">+{c.free_cases_awarded} cs</td>
                            <td className="p-2.5 text-right font-medium text-zinc-900">
                              ₱{Number(c.total_claim_amount).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-md flex justify-between items-center text-xs">
                    <span className="font-semibold text-zinc-900 uppercase">Total Claimed:</span>
                    <span className="text-base font-bold text-zinc-900">
                      ₱{totalClaim.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-between items-center pt-3 border-t border-zinc-200 font-sans">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="flex items-center space-x-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Statement</span>
              </Button>

              <Button
                size="sm"
                onClick={() => setShowStatementModal(false)}
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
