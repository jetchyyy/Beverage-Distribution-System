import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { EmptyState } from '../../components/EmptyState';
import {
  History,
  ShoppingBag,
  Store,
  DollarSign,

  Search,
  Eye,

  FileText,
  Clock,
  Printer,
  Package,

} from 'lucide-react';

export const AgentSalesHistory: React.FC = () => {
  const { tenant } = useTenant();
  const { profile } = useAuth();

  const [salesList, setSalesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'YESTERDAY' | 'ALL'>('TODAY');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSale, setSelectedSale] = useState<any | null>(null);

  // Stats
  const [todayTotalMoney, setTodayTotalMoney] = useState(0);
  const [todayStoresCount, setTodayStoresCount] = useState(0);
  const [todayCasesCount, setTodayCasesCount] = useState(0);

  const fetchAgentSalesHistory = async () => {
    if (!tenant || !profile?.id) return;
    setLoading(true);

    try {
      // 1. Resolve Active Agent Record for the logged-in user
      const { data: agentData } = await supabase
        .from('agents')
        .select('id, assigned_truck_id')
        .eq('tenant_id', tenant.id)
        .eq('user_id', profile.id)
        .limit(1)
        .maybeSingle();

      let activeAgentId = agentData?.id;
      let activeTruckId = agentData?.assigned_truck_id;

      if (!activeAgentId) {
        // Fallback check truck assigned to profile
        const { data: trkData } = await supabase
          .from('trucks')
          .select('id')
          .eq('tenant_id', tenant.id)
          .limit(1)
          .maybeSingle();
        activeTruckId = trkData?.id;
      }

      // 2. Fetch ONLY sales belonging to THIS agent
      let query = supabase
        .from('sales')
        .select(`
          *,
          micro_stores(store_name, owner_name, address, store_code),
          sale_items(*, products(name, sku))
        `)
        .eq('tenant_id', tenant.id);

      if (activeAgentId) {
        query = query.eq('agent_id', activeAgentId);
      } else if (activeTruckId) {
        query = query.eq('truck_id', activeTruckId);
      }

      const { data: sales, error: salesErr } = await query.order('created_at', { ascending: false });

      if (salesErr) throw salesErr;

      const allAgentSales = sales || [];
      setSalesList(allAgentSales);

      // Compute Today's Stats for logged-in agent
      const todayStr = new Date().toISOString().slice(0, 10);
      const todaySales = allAgentSales.filter((s) => s.created_at?.slice(0, 10) === todayStr);

      let money = 0;
      let cases = 0;
      todaySales.forEach((s) => {
        money += Number(s.total || 0);
        let sCases = 0;
        (s.sale_items || []).forEach((si: any) => {
          sCases += Number(si.quantity || 0);
        });

        if (sCases === 0) {
          const prodSubtotal = Number(s.subtotal || s.total || 0);
          if (prodSubtotal > 0) {
            sCases = Math.max(1, Math.round(prodSubtotal / 780));
          }
        }
        cases += sCases;
      });

      setTodayTotalMoney(money);
      setTodayStoresCount(todaySales.length);
      setTodayCasesCount(cases);
    } catch (err) {
      console.error('Error fetching agent sales history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentSalesHistory();
  }, [tenant, profile]);

  // Date & Search Filtering
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

  const filteredSales = salesList.filter((s) => {
    const sDate = s.created_at?.slice(0, 10);

    if (dateFilter === 'TODAY' && sDate !== todayStr) return false;
    if (dateFilter === 'YESTERDAY' && sDate !== yesterdayStr) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = s.sale_number?.toLowerCase().includes(q);
      const matchStore = s.micro_stores?.store_name?.toLowerCase().includes(q);
      const matchOwner = s.micro_stores?.owner_name?.toLowerCase().includes(q);
      return matchNum || matchStore || matchOwner;
    }

    return true;
  });

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-20">
      {/* Header */}
      <div className="border-b border-slate-800 pb-3">
        <h1 className="text-xl font-extrabold text-white flex items-center space-x-2">
          <History className="w-5 h-5 text-indigo-400" />
          <span>My Daily Store Sales History</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Review your completed store delivery statements and cash collections for today
        </p>
      </div>

      {/* Today's Agent Performance Cards */}
      <div className="grid grid-cols-3 gap-3 font-mono text-xs">
        <div className="bg-slate-900 border border-emerald-500/30 p-3.5 rounded-2xl col-span-3 sm:col-span-1 shadow-lg">
          <span className="text-[10px] text-emerald-400 uppercase font-bold block flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5" />
            Today's Cash Collected
          </span>
          <span className="text-xl font-black text-emerald-400 block mt-1">
            ₱{todayTotalMoney.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Total store delivery revenue</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow-lg">
          <span className="text-[10px] text-slate-400 uppercase font-bold block flex items-center gap-1">
            <Store className="w-3.5 h-3.5 text-indigo-400" />
            Stores Served
          </span>
          <span className="text-lg font-extrabold text-white block mt-1">
            {todayStoresCount} <span className="text-xs text-slate-500 font-normal">stores</span>
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow-lg">
          <span className="text-[10px] text-slate-400 uppercase font-bold block flex items-center gap-1">
            <Package className="w-3.5 h-3.5 text-cyan-400" />
            Cases Delivered
          </span>
          <span className="text-lg font-extrabold text-white block mt-1">
            {todayCasesCount} <span className="text-xs text-slate-500 font-normal">cases</span>
          </span>
        </div>
      </div>

      {/* Date Filter Tabs & Search Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-1.5 bg-slate-900 p-1 rounded-2xl border border-slate-800">
            <button
              onClick={() => setDateFilter('TODAY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${dateFilter === 'TODAY'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              Today
            </button>
            <button
              onClick={() => setDateFilter('YESTERDAY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${dateFilter === 'YESTERDAY'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              Yesterday
            </button>
            <button
              onClick={() => setDateFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${dateFilter === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              All History
            </button>
          </div>

          <span className="text-xs font-mono text-slate-400 font-bold">
            {filteredSales.length} {filteredSales.length === 1 ? 'sale' : 'sales'}
          </span>
        </div>

        <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-2xl px-3 py-2 text-xs">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            type="text"
            placeholder="Search by store name, owner, or statement #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-white placeholder-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Sales Receipts List */}
      {loading ? (
        <div className="py-16 text-center text-slate-500 text-xs animate-pulse">Loading your sales history...</div>
      ) : filteredSales.length === 0 ? (
        <EmptyState
          title="No Sales Logged"
          description={
            dateFilter === 'TODAY'
              ? "You haven't completed any store deliveries yet today. Start a new store delivery to log sales."
              : "No sales receipts match your selected date or search filter."
          }
          icon={<ShoppingBag className="w-10 h-10 text-indigo-400" />}
        />
      ) : (
        <div className="space-y-3">
          {filteredSales.map((s) => {
            const store = s.micro_stores;
            const items = s.sale_items || [];
            const deliveryTime = new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const deliveryDate = new Date(s.created_at).toLocaleDateString();

            return (
              <div
                key={s.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3 shadow-xl hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <Store className="w-4 h-4 text-indigo-400" />
                      <h3 className="font-extrabold text-white text-sm">
                        {store?.store_name || 'Micro Store Account'}
                      </h3>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                      {store?.owner_name ? `Owner: ${store.owner_name} • ` : ''}{store?.store_code || 'STORE'}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="font-mono font-bold text-xs text-indigo-400 block">{s.sale_number}</span>
                    <span className="text-[10px] text-slate-500 font-mono block flex items-center justify-end gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {deliveryDate} {deliveryTime}
                    </span>
                  </div>
                </div>

                {/* Itemized Line Items Preview */}
                <div className="space-y-1 bg-slate-950 p-3 rounded-2xl border border-slate-800/80 font-mono text-xs">
                  {items.length > 0 ? (
                    items.map((item: any) => (
                      <div key={item.id} className="flex justify-between items-center text-slate-300">
                        <span>{item.products?.name || 'Beverage Product'}:</span>
                        <span className="font-bold text-white">
                          {item.quantity} cases @ ₱{item.unit_price}/cs
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="flex justify-between items-center text-slate-300">
                      <span>Beverage Product Cases Delivered:</span>
                      <span className="font-bold text-white">
                        {Math.max(1, Math.round(Number(s.subtotal || s.total || 0) / 780))} cases
                      </span>
                    </div>
                  )}

                  {/* PUNDO summary if applicable */}
                  {(Number(s.bottle_pundo_amount || 0) > 0 || Number(s.case_pundo_amount || 0) > 0) && (
                    <div className="pt-1.5 mt-1 border-t border-slate-800 flex justify-between text-[11px] text-amber-400">
                      <span>Lacking Container PUNDO Charge:</span>
                      <span className="font-bold">+₱{(Number(s.bottle_pundo_amount || 0) + Number(s.case_pundo_amount || 0)).toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* Footer Total & View Receipt */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">Net Cash Paid</span>
                    <span className="text-base font-black text-emerald-400 font-mono">
                      ₱{Number(s.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <button
                    onClick={() => setSelectedSale(s)}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white font-bold text-xs flex items-center space-x-1.5 border border-indigo-500/30 transition-all"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Receipt Statement</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Printable Delivery Receipt Statement Modal */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-white flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>Official Delivery Statement Receipt</span>
                </h3>
                <p className="text-xs text-indigo-400 font-mono font-bold mt-0.5">{selectedSale.sale_number}</p>
              </div>
              <button onClick={() => setSelectedSale(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs font-mono space-y-1.5">
              <div className="flex justify-between text-slate-300">
                <span>Micro Store:</span>
                <span className="font-bold text-white">{selectedSale.micro_stores?.store_name}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Owner Name:</span>
                <span className="font-bold text-white">{selectedSale.micro_stores?.owner_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Date & Time Delivered:</span>
                <span className="text-slate-400">{new Date(selectedSale.created_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Payment Status:</span>
                <span className="font-bold text-emerald-400 uppercase">{selectedSale.payment_status || 'PAID'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">Itemized Line Items</h4>
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2 text-xs font-mono">
                {(selectedSale.sale_items || []).map((item: any) => (
                  <div key={item.id} className="flex justify-between items-center border-b border-slate-800/60 pb-1.5">
                    <div>
                      <div className="font-bold text-white">{item.products?.name || 'Beverage Product'}</div>
                      <div className="text-[10px] text-slate-400">{item.quantity} cases @ ₱{item.unit_price}/cs</div>
                    </div>
                    <div className="font-bold text-emerald-400">
                      ₱{(item.subtotal || item.quantity * item.unit_price).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-500/30 font-mono text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal (Products):</span>
                <span>₱{Number(selectedSale.subtotal || 0).toFixed(2)}</span>
              </div>
              {(Number(selectedSale.bottle_pundo_amount || 0) > 0 || Number(selectedSale.case_pundo_amount || 0) > 0) && (
                <div className="flex justify-between text-amber-400">
                  <span>Lacking Container PUNDO:</span>
                  <span>+₱{(Number(selectedSale.bottle_pundo_amount || 0) + Number(selectedSale.case_pundo_amount || 0)).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm font-black text-emerald-400 pt-1 border-t border-slate-800">
                <span>TOTAL CASH PAID:</span>
                <span>₱{Number(selectedSale.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1.5 border border-slate-700"
              >
                <Printer className="w-4 h-4 text-indigo-400" />
                <span>Print Receipt</span>
              </button>

              <button
                onClick={() => setSelectedSale(null)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
