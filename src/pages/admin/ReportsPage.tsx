import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { History, FileSpreadsheet } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { tenant } = useTenant();
  const [activeTab, setActiveTab] = useState<'movements' | 'pundo'>('movements');
  const [movements, setMovements] = useState<any[]>([]);
  const [pundoRows, setPundoRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReportData = async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      if (activeTab === 'movements') {
        const { data } = await supabase
          .from('inventory_movements')
          .select(`
            *,
            products(name, sku),
            returnable_items(name, type),
            from_location:from_location_id(name),
            to_location:to_location_id(name)
          `)
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false })
          .limit(100);
        setMovements(data || []);
      } else if (activeTab === 'pundo') {
        const { data } = await supabase
          .from('pundo_ledger')
          .select(`
            *,
            micro_stores(store_name, store_code),
            returnable_items(name, type)
          `)
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false });
        setPundoRows(data || []);
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [tenant, activeTab]);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-extrabold text-white">System Reports & Audit Trails</h1>
        <p className="text-slate-400 text-sm">Full movement ledger, accountability tracking, and deposit history</p>
      </div>

      <div className="flex space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('movements')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
            activeTab === 'movements'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Inventory Movement Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab('pundo')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
            activeTab === 'pundo'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>PUNDO Ledger Audit</span>
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-500 animate-pulse">Generating audit report...</div>
      ) : activeTab === 'movements' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-semibold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Transaction Type</th>
                  <th className="px-6 py-4">Item Name</th>
                  <th className="px-6 py-4">From Location</th>
                  <th className="px-6 py-4">To Location</th>
                  <th className="px-6 py-4">Quantity</th>
                  <th className="px-6 py-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500 text-xs">
                      No inventory movements recorded yet.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">
                          {m.transaction_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-white">
                        {m.item_type === 'PRODUCT'
                          ? m.products?.name || 'Product'
                          : m.returnable_items?.name || 'Returnable'}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">{m.from_location?.name || 'External / Supplier'}</td>
                      <td className="px-6 py-4 text-xs text-slate-400">{m.to_location?.name || 'External / Delivered'}</td>
                      <td className="px-6 py-4 font-mono font-bold text-white">
                        {m.quantity} {m.unit}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">{new Date(m.created_at).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-semibold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Micro Store</th>
                  <th className="px-6 py-4">Container Item</th>
                  <th className="px-6 py-4">Delivered (Owed)</th>
                  <th className="px-6 py-4">Returned</th>
                  <th className="px-6 py-4">Running Balance</th>
                  <th className="px-6 py-4">Monetary Value</th>
                  <th className="px-6 py-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {pundoRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500 text-xs">
                      No PUNDO ledger entries recorded yet.
                    </td>
                  </tr>
                ) : (
                  pundoRows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-semibold text-white">{r.micro_stores?.store_name}</td>
                      <td className="px-6 py-4 text-xs text-slate-300">{r.returnable_items?.name}</td>
                      <td className="px-6 py-4 font-mono text-indigo-300 font-bold">+{r.quantity_in}</td>
                      <td className="px-6 py-4 font-mono text-emerald-400 font-bold">-{r.quantity_out}</td>
                      <td className="px-6 py-4 font-mono text-white font-extrabold">{r.balance_quantity}</td>
                      <td className="px-6 py-4 font-mono text-amber-300 font-bold">₱{Number(r.balance_value).toFixed(2)}</td>
                      <td className="px-6 py-4 text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
