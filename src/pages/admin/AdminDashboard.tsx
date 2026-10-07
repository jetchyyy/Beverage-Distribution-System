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
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

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
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [
        pCountRes,
        agCountRes,
        trCountRes,
        stCountRes,
        balancesRes,
        salesTodayRes,
        pundoRes,
        recentRes,
      ] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
        supabase.from('agents').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('status', 'ACTIVE'),
        supabase.from('trucks').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('status', 'ACTIVE'),
        supabase.from('micro_stores').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('status', 'ACTIVE'),
        supabase.from('inventory_balances').select('quantity, locations(type)').eq('tenant_id', tenant.id),
        supabase.from('sales').select('total').eq('tenant_id', tenant.id).gte('created_at', todayStart.toISOString()),
        supabase
          .from('pundo_ledger')
          .select('balance_value, micro_store_id, returnable_item_id, created_at')
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('sales')
          .select('id, sale_number, total, created_at, micro_stores(store_name), agents(full_name)')
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      setProductCount(pCountRes.count || 0);
      setActiveAgents(agCountRes.count || 0);
      setActiveTrucks(trCountRes.count || 0);
      setActiveStores(stCountRes.count || 0);

      let whSum = 0;
      let trkSum = 0;
      balancesRes.data?.forEach((b: any) => {
        if (b.locations?.type === 'WAREHOUSE') whSum += Number(b.quantity || 0);
        if (b.locations?.type === 'TRUCK') trkSum += Number(b.quantity || 0);
      });
      setWarehouseStock(whSum);
      setTruckStock(trkSum);

      let sumSales = 0;
      salesTodayRes.data?.forEach((s) => (sumSales += Number(s.total || 0)));
      setTodaySalesTotal(sumSales);
      setTodaySalesCount(salesTodayRes.data?.length || 0);

      const latestMap = new Map<string, number>();
      pundoRes.data?.forEach((entry: any) => {
        const key = `${entry.micro_store_id}_${entry.returnable_item_id}`;
        if (!latestMap.has(key)) {
          latestMap.set(key, Number(entry.balance_value || 0));
        }
      });
      let pundoSum = 0;
      latestMap.forEach((val) => (pundoSum += val));
      setTotalPundoValue(pundoSum);

      setRecentSales(recentRes.data || []);
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
      <Card className="border-zinc-200">
        <CardContent className="p-6">
          <div className="flex items-center space-x-3 mb-2">
            <AlertCircle className="w-5 h-5 text-zinc-900" />
            <h3 className="text-base font-semibold text-zinc-900">Supabase Credentials Required</h3>
          </div>
          <p className="text-sm text-zinc-600">
            Please add your <code className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-900 border border-zinc-200">VITE_SUPABASE_URL</code> and{' '}
            <code className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-900 border border-zinc-200">VITE_SUPABASE_ANON_KEY</code> to environment variables or `.env` file to connect to live Supabase data.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900">
            {tenant ? tenant.name : 'Distributor Operations'}
          </h1>
          <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">
            Real-time Inventory, Delivery, Fleet & PUNDO Dashboard
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/products" className="flex items-center space-x-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span>Add Product</span>
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/admin/transfers" className="flex items-center space-x-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span>New Stock Transfer</span>
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Today's Sales
              </span>
              <div className="p-2 rounded-md bg-zinc-100 text-zinc-900 border border-zinc-200">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-zinc-900">
                ₱{todaySalesTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-zinc-500 mt-1">{todaySalesCount} deliveries completed today</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Outstanding PUNDO
              </span>
              <div className="p-2 rounded-md bg-zinc-100 text-zinc-900 border border-zinc-200">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-zinc-900">
                ₱{totalPundoValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-zinc-500 mt-1">Unreturned bottle & case deposit value</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Warehouse Stock
              </span>
              <div className="p-2 rounded-md bg-zinc-100 text-zinc-900 border border-zinc-200">
                <WarehouseIcon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-zinc-900">
                {warehouseStock.toLocaleString()} <span className="text-xs font-normal text-zinc-500">cases</span>
              </div>
              <div className="text-xs text-zinc-500 mt-1">{productCount} active registered products</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Truck Fleet Stock
              </span>
              <div className="p-2 rounded-md bg-zinc-100 text-zinc-900 border border-zinc-200">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-zinc-900">
                {truckStock.toLocaleString()} <span className="text-xs font-normal text-zinc-500">cases</span>
              </div>
              <div className="text-xs text-zinc-500 mt-1">{activeAgents} agents / {activeTrucks} trucks</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-zinc-100">
            <div>
              <CardTitle className="text-base font-semibold">Recent Store Deliveries</CardTitle>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/sales" className="text-xs font-medium text-zinc-700 flex items-center space-x-1">
                <span>View All</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent className="p-4">
            {loading ? (
              <div className="py-12 text-center text-zinc-400 text-xs animate-pulse">Loading transaction records...</div>
            ) : recentSales.length === 0 ? (
              <div className="py-10 text-center text-zinc-500 text-sm">
                <ShoppingBag className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                <p className="font-medium text-zinc-700">No deliveries recorded today</p>
                <p className="text-xs text-zinc-400 mt-0.5">When agents complete sales on mobile, transactions will appear live.</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {recentSales.map((s) => (
                  <div key={s.id} className="py-3 flex items-center justify-between hover:bg-zinc-50 px-2 rounded-md transition-colors">
                    <div>
                      <div className="font-medium text-zinc-900 text-sm">{s.micro_stores?.store_name || 'Micro Store'}</div>
                      <div className="text-xs text-zinc-500">
                        Ref: <span className="font-mono text-zinc-700 font-medium">{s.sale_number}</span> • Agent: {s.agents?.full_name || 'Agent'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-zinc-900 text-sm">₱{Number(s.total).toFixed(2)}</div>
                      <div className="text-[10px] text-zinc-400">{new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 border-b border-zinc-100">
            <CardTitle className="text-base font-semibold">Distributor Summary</CardTitle>
          </CardHeader>

          <CardContent className="p-5 space-y-5">
            <div className="bg-zinc-50 p-3.5 rounded-lg border border-zinc-200 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-700">
                <span>Stock Breakdown</span>
                <Link to="/admin/warehouse" className="text-zinc-900 hover:underline font-medium">View Depot</Link>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center bg-white p-2 rounded-md border border-zinc-200">
                  <span className="text-zinc-600 flex items-center gap-1.5">
                    <WarehouseIcon className="w-3.5 h-3.5 text-zinc-500" />
                    Warehouse Depot:
                  </span>
                  <span className="font-semibold text-zinc-900">{warehouseStock.toLocaleString()} cs</span>
                </div>

                <div className="flex justify-between items-center bg-white p-2 rounded-md border border-zinc-200">
                  <span className="text-zinc-600 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-zinc-500" />
                    Truck Fleet:
                  </span>
                  <span className="font-semibold text-zinc-900">{truckStock.toLocaleString()} cs</span>
                </div>

                <div className="flex justify-between items-center bg-zinc-900 p-2 rounded-md text-white font-medium">
                  <span className="text-zinc-200">Total System Stock:</span>
                  <span className="text-white font-semibold">{(warehouseStock + truckStock).toLocaleString()} cs</span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-2.5 rounded-md bg-white border border-zinc-200">
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 rounded-md bg-zinc-100 text-zinc-700">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Route Agents</p>
                    <p className="text-xs font-semibold text-zinc-900">{activeAgents} active</p>
                  </div>
                </div>
                <Link to="/admin/agents-trucks" className="text-xs text-zinc-600 hover:text-zinc-900 font-medium">Manage</Link>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-md bg-white border border-zinc-200">
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 rounded-md bg-zinc-100 text-zinc-700">
                    <Truck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Delivery Trucks</p>
                    <p className="text-xs font-semibold text-zinc-900">{activeTrucks} units</p>
                  </div>
                </div>
                <Link to="/admin/agents-trucks" className="text-xs text-zinc-600 hover:text-zinc-900 font-medium">Manage</Link>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-md bg-white border border-zinc-200">
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 rounded-md bg-zinc-100 text-zinc-700">
                    <Store className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Micro Store Accounts</p>
                    <p className="text-xs font-semibold text-zinc-900">{activeStores} stores</p>
                  </div>
                </div>
                <Link to="/admin/stores" className="text-xs text-zinc-600 hover:text-zinc-900 font-medium">Manage</Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
