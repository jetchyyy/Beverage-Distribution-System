import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { Store, Coins } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';

export const AgentPundoView: React.FC = () => {
  const { tenant } = useTenant();
  const { profile } = useAuth();
  const [storePundos, setStorePundos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPundoBalances = async () => {
    if (!tenant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [storesRes, ledgerRes, retsRes, salesRes] = await Promise.all([
        supabase.from('micro_stores').select('*').eq('tenant_id', tenant.id).order('store_name'),
        supabase
          .from('pundo_ledger')
          .select('*, returnable_items(*)')
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false }),
        supabase.from('returnable_items').select('*').eq('tenant_id', tenant.id),
        supabase
          .from('sales')
          .select('micro_store_id, bottle_pundo_amount, case_pundo_amount, total, subtotal')
          .eq('tenant_id', tenant.id),
      ]);

      const stores = storesRes.data || [];
      const ledgerEntries = ledgerRes.data || [];
      const returnables = retsRes.data || [];
      const sales = salesRes.data || [];

      const storeMap = new Map<string, any>();
      stores.forEach((st) => {
        storeMap.set(st.id, {
          store: st,
          bottleQty: 0,
          bottleVal: 0,
          caseQty: 0,
          caseVal: 0,
          totalVal: 0,
          hasLedgerActivity: false,
        });
      });

      // 1. Calculate from pundo_ledger using latest balance per container or cumulative quantity_change
      const seenStoreItems = new Set<string>();
      ledgerEntries.forEach((entry: any) => {
        const key = `${entry.micro_store_id}_${entry.returnable_item_id}`;
        if (!seenStoreItems.has(key)) {
          seenStoreItems.add(key);
          const sData = storeMap.get(entry.micro_store_id);
          if (sData) {
            sData.hasLedgerActivity = true;

            const matchedRet = entry.returnable_items || returnables.find((r) => r.id === entry.returnable_item_id);
            const itemType = matchedRet?.item_type || matchedRet?.type || 'BOTTLE';
            const isBottle = itemType === 'BOTTLE';

            const qty = Math.max(0, Number(entry.balance_quantity ?? entry.quantity_change ?? 0));
            const rate = Number(entry.pundo_rate || matchedRet?.deposit_rate || matchedRet?.pundo_value || (isBottle ? 10.00 : 50.00));
            const val = Number(entry.balance_value || (qty * rate));

            if (isBottle) {
              sData.bottleQty += qty;
              sData.bottleVal += val;
            } else {
              sData.caseQty += qty;
              sData.caseVal += val;
            }
            sData.totalVal += val;
          }
        }
      });

      // 2. Fallback for stores with sales records but no pundo_ledger rows yet
      stores.forEach((st) => {
        const sData = storeMap.get(st.id);
        if (sData && !sData.hasLedgerActivity) {
          const storeSales = sales.filter((s) => s.micro_store_id === st.id);
          let bPundoSum = 0;
          let cPundoSum = 0;

          storeSales.forEach((s) => {
            bPundoSum += Number(s.bottle_pundo_amount || 0);
            cPundoSum += Number(s.case_pundo_amount || 0);
          });

          if (bPundoSum > 0 || cPundoSum > 0) {
            const bQty = Math.round(bPundoSum / 10.00);
            const cQty = Math.round(cPundoSum / 50.00);

            sData.bottleQty = bQty;
            sData.bottleVal = bPundoSum;
            sData.caseQty = cQty;
            sData.caseVal = cPundoSum;
            sData.totalVal = bPundoSum + cPundoSum;
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
  }, [tenant, profile]);

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-200 pb-4">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-zinc-700" />
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">
            Micro Store PUNDO Balances
          </h1>
        </div>
        <p className="text-xs text-zinc-500 mt-1">Outstanding returnable containers owed by customer stores</p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-zinc-400 text-xs">Loading store PUNDO balances...</div>
      ) : storePundos.length === 0 ? (
        <div className="p-8 text-center text-zinc-400 text-xs border border-dashed border-zinc-200 rounded-lg">
          No micro store PUNDO deposit balances recorded.
        </div>
      ) : (
        <div className="space-y-3">
          {storePundos.map(({ store, bottleQty, bottleVal, caseQty, caseVal, totalVal }) => (
            <Card key={store.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-zinc-500" />
                    <div>
                      <h4 className="font-bold text-zinc-900 text-base">{store.store_name}</h4>
                      <span className="text-[11px] text-zinc-400 font-mono">{store.store_code}</span>
                    </div>
                  </div>
                  <span className="font-bold font-mono text-zinc-900 text-base">₱{totalVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-zinc-50 p-2.5 rounded-lg border border-zinc-200">
                    <p className="text-[10px] uppercase font-semibold text-zinc-500">Bottle PUNDO</p>
                    <p className="font-semibold text-zinc-900 mt-0.5">
                      {bottleQty} btls (₱{bottleVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                    </p>
                  </div>
                  <div className="bg-zinc-50 p-2.5 rounded-lg border border-zinc-200">
                    <p className="text-[10px] uppercase font-semibold text-zinc-500">Case PUNDO</p>
                    <p className="font-semibold text-zinc-900 mt-0.5">
                      {caseQty} cases (₱{caseVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
