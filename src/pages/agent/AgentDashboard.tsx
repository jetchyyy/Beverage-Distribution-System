import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { Truck, ShoppingBag, ArrowRight, Package } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';

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
      let currentAgent: any = null;
      let targetTruck: any = null;

      if (profile?.id) {
        const { data: agData } = await supabase
          .from('agents')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('user_id', profile.id)
          .limit(1)
          .maybeSingle();

        if (agData) {
          currentAgent = agData;
          if (agData.assigned_truck_id) {
            const { data: trk } = await supabase
              .from('trucks')
              .select('*')
              .eq('id', agData.assigned_truck_id)
              .maybeSingle();
            targetTruck = trk;
          }
        }
      }

      // Fallback matching by profile full_name if user_id was not linked yet
      if (!currentAgent && profile?.full_name) {
        const { data: agByName } = await supabase
          .from('agents')
          .select('*')
          .eq('tenant_id', tenant.id)
          .ilike('full_name', profile.full_name)
          .limit(1)
          .maybeSingle();

        if (agByName) {
          currentAgent = agByName;
          if (agByName.assigned_truck_id) {
            const { data: trk } = await supabase
              .from('trucks')
              .select('*')
              .eq('id', agByName.assigned_truck_id)
              .maybeSingle();
            targetTruck = trk;
          }
          if (profile?.id && !agByName.user_id) {
            await supabase.from('agents').update({ user_id: profile.id }).eq('id', agByName.id);
          }
        }
      }

      if (!targetTruck) {
        const { data: firstTruck } = await supabase
          .from('trucks')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('truck_code')
          .limit(1)
          .maybeSingle();

        targetTruck = firstTruck;
      }

      if (targetTruck && targetTruck.location_id) {
        setTruckCode(targetTruck.truck_code);
        const locId = targetTruck.location_id;

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // Filter sales specifically to this agent / assigned truck
        let salesQuery = supabase
          .from('sales')
          .select('total')
          .eq('tenant_id', tenant.id)
          .gte('created_at', todayStart.toISOString());

        if (currentAgent?.id && targetTruck?.id) {
          salesQuery = salesQuery.or(`agent_id.eq.${currentAgent.id},truck_id.eq.${targetTruck.id}`);
        } else if (currentAgent?.id) {
          salesQuery = salesQuery.eq('agent_id', currentAgent.id);
        } else if (targetTruck?.id) {
          salesQuery = salesQuery.eq('truck_id', targetTruck.id);
        }

        const [balsRes, rBalsRes, salesTodayRes] = await Promise.all([
          supabase
            .from('inventory_balances')
            .select('*, products(name, sku)')
            .eq('location_id', locId),
          supabase
            .from('returnable_balances')
            .select('*, returnable_items(name, item_type, type)')
            .eq('location_id', locId),
          salesQuery,
        ]);

        const bals = balsRes.data || [];
        const activeProds = bals.filter((b) => Number(b.quantity || 0) > 0);
        let sumCases = 0;
        activeProds.forEach((b) => (sumCases += Number(b.quantity || 0)));
        setTruckStockCount(sumCases);
        setTruckInventoryItems(activeProds);

        const rBals = rBalsRes.data || [];
        let btlCount = 0;
        let caseCount = 0;

        rBals.forEach((rb) => {
          const qty = Number(rb.quantity || 0);
          const itemType = rb.returnable_items?.item_type || rb.returnable_items?.type || 'BOTTLE';
          if (qty > 0) {
            if (itemType === 'BOTTLE') {
              btlCount += qty;
            } else if (itemType === 'CASE' || itemType === 'CRATE') {
              caseCount += qty;
            }
          }
        });

        setTodayBottlesCollected(btlCount);
        setTodayCasesCollected(caseCount);

        const salesToday = salesTodayRes.data || [];
        let sTotal = 0;
        salesToday.forEach((s) => (sTotal += Number(s.total || 0)));
        setTodaySalesTotal(sTotal);
        setTodayStoresCount(salesToday.length);
      }
    } catch (err) {
      console.error('Error fetching agent dashboard:', err);
    }
  };

  useEffect(() => {
    fetchAgentDashboard();
  }, [tenant, profile]);

  return (
    <div className="space-y-6">
      {/* Welcome & Action Banner */}
      <Card className="bg-zinc-950 text-white border-zinc-900 shadow-md">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Badge
                variant="outline"
                className="bg-zinc-900 text-zinc-100 border-zinc-700 font-mono text-xs"
              >
                Assigned Truck: {truckCode}
              </Badge>
              <CardTitle className="text-2xl text-white mt-2">
                Good day, {profile?.full_name || 'Route Agent'}
              </CardTitle>
              <CardDescription className="text-zinc-400 text-xs">
                Ready for today's store delivery route?
              </CardDescription>
            </div>
            <div className="p-3 bg-zinc-900 rounded-xl hidden sm:block">
              <Truck className="w-8 h-8 text-zinc-300" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Button
            size="lg"
            onClick={() => navigate('/agent/deliver')}
            className="w-full h-12 bg-white text-zinc-950 hover:bg-zinc-100 font-bold text-sm gap-2"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Start Store Delivery</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Summary KPI Cards */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Today's Route Overview</h2>

        <div className="grid grid-cols-2 gap-3">
          <Card
            onClick={() => navigate('/agent/sales-history')}
            className="cursor-pointer hover:border-zinc-400 transition-colors"
          >
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold uppercase text-zinc-500">Sales Amount</CardDescription>
              <CardTitle className="text-xl font-bold font-mono text-zinc-900">
                ₱{todaySalesTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xs text-zinc-500">{todayStoresCount} stores served today</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold uppercase text-zinc-500">Truck Stock</CardDescription>
              <CardTitle className="text-xl font-bold font-mono text-zinc-900">
                {truckStockCount} <span className="text-xs font-normal text-zinc-500">cases</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xs text-zinc-500">On board vehicle</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold uppercase text-zinc-500">Bottles Collected</CardDescription>
              <CardTitle className="text-xl font-bold font-mono text-zinc-900">
                {todayBottlesCollected} <span className="text-xs font-normal text-zinc-500">pcs</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xs text-zinc-500">Empty returns today</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold uppercase text-zinc-500">Cases Collected</CardDescription>
              <CardTitle className="text-xl font-bold font-mono text-zinc-900">
                {todayCasesCollected} <span className="text-xs font-normal text-zinc-500">cs</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xs text-zinc-500">Empty crates returned</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Current Truck Inventory Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-zinc-600" />
              <CardTitle className="text-base">Truck Inventory</CardTitle>
            </div>
            <Link to="/agent/truck" className="text-xs font-semibold text-zinc-900 hover:underline">
              View All
            </Link>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {truckInventoryItems.length === 0 ? (
            <div className="py-6 text-center text-zinc-400 text-xs">
              No stock currently on truck. Transfer cases from warehouse depot to load your truck.
            </div>
          ) : (
            <div className="space-y-2">
              {truckInventoryItems.slice(0, 4).map((b) => (
                <div key={b.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 border border-zinc-200">
                  <span className="font-medium text-zinc-900 text-sm">{b.products?.name}</span>
                  <Badge variant="outline" className="font-mono text-xs font-semibold">
                    {b.quantity} {b.unit}s
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
