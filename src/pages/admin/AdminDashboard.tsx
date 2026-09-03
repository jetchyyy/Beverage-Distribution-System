import React, { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import {
  Truck,
  Store,
  ShoppingBag,
  ArrowUpRight,
  Warehouse as WarehouseIcon,
  Users,
  AlertCircle,
  Plus,
  Coins,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const AdminDashboard: React.FC = () => {
  const { tenant } = useTenant();
  const [loading, setLoading] = useState(true);

  const [productCount, setProductCount] = useState(0);
  const [warehouseStock, setWarehouseStock] = useState(0);
  const [truckStock, setTruckStock] = useState(0);
  const [todaySalesTotal, setTodaySalesTotal] = useState(0);
  const [todaySalesCount, setTodaySalesCount] = useState(0);
  const [activeAgents, setActiveAgents] = useState(0);
  const [activeTrucks, setActiveTrucks] = useState(0);
  const [activeStores, setActiveStores] = useState(0);
  const [totalPundoValue, setTotalPundoValue] = useState(0);
  const [recentSales, setRecentSales] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    if (!isSupabaseConfigured || !tenant) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { count: pCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id);
      setProductCount(pCount || 0);

      const { count: agCount } = await supabase
        .from('agents')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('status', 'ACTIVE');
      setActiveAgents(agCount || 0);

      const { count: trCount } = await supabase
        .from('trucks')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('status', 'ACTIVE');
      setActiveTrucks(trCount || 0);

      const { count: stCount } = await supabase
        .from('micro_stores')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('status', 'ACTIVE');
      setActiveStores(stCount || 0);

      const { data: balances } = await supabase
        .from('inventory_balances')
        .select('quantity, locations(type)')
        .eq('tenant_id', tenant.id);

      let whSum = 0;
      let trkSum = 0;
      balances?.forEach((b: any) => {
        if (b.locations?.type === 'WAREHOUSE') whSum += Number(b.quantity || 0);
        if (b.locations?.type === 'TRUCK') trkSum += Number(b.quantity || 0);
      });
      setWarehouseStock(whSum);
      setTruckStock(trkSum);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: salesToday } = await supabase
        .from('sales')
        .select('total')
        .eq('tenant_id', tenant.id)
        .gte('created_at', todayStart.toISOString());

      let sumSales = 0;
      salesToday?.forEach((s) => (sumSales += Number(s.total || 0)));
      setTodaySalesTotal(sumSales);
      setTodaySalesCount(salesToday?.length || 0);

      const { data: pundoEntries } = await supabase
        .from('pundo_ledger')
        .select('balance_value, micro_store_id, returnable_item_id, created_at')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      const latestMap = new Map<string, number>();
      pundoEntries?.forEach((entry: any) => {
        const key = `${entry.micro_store_id}_${entry.returnable_item_id}`;
        if (!latestMap.has(key)) {
          latestMap.set(key, Number(entry.balance_value || 0));
        }
      });
      let pundoSum = 0;
      latestMap.forEach((val) => (pundoSum += val));
      setTotalPundoValue(pundoSum);

      const { data: recent } = await supabase
        .from('sales')
        .select('id, sale_number, total, created_at, micro_stores(store_name), agents(full_name)')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(5);
      setRecentSales(recent || []);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [tenant]);

  if (!isSupabaseConfigured) {
    return (
      <div className="p-8 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-200">
        <div className="flex items-center space-x-3 mb-2">
          <AlertCircle className="w-6 h-6 text-amber-400" />
          <h3 className="text-lg font-bold">Supabase Credentials Required</h3>
        </div>
        <p className="text-sm">
          Please add your <code className="font-mono bg-slate-900 px-2 py-1 rounded">VITE_SUPABASE_URL</code> and{' '}
          <code className="font-mono bg-slate-900 px-2 py-1 rounded">VITE_SUPABASE_ANON_KEY</code> to environment variables or `.env` file to connect to live Supabase data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">
            {tenant ? tenant.name : 'Distributor Operations'}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time Inventory, Delivery, Agent Truck & Returnables PUNDO Dashboard
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/products"
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 border border-slate-700"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Product</span>
          </Link>
          <Link
            to="/admin/transfers"
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-indigo-600/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Stock Transfer</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-mono tracking-wider font-semibold text-slate-400">
              Today's Sales
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">₱{todaySalesTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <div className="text-xs text-slate-500 mt-1">{todaySalesCount} deliveries completed today</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-mono tracking-wider font-semibold text-slate-400">
              Outstanding PUNDO
            </span>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-300">₱{totalPundoValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <div className="text-xs text-slate-500 mt-1">Unreturned bottle & case deposit value</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-mono tracking-wider font-semibold text-slate-400">
              Warehouse Stock
            </span>
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <WarehouseIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">{warehouseStock.toLocaleString()} <span className="text-sm font-normal text-slate-400">cases</span></div>
            <div className="text-xs text-slate-500 mt-1">{productCount} active registered products</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-mono tracking-wider font-semibold text-slate-400">
              Truck Stock
            </span>
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">{truckStock.toLocaleString()} <span className="text-sm font-normal text-slate-400">cases</span></div>
            <div className="text-xs text-slate-500 mt-1">{activeAgents} agents / {activeTrucks} trucks</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-lg">Recent Store Deliveries</h3>
            <Link to="/admin/sales" className="text-xs font-semibold text-indigo-400 hover:underline flex items-center space-x-1">
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs animate-pulse">Loading transaction records...</div>
          ) : recentSales.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              <ShoppingBag className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
              <p>No sales or deliveries recorded yet today.</p>
              <p className="text-xs text-slate-600 mt-1">When agents complete deliveries on their mobile tablet, transactions will appear here live.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {recentSales.map((s) => (
                <div key={s.id} className="py-3 flex items-center justify-between hover:bg-slate-800/40 px-2 rounded-xl transition-colors">
                  <div>
                    <div className="font-semibold text-white text-sm">{s.micro_stores?.store_name || 'Micro Store'}</div>
                    <div className="text-xs text-slate-500">
                      Ref: <span className="font-mono text-slate-400">{s.sale_number}</span> • Agent: {s.agents?.full_name || 'Agent'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-400 text-sm">₱{Number(s.total).toFixed(2)}</div>
                    <div className="text-[10px] text-slate-500">{new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <h3 className="font-bold text-white text-lg border-b border-slate-800 pb-3">Distributor Summary</h3>

          {/* Live Warehouse & Fleet Breakdown */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-300">
              <span>Inventory Allocation</span>
              <Link to="/admin/warehouse" className="text-indigo-400 hover:underline">View Depot</Link>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <WarehouseIcon className="w-3.5 h-3.5 text-indigo-400" />
                  Main Warehouse Depot:
                </span>
                <span className="font-bold text-emerald-400 text-sm">{warehouseStock.toLocaleString()} cs</span>
              </div>

              <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-cyan-400" />
                  Loaded on Truck Fleet:
                </span>
                <span className="font-bold text-cyan-400 text-sm">{truckStock.toLocaleString()} cs</span>
              </div>

              <div className="flex justify-between items-center bg-indigo-950/40 p-2.5 rounded-lg border border-indigo-500/30 text-white font-bold">
                <span className="text-indigo-300">Total System Stock:</span>
                <span className="text-white text-sm">{(warehouseStock + truckStock).toLocaleString()} cs</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400">Active Route Agents</p>
                  <p className="text-sm font-bold text-white">{activeAgents} registered</p>
                </div>
              </div>
              <Link to="/admin/agents-trucks" className="text-xs text-indigo-400 hover:underline">Manage</Link>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400">Delivery Trucks</p>
                  <p className="text-sm font-bold text-white">{activeTrucks} active units</p>
                </div>
              </div>
              <Link to="/admin/agents-trucks" className="text-xs text-indigo-400 hover:underline">Manage</Link>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400">Micro Store Accounts</p>
                  <p className="text-sm font-bold text-white">{activeStores} stores served</p>
                </div>
              </div>
              <Link to="/admin/stores" className="text-xs text-indigo-400 hover:underline">Manage</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
