import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import type { MicroStore } from '../../types/database.types';
import { EmptyState } from '../../components/EmptyState';
import {
  Store,
  Plus,
  Phone,
  MapPin,
  History,
} from 'lucide-react';

export const MicroStoresPage: React.FC = () => {
  const { tenant } = useTenant();
  const [stores, setStores] = useState<MicroStore[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Selected Store Purchase History Modal
  const [selectedStore, setSelectedStore] = useState<any | null>(null);

  const [storeCode, setStoreCode] = useState('');
  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStoresData = async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const { data: storeData, error: sErr } = await supabase
        .from('micro_stores')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('store_name');

      if (sErr) throw sErr;
      setStores(storeData || []);

      // Fetch all sales & sale items for customer lifetime metrics
      const { data: salesData } = await supabase
        .from('sales')
        .select(`
          *,
          sale_items(*, products(name, sku)),
          agents(full_name, employee_code),
          trucks(truck_code, plate_number)
        `)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      setSales(salesData || []);
    } catch (err) {
      console.error('Error fetching stores data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStoresData();
  }, [tenant]);

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !storeCode || !storeName) return;
    setSaving(true);
    setError(null);

    try {
      const { data: loc } = await supabase
        .from('locations')
        .insert([
          {
            tenant_id: tenant.id,
            name: storeName.trim(),
            type: 'MICRO_STORE',
            is_active: true,
          },
        ])
        .select()
        .single();

      await supabase.from('micro_stores').insert([
        {
          tenant_id: tenant.id,
          store_code: storeCode.toUpperCase().trim(),
          store_name: storeName.trim(),
          owner_name: ownerName.trim() || null,
          phone,
          address,
          location_id: loc?.id || null,
          status: 'ACTIVE',
        },
      ]);

      setIsModalOpen(false);
      setStoreCode('');
      setStoreName('');
      setOwnerName('');
      setPhone('');
      setAddress('');
      fetchStoresData();
    } catch (err: any) {
      setError(err.message || 'Failed to create micro store.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Micro Stores Directory</h1>
          <p className="text-slate-400 text-sm">Registered customer sari-sari stores & beverage retailers</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center space-x-2 transition-all shadow-lg shadow-indigo-600/30 self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Add Micro Store</span>
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-500 animate-pulse">Loading micro store accounts...</div>
      ) : stores.length === 0 ? (
        <EmptyState
          title="No Micro Stores Registered"
          description="No micro store accounts found. Add retail micro stores to start recording sales deliveries and bottle PUNDO balances."
          icon={<Store className="w-10 h-10 text-indigo-400" />}
          actionText="Add Micro Store"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {stores.map((s) => {
            const storeSales = sales.filter((sale) => sale.micro_store_id === s.id);
            let totalSpent = 0;
            let totalCasesDelivered = 0;

            storeSales.forEach((sale) => {
              totalSpent += Number(sale.total || 0);
              let saleCases = 0;
              (sale.sale_items || []).forEach((si: any) => {
                saleCases += Number(si.quantity || 0);
              });
              if (saleCases === 0 && Number(sale.subtotal || sale.total || 0) > 0) {
                saleCases = Math.max(1, Math.round(Number(sale.subtotal || sale.total || 0) / 780));
              }
              totalCasesDelivered += saleCases;
            });

            return (
              <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 hover:border-slate-700 transition-all shadow-lg flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                        {s.store_code}
                      </span>
                      <h3 className="text-lg font-bold text-white mt-1.5">{s.store_name}</h3>
                      <p className="text-xs text-slate-400">Owner: {s.owner_name || 'N/A'}</p>
                    </div>
                    <div className="p-2 bg-slate-800 rounded-xl text-emerald-400 shrink-0">
                      <Store className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Lifetime Customer Metrics Card */}
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 grid grid-cols-2 gap-2 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Lifetime Revenue</span>
                      <span className="text-sm font-black text-emerald-400">
                        ₱{totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Cases Purchased</span>
                      <span className="text-sm font-extrabold text-white">
                        {totalCasesDelivered} <span className="text-[10px] text-slate-500 font-normal">cs</span>
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs text-slate-400">
                    {s.phone && (
                      <div className="flex items-center space-x-2">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span>{s.phone}</span>
                      </div>
                    )}
                    {s.address && (
                      <div className="flex items-start space-x-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{s.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* View Purchase History Action Button */}
                <div className="pt-3 border-t border-slate-800/80">
                  <button
                    onClick={() => setSelectedStore(s)}
                    className="w-full py-2 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white font-bold text-xs flex items-center justify-center space-x-1.5 border border-indigo-500/30 transition-all"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>View Purchase History ({storeSales.length})</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <h3 className="text-lg font-bold">Add Micro Store Account</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400">✕</button>
            </div>
            {error && <div className="p-3 mb-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">{error}</div>}
            <form onSubmit={handleCreateStore} className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Store Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="STR-001"
                    value={storeCode}
                    onChange={(e) => setStoreCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono uppercase"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Store Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="ABC Store"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Owner Name</label>
                  <input
                    type="text"
                    placeholder="Maria Santos"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="+63 918 000 1111"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Address / Location</label>
                <input
                  type="text"
                  placeholder="Brgy. Poblacion, Cebu City"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl">Create Store</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Store Purchase History Modal */}
      {selectedStore && (() => {
        const storeSales = sales.filter((s) => s.micro_store_id === selectedStore.id);
        let totalSpent = 0;
        let totalCases = 0;

        storeSales.forEach((s) => {
          totalSpent += Number(s.total || 0);
          let sCases = 0;
          (s.sale_items || []).forEach((si: any) => {
            sCases += Number(si.quantity || 0);
          });
          if (sCases === 0 && Number(s.subtotal || s.total || 0) > 0) {
            sCases = Math.max(1, Math.round(Number(s.subtotal || s.total || 0) / 780));
          }
          totalCases += sCases;
        });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl text-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                      <span>{selectedStore.store_name}</span>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {selectedStore.store_code}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Owner: {selectedStore.owner_name || 'N/A'} {selectedStore.address ? `• ${selectedStore.address}` : ''}
                    </p>
                  </div>
                </div>

                <button onClick={() => setSelectedStore(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              {/* Lifetime Metrics Summary */}
              <div className="grid grid-cols-3 gap-3 font-mono text-xs">
                <div className="bg-slate-950 p-3.5 rounded-2xl border border-emerald-500/30">
                  <span className="text-[10px] text-emerald-400 uppercase font-bold block">Lifetime Revenue</span>
                  <span className="text-lg font-black text-emerald-400 block mt-1">
                    ₱{totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Total store purchases</span>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Cases Bought</span>
                  <span className="text-lg font-extrabold text-white block mt-1">
                    {totalCases} <span className="text-xs text-slate-500 font-normal">cases</span>
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Full beverage cases</span>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Delivery Orders</span>
                  <span className="text-lg font-extrabold text-cyan-300 block mt-1">
                    {storeSales.length} <span className="text-xs text-slate-500 font-normal">orders</span>
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Completed deliveries</span>
                </div>
              </div>

              {/* Purchase History Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider font-mono">
                  Itemized Purchase Receipts History ({storeSales.length})
                </h4>

                {storeSales.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-800 text-xs text-slate-500">
                    No purchase history logged for this micro store yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {storeSales.map((sale: any) => {
                      const items = sale.sale_items || [];
                      let sCases = 0;
                      items.forEach((si: any) => (sCases += Number(si.quantity || 0)));
                      if (sCases === 0 && Number(sale.subtotal || sale.total || 0) > 0) {
                        sCases = Math.max(1, Math.round(Number(sale.subtotal || sale.total || 0) / 780));
                      }

                      return (
                        <div
                          key={sale.id}
                          className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5 font-mono text-xs"
                        >
                          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                            <div>
                              <span className="font-bold text-indigo-400">{sale.sale_number}</span>
                              <span className="text-[10px] text-slate-500 block">
                                Delivered by: {sale.agents?.full_name || 'Route Agent'} ({sale.trucks?.truck_code || 'Truck Fleet'})
                              </span>
                            </div>

                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 block">
                                {new Date(sale.created_at).toLocaleString()}
                              </span>
                              <span className="text-[10px] font-bold text-emerald-400 uppercase">
                                {sale.payment_status || 'PAID'}
                              </span>
                            </div>
                          </div>

                          {/* Itemized Line Items Breakdown */}
                          <div className="space-y-1 text-slate-300">
                            {items.length > 0 ? (
                              items.map((si: any) => (
                                <div key={si.id} className="flex justify-between items-center text-xs">
                                  <span>{si.products?.name || 'Beverage Product'}:</span>
                                  <span className="font-bold text-white">
                                    {si.quantity} cases @ ₱{Number(si.unit_price || 0).toFixed(2)}/cs = ₱{Number(si.subtotal || 0).toFixed(2)}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="flex justify-between items-center text-xs">
                                <span>Beverage Product Cases Delivered:</span>
                                <span className="font-bold text-white">{sCases} cases</span>
                              </div>
                            )}

                            {(Number(sale.bottle_pundo_amount || 0) > 0 || Number(sale.case_pundo_amount || 0) > 0) && (
                              <div className="flex justify-between text-amber-400 text-[11px] pt-1">
                                <span>Lacking Container PUNDO Charge:</span>
                                <span>+₱{(Number(sale.bottle_pundo_amount || 0) + Number(sale.case_pundo_amount || 0)).toFixed(2)}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex justify-between items-center pt-2 border-t border-slate-800/80">
                            <span className="text-slate-400 text-[10px] uppercase font-bold">Total Amount Paid:</span>
                            <span className="text-base font-black text-emerald-400">
                              ₱{Number(sale.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-800">
                <button
                  onClick={() => setSelectedStore(null)}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30"
                >
                  Close Purchase History
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
