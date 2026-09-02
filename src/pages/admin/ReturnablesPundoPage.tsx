import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import type { ReturnableItem, MicroStore } from '../../types/database.types';
import { EmptyState } from '../../components/EmptyState';
import { RotateCcw, Coins, Plus, Edit2, Sparkles } from 'lucide-react';

export const ReturnablesPundoPage: React.FC = () => {
  const { tenant } = useTenant();

  const [returnables, setReturnables] = useState<ReturnableItem[]>([]);
  const [stores, setStores] = useState<MicroStore[]>([]);
  const [pundoLedger, setPundoLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal & Edit State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ReturnableItem | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [itemType, setItemType] = useState<'BOTTLE' | 'CASE'>('BOTTLE');
  const [depositRate, setDepositRate] = useState<number>(3.00);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const { data: rets, error: retErr } = await supabase
        .from('returnable_items')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('name');

      if (retErr) throw retErr;
      setReturnables(rets || []);

      const { data: st, error: stErr } = await supabase
        .from('micro_stores')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('store_name');

      if (stErr) throw stErr;
      setStores(st || []);

      const { data: ledg } = await supabase
        .from('pundo_ledger')
        .select('*, micro_stores(store_name), returnable_items(name, item_type)')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      setPundoLedger(ledg || []);
    } catch (err) {
      console.error('Error fetching PUNDO data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenant]);

  const handleCreateOrUpdateReturnable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !code || !name) return;

    setSaving(true);
    setError(null);

    try {
      if (editingItem) {
        // Update
        const { error: err } = await supabase
          .from('returnable_items')
          .update({
            code: code.toUpperCase().trim(),
            name: name.trim(),
            item_type: itemType,
            type: itemType,
            deposit_rate: Number(depositRate),
            pundo_value: Number(depositRate),
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingItem.id);

        if (err) throw err;
      } else {
        // Insert
        const { error: err } = await supabase.from('returnable_items').insert([
          {
            tenant_id: tenant.id,
            code: code.toUpperCase().trim(),
            name: name.trim(),
            item_type: itemType,
            type: itemType,
            deposit_rate: Number(depositRate),
            pundo_value: Number(depositRate),
            unit: itemType === 'BOTTLE' ? 'bottle' : 'case',
            is_active: true,
          },
        ]);

        if (err) throw err;
      }

      setIsModalOpen(false);
      setEditingItem(null);
      setCode('');
      setName('');
      setDepositRate(3.00);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to save returnable item.');
    } finally {
      setSaving(false);
    }
  };

  const handleSeedDefaults = async () => {
    if (!tenant) return;
    setSaving(true);
    setError(null);

    const defaultContainers = [
      {
        tenant_id: tenant.id,
        code: 'SMB-BTL-330',
        name: 'SMB 330ml Returnable Glass Bottle',
        item_type: 'BOTTLE',
        type: 'BOTTLE',
        deposit_rate: 3.00,
        pundo_value: 3.00,
        unit: 'bottle',
        is_active: true,
      },
      {
        tenant_id: tenant.id,
        code: 'SMB-BTL-1L',
        name: 'SMB 1-Liter Heavy Returnable Bottle',
        item_type: 'BOTTLE',
        type: 'BOTTLE',
        deposit_rate: 8.00,
        pundo_value: 8.00,
        unit: 'bottle',
        is_active: true,
      },
      {
        tenant_id: tenant.id,
        code: 'RC-BTL-1.5L',
        name: 'RC Cola 1.5L Returnable Bottle',
        item_type: 'BOTTLE',
        type: 'BOTTLE',
        deposit_rate: 5.00,
        pundo_value: 5.00,
        unit: 'bottle',
        is_active: true,
      },
      {
        tenant_id: tenant.id,
        code: 'CASE-PLASTIC-24',
        name: '24-Bottle Plastic Shell Case / Crate',
        item_type: 'CASE',
        type: 'CASE',
        deposit_rate: 50.00,
        pundo_value: 50.00,
        unit: 'case',
        is_active: true,
      },
      {
        tenant_id: tenant.id,
        code: 'CASE-PLASTIC-12',
        name: '12-Bottle Heavy Duty Case / Crate',
        item_type: 'CASE',
        type: 'CASE',
        deposit_rate: 40.00,
        pundo_value: 40.00,
        unit: 'case',
        is_active: true,
      },
    ];

    try {
      const { error: seedErr } = await supabase.from('returnable_items').upsert(defaultContainers, {
        onConflict: 'tenant_id,code',
      });
      if (seedErr) throw seedErr;
      fetchData();
    } catch (err: any) {
      console.error('Error seeding default returnables:', err);
      setError(err.message || 'Failed to seed default returnable items.');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (item: ReturnableItem) => {
    setEditingItem(item);
    setCode(item.code || '');
    setName(item.name || '');
    setItemType(item.item_type || item.type || 'BOTTLE');
    setDepositRate(item.deposit_rate || item.pundo_value || 3.00);
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setEditingItem(null);
    setCode('');
    setName('');
    setItemType('BOTTLE');
    setDepositRate(3.00);
    setIsModalOpen(true);
  };

  // Group PUNDO outstanding balances per micro store
  const storePundoBalances = stores.map((s) => {
    const storeLedger = pundoLedger.filter((l) => l.micro_store_id === s.id);
    let bottleOutstanding = 0;
    let bottleValue = 0;
    let caseOutstanding = 0;
    let caseValue = 0;

    const itemBalances = new Map<string, { qty: number; val: number; type: string }>();
    storeLedger.forEach((entry) => {
      const key = entry.returnable_item_id;
      if (!itemBalances.has(key)) {
        itemBalances.set(key, {
          qty: Number(entry.balance_quantity || 0),
          val: Number(entry.balance_value || 0),
          type: entry.returnable_items?.item_type || 'BOTTLE',
        });
      }
    });

    itemBalances.forEach((b) => {
      if (b.type === 'BOTTLE') {
        bottleOutstanding += b.qty;
        bottleValue += b.val;
      } else {
        caseOutstanding += b.qty;
        caseValue += b.val;
      }
    });

    return {
      store: s,
      bottleOutstanding,
      bottleValue,
      caseOutstanding,
      caseValue,
      totalValue: bottleValue + caseValue,
    };
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Returnables & PUNDO Ledger</h1>
          <p className="text-slate-400 text-sm">
            Bottle & Case returnable container deposit pricing & store accountability
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleSeedDefaults}
            disabled={saving}
            className="px-3.5 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30 flex items-center space-x-2 transition-all"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Seed Default SMB & RC Containers</span>
          </button>

          <button
            onClick={openNewModal}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center space-x-2 transition-all shadow-lg shadow-indigo-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Returnable Container</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl font-medium">
          {error}
        </div>
      )}

      {/* Section 1: Returnable Container Deposit Rates */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center space-x-2">
          <RotateCcw className="w-5 h-5 text-amber-400" />
          <span>Configured PUNDO Container Deposit Rates ({returnables.length})</span>
        </h2>

        {loading ? (
          <div className="py-12 text-center text-slate-500 animate-pulse">Loading returnable container rates...</div>
        ) : returnables.length === 0 ? (
          <EmptyState
            title="No Returnable Items Configured"
            description="Add returnable glass bottles and plastic cases to set up container deposit rates (PUNDO)."
            icon={<RotateCcw className="w-10 h-10 text-amber-400" />}
            actionText="Seed Default Containers"
            onAction={handleSeedDefaults}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {returnables.map((item) => {
              const type = item.item_type || item.type || 'BOTTLE';
              const rate = item.deposit_rate || item.pundo_value || 0;

              return (
                <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 hover:border-slate-700 transition-all flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                        {item.code}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          type === 'BOTTLE'
                            ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                            : 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                        }`}
                      >
                        {type}
                      </span>
                    </div>

                    <h3 className="text-base font-extrabold text-white">{item.name}</h3>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-mono">Deposit Rate (PUNDO)</span>
                      <span className="text-lg font-black text-emerald-400">₱{Number(rate).toFixed(2)} / unit</span>
                    </div>

                    <button
                      onClick={() => openEditModal(item)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      title="Edit Rate"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Store Outstanding PUNDO Balances */}
      <div className="space-y-4 pt-6 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Coins className="w-5 h-5 text-emerald-400" />
            <span>Micro Store Outstanding PUNDO Balances</span>
          </h2>

          <span className="text-xs text-amber-300 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 font-mono">
            Separate Bottle & Case Accounting Enforced
          </span>
        </div>

        {stores.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-sm">
            No micro store accounts registered.
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-semibold tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Micro Store</th>
                    <th className="px-6 py-4">Bottle Outstanding</th>
                    <th className="px-6 py-4">Bottle PUNDO Value</th>
                    <th className="px-6 py-4">Case Outstanding</th>
                    <th className="px-6 py-4">Case PUNDO Value</th>
                    <th className="px-6 py-4 text-right">Total PUNDO Owed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {storePundoBalances.map(({ store, bottleOutstanding, bottleValue, caseOutstanding, caseValue, totalValue }) => (
                    <tr key={store.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-semibold text-white">
                        <div>{store.store_name}</div>
                        <div className="text-xs text-slate-500 font-mono">{store.store_code}</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-cyan-300">
                        {bottleOutstanding} <span className="text-xs text-slate-500">bottles</span>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-cyan-400">
                        ₱{bottleValue.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 font-mono text-purple-300">
                        {caseOutstanding} <span className="text-xs text-slate-500">cases</span>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-purple-400">
                        ₱{caseValue.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-black text-emerald-400 text-base">
                        ₱{totalValue.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal for Add / Edit Returnable Item */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <h3 className="text-lg font-bold">
                {editingItem ? 'Edit Returnable Container Rate' : 'Add Returnable Container Rate'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {error && <div className="p-3 mb-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">{error}</div>}

            <form onSubmit={handleCreateOrUpdateReturnable} className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="SMB-BTL-330"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono uppercase text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Container Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="SMB 330ml Returnable Bottle"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Container Type *</label>
                  <select
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value as 'BOTTLE' | 'CASE')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-semibold"
                  >
                    <option value="BOTTLE">BOTTLE (Glass Bottle)</option>
                    <option value="CASE">CASE (Plastic Shell Crate)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Deposit Rate (₱) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="0.50"
                    value={depositRate}
                    onChange={(e) => setDepositRate(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 font-bold"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-amber-300">💡 PUNDO Accounting Rule:</p>
                <p>
                  Bottle deposits and Plastic Case deposits are tracked in separate balance ledgers so bottle returns will never cancel out case deposits.
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30">
                  {saving ? 'Saving...' : 'Save Container Rate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
