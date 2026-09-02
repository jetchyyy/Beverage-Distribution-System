import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { Store, Coins } from 'lucide-react';

export const AgentPundoView: React.FC = () => {
  const { tenant } = useTenant();
  const [storePundos, setStorePundos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPundoBalances = async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const { data: stores } = await supabase.from('micro_stores').select('*').eq('tenant_id', tenant.id).order('store_name');
      const { data: ledgerEntries } = await supabase
        .from('pundo_ledger')
        .select('*, returnable_items(*)')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      const storeMap = new Map<string, any>();
      stores?.forEach((st) => {
        storeMap.set(st.id, {
          store: st,
          bottleQty: 0,
          bottleVal: 0,
          caseQty: 0,
          caseVal: 0,
          totalVal: 0,
        });
      });

      const seenKeys = new Set<string>();
      ledgerEntries?.forEach((entry: any) => {
        const key = `${entry.micro_store_id}_${entry.returnable_item_id}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          const sData = storeMap.get(entry.micro_store_id);
          if (sData) {
            const itemType = entry.returnable_items?.item_type || entry.returnable_items?.type;
            const isBottle = itemType === 'BOTTLE';
            const isCase = itemType === 'CASE';

            const qty = Number(entry.balance_quantity || 0);
            const val = Number(entry.balance_value || 0);

            if (isBottle) {
              sData.bottleQty += qty;
              sData.bottleVal += val;
            } else if (isCase) {
              sData.caseQty += qty;
              sData.caseVal += val;
            }
            sData.totalVal += val;
          }
        }
      });

      setStorePundos(Array.from(storeMap.values()));
    } catch (err) {
      console.error('Error fetching PUNDO balances:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPundoBalances();
  }, [tenant]);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-3">
        <h1 className="text-xl font-extrabold text-white flex items-center space-x-2">
          <Coins className="w-5 h-5 text-amber-400" />
          <span>Micro Store PUNDO Balances</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">Outstanding returnable containers owed by customers</p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 text-xs animate-pulse">Loading store PUNDO...</div>
      ) : storePundos.length === 0 ? (
        <div className="p-8 text-center text-slate-500 text-xs bg-slate-900 border border-slate-800 rounded-2xl">
          No micro store PUNDO deposit balances recorded.
        </div>
      ) : (
        <div className="space-y-3">
          {storePundos.map(({ store, bottleQty, bottleVal, caseQty, caseVal, totalVal }) => (
            <div key={store.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center space-x-2">
                  <Store className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-bold text-white text-base">{store.store_name}</h4>
                </div>
                <span className="font-extrabold font-mono text-amber-300 text-base">₱{totalVal.toFixed(2)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Bottle PUNDO</p>
                  <p className="font-bold text-indigo-300 mt-0.5">{bottleQty} btls (₱{bottleVal.toFixed(2)})</p>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Case PUNDO</p>
                  <p className="font-bold text-cyan-300 mt-0.5">{caseQty} cases (₱{caseVal.toFixed(2)})</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
