import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import type { MicroStore } from '../../types/database.types';
import { EmptyState } from '../../components/EmptyState';
import { Store, Plus, Phone, MapPin } from 'lucide-react';

export const MicroStoresPage: React.FC = () => {
  const { tenant } = useTenant();
  const [stores, setStores] = useState<MicroStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [storeCode, setStoreCode] = useState('');
  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStores = async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('micro_stores').select('*').eq('tenant_id', tenant.id).order('store_name');
      if (error) throw error;
      setStores(data || []);
    } catch (err) {
      console.error('Error fetching stores:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
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
      fetchStores();
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
          {stores.map((s) => (
            <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 hover:border-slate-700 transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                    {s.store_code}
                  </span>
                  <h3 className="text-lg font-bold text-white mt-1.5">{s.store_name}</h3>
                  <p className="text-xs text-slate-400">Owner: {s.owner_name || 'N/A'}</p>
                </div>
                <div className="p-2 bg-slate-800 rounded-xl text-emerald-400">
                  <Store className="w-5 h-5" />
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
          ))}
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
    </div>
  );
};
