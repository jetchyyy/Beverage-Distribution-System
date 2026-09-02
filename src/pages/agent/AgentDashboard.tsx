import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { Truck, ShoppingBag, ArrowRight, Package } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const AgentDashboard: React.FC = () => {
  const { tenant } = useTenant();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [truckCode, setTruckCode] = useState('TRK-001');
  const [truckStockCount, setTruckStockCount] = useState(0);
  const [todaySalesTotal, setTodaySalesTotal] = useState(0);
  const [todayStoresCount, setTodayStoresCount] = useState(0);
  const [todayBottlesCollected, setTodayBottlesCollected] = useState(0);
  const [todayCasesCollected, setTodayCasesCollected] = useState(0);
  const [truckInventoryItems, setTruckInventoryItems] = useState<any[]>([]);

  const fetchAgentDashboard = async () => {
    if (!tenant) return;
    try {
      const { data: agData } = await supabase
        .from('agents')
        .select('*, trucks(*)')
        .eq('tenant_id', tenant.id)
        .eq('profile_id', profile?.id || '')
        .single();

      if (agData?.trucks) {
        setTruckCode(agData.trucks.truck_code);
        const locId = agData.trucks.location_id;

        if (locId) {
          const { data: bals } = await supabase
            .from('inventory_balances')
            .select('*, products(name, sku)')
            .eq('location_id', locId);

          let sum = 0;
          bals?.forEach((b) => (sum += Number(b.quantity || 0)));
          setTruckStockCount(sum);
          setTruckInventoryItems(bals || []);
        }
      } else {
        const { data: firstTruck } = await supabase
          .from('trucks')
          .select('*, locations(*)')
          .eq('tenant_id', tenant.id)
          .limit(1)
          .single();

        if (firstTruck) {
          setTruckCode(firstTruck.truck_code);
          if (firstTruck.location_id) {
            const { data: bals } = await supabase
              .from('inventory_balances')
              .select('*, products(name, sku)')
              .eq('location_id', firstTruck.location_id);

            let sum = 0;
            bals?.forEach((b) => (sum += Number(b.quantity || 0)));
            setTruckStockCount(sum);
            setTruckInventoryItems(bals || []);
          }
        }
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: salesToday } = await supabase
        .from('sales')
        .select('*')
        .eq('tenant_id', tenant.id)
        .gte('created_at', todayStart.toISOString());

      let sTotal = 0;
      salesToday?.forEach((s) => (sTotal += Number(s.total || 0)));
      setTodaySalesTotal(sTotal);
      setTodayStoresCount(salesToday?.length || 0);

      const { data: retTxs } = await supabase
        .from('returnable_transactions')
        .select('*, returnable_transaction_items(*, returnable_items(type))')
        .eq('tenant_id', tenant.id)
        .gte('created_at', todayStart.toISOString());

      let btlCount = 0;
      let caseCount = 0;
      retTxs?.forEach((tx) => {
        tx.returnable_transaction_items?.forEach((item: any) => {
          if (item.returnable_items?.type === 'BOTTLE') btlCount += Number(item.quantity || 0);
          if (item.returnable_items?.type === 'CASE') caseCount += Number(item.quantity || 0);
        });
      });
      setTodayBottlesCollected(btlCount);
      setTodayCasesCollected(caseCount);
    } catch (err) {
      console.error('Error fetching agent dashboard:', err);
    }
  };

  useEffect(() => {
    fetchAgentDashboard();
  }, [tenant]);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 border border-indigo-700/50 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-300 bg-indigo-950/80 px-2.5 py-1 rounded-full border border-indigo-700/60">
              Truck: {truckCode}
            </span>
            <h1 className="text-2xl font-black text-white mt-2">
              Good Morning, {profile?.full_name || 'Route Agent'}! 👋
            </h1>
            <p className="text-xs text-indigo-200 mt-1">Ready for today's store delivery route?</p>
          </div>
          <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md hidden sm:block">
            <Truck className="w-10 h-10 text-indigo-200" />
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-indigo-700/40 flex items-center justify-between">
          <button
            onClick={() => navigate('/agent/deliver')}
            className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-base flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/30 touch-target active:scale-95 transition-all"
          >
            <ShoppingBag className="w-5 h-5" />
            <span>START NEW STORE DELIVERY</span>
            <ArrowRight className="w-5 h-5 ml-1" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider font-mono">Today's Summary</h2>

        <div className="grid grid-cols-2 gap-3.5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Sales Amount</div>
            <div className="text-xl font-black text-emerald-400 mt-1 font-mono">
              ₱{todaySalesTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">{todayStoresCount} stores served</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Truck Stock</div>
            <div className="text-xl font-black text-white mt-1 font-mono">{truckStockCount} cases</div>
            <div className="text-[10px] text-indigo-400 mt-0.5">On board vehicle</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Bottles Collected</div>
            <div className="text-xl font-black text-amber-300 mt-1 font-mono">{todayBottlesCollected} pcs</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Empty returns today</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Cases Collected</div>
            <div className="text-xl font-black text-cyan-300 mt-1 font-mono">{todayCasesCollected} cases</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Empty crates returned</div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Package className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-white text-base">My Truck Inventory</h3>
          </div>
          <Link to="/agent/truck" className="text-xs font-bold text-indigo-400 hover:underline">
            View All
          </Link>
        </div>

        {truckInventoryItems.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-xs">
            No stock currently on truck. Transfer cases from warehouse depot to load your truck.
          </div>
        ) : (
          <div className="space-y-2.5">
            {truckInventoryItems.slice(0, 4).map((b) => (
              <div key={b.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="font-bold text-slate-200 text-sm">{b.products?.name}</span>
                <span className="font-extrabold font-mono text-emerald-400 text-sm">
                  {b.quantity} {b.unit}s
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
