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
  Printer,
  Package,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';

export const AgentSalesHistory: React.FC = () => {
  const { tenant } = useTenant();
  const { profile } = useAuth();

  const [salesList, setSalesList] = useState<any[]>([]);
  const [pundoMap, setPundoMap] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'YESTERDAY' | 'ALL'>('TODAY');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSale, setSelectedSale] = useState<any | null>(null);

  // Stats
  const [todayTotalMoney, setTodayTotalMoney] = useState(0);
  const [todayStoresCount, setTodayStoresCount] = useState(0);
  const [todayCasesCount, setTodayCasesCount] = useState(0);

  const fetchAgentSalesHistory = async () => {
    if (!tenant) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      let activeAgentId = null;
      let activeTruckId = null;

      if (profile?.id) {
        const { data: agentData } = await supabase
          .from('agents')
          .select('id, assigned_truck_id')
          .eq('tenant_id', tenant.id)
          .eq('user_id', profile.id)
          .limit(1)
          .maybeSingle();

        activeAgentId = agentData?.id;
        activeTruckId = agentData?.assigned_truck_id;
      }

      if (!activeAgentId && profile?.full_name) {
        const { data: agentByName } = await supabase
          .from('agents')
          .select('id, assigned_truck_id')
          .eq('tenant_id', tenant.id)
          .ilike('full_name', profile.full_name)
          .limit(1)
          .maybeSingle();

        activeAgentId = agentByName?.id;
        activeTruckId = agentByName?.assigned_truck_id;
      }

      if (!activeAgentId && !activeTruckId) {
        const { data: trkData } = await supabase
          .from('trucks')
          .select('id')
          .eq('tenant_id', tenant.id)
          .order('truck_code')
          .limit(1)
          .maybeSingle();
        activeTruckId = trkData?.id;
      }

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

      // Fetch linked PUNDO ledger entries for returned containers & deposit records
      const saleIds = allAgentSales.map((s) => s.id);
      const ledgerMap: Record<string, any[]> = {};
      if (saleIds.length > 0) {
        const { data: pData } = await supabase
          .from('pundo_ledger')
          .select('*, returnable_items(*)')
          .eq('tenant_id', tenant.id)
          .in('reference_id', saleIds);

        (pData || []).forEach((p: any) => {
          if (p.reference_id) {
            if (!ledgerMap[p.reference_id]) ledgerMap[p.reference_id] = [];
            ledgerMap[p.reference_id].push(p);
          }
        });
      }
      setPundoMap(ledgerMap);

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
      <div className="border-b border-zinc-200 pb-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-zinc-700" />
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">
            Sales History
          </h1>
        </div>
        <p className="text-xs text-zinc-500 mt-1">
          Review completed store deliveries and collections
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="col-span-3 sm:col-span-1">
          <CardHeader className="p-3.5 pb-1">
            <CardDescription className="text-[10px] uppercase font-semibold text-zinc-500 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" />
              Cash Collected
            </CardDescription>
            <CardTitle className="text-xl font-bold font-mono text-zinc-900 mt-1">
              ₱{todayTotalMoney.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <span className="text-[10px] text-zinc-400">Total revenue today</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3.5 pb-1">
            <CardDescription className="text-[10px] uppercase font-semibold text-zinc-500 flex items-center gap-1">
              <Store className="w-3.5 h-3.5" />
              Stores Served
            </CardDescription>
            <CardTitle className="text-lg font-bold font-mono text-zinc-900 mt-1">
              {todayStoresCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <span className="text-[10px] text-zinc-400">Deliveries</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3.5 pb-1">
            <CardDescription className="text-[10px] uppercase font-semibold text-zinc-500 flex items-center gap-1">
              <Package className="w-3.5 h-3.5" />
              Cases
            </CardDescription>
            <CardTitle className="text-lg font-bold font-mono text-zinc-900 mt-1">
              {todayCasesCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <span className="text-[10px] text-zinc-400">Delivered</span>
          </CardContent>
        </Card>
      </div>

      {/* Date Filter Tabs & Search Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg">
            <Button
              variant={dateFilter === 'TODAY' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setDateFilter('TODAY')}
              className="h-7 text-xs"
            >
              Today
            </Button>
            <Button
              variant={dateFilter === 'YESTERDAY' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setDateFilter('YESTERDAY')}
              className="h-7 text-xs"
            >
              Yesterday
            </Button>
            <Button
              variant={dateFilter === 'ALL' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setDateFilter('ALL')}
              className="h-7 text-xs"
            >
              All History
            </Button>
          </div>

          <span className="text-xs font-mono text-zinc-500 font-medium">
            {filteredSales.length} {filteredSales.length === 1 ? 'sale' : 'sales'}
          </span>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
          <Input
            type="text"
            placeholder="Search by store name, owner, or statement #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Sales List */}
      {loading ? (
        <div className="py-16 text-center text-zinc-400 text-xs">Loading sales records...</div>
      ) : filteredSales.length === 0 ? (
        <EmptyState
          title="No Sales Logged"
          description={
            dateFilter === 'TODAY'
              ? "You haven't completed any store deliveries yet today. Start a new delivery to log sales."
              : "No sales receipts match your selected filter."
          }
          icon={<ShoppingBag className="w-8 h-8 text-zinc-400" />}
        />
      ) : (
        <div className="space-y-3">
          {filteredSales.map((s) => {
            const store = s.micro_stores;
            const items = s.sale_items || [];
            const deliveryTime = new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const deliveryDate = new Date(s.created_at).toLocaleDateString();

            let deliveredCases = 0;
            items.forEach((item: any) => {
              deliveredCases += Number(item.quantity || 0);
            });
            if (deliveredCases === 0) {
              deliveredCases = Math.max(1, Math.round(Number(s.subtotal || s.total || 0) / 780));
            }

            const salePundoEntries = pundoMap[s.id] || [];
            const returnedEntries = salePundoEntries.filter((p: any) => p.transaction_type === 'RETURNED_EMPTY');
            let returnedCases = 0;
            let returnedBottles = 0;
            returnedEntries.forEach((r: any) => {
              const qty = Math.abs(Number(r.quantity_change || 0));
              const type = r.returnable_items?.item_type || r.returnable_items?.type || '';
              const name = (r.returnable_items?.name || '').toLowerCase();
              if (type === 'CASE' || name.includes('case')) {
                returnedCases += qty;
              } else {
                returnedBottles += qty;
              }
            });

            const lackingDeposit = Number(s.bottle_pundo_amount || 0) + Number(s.case_pundo_amount || 0);
            const hasLackingDeposit = lackingDeposit > 0;

            return (
              <Card key={s.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between border-b border-zinc-100 pb-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Store className="w-4 h-4 text-zinc-600" />
                        <h3 className="font-bold text-zinc-900 text-sm">
                          {store?.store_name || 'Store Account'}
                        </h3>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        {store?.owner_name ? `Owner: ${store.owner_name} • ` : ''}{store?.store_code || 'STORE'}
                      </p>
                    </div>

                    <div className="text-right">
                      <Badge variant="outline" className="font-mono text-xs">
                        {s.sale_number}
                      </Badge>
                      <span className="text-[10px] text-zinc-400 block mt-1">
                        {deliveryDate} {deliveryTime}
                      </span>
                    </div>
                  </div>

                  {/* Itemized Line Items Preview */}
                  <div className="space-y-1.5 bg-zinc-50 p-3 rounded-lg border border-zinc-200 text-xs">
                    {items.length > 0 ? (
                      items.map((item: any) => (
                        <div key={item.id} className="flex justify-between items-center text-zinc-600">
                          <span>{item.products?.name || 'Beverage'}:</span>
                          <span className="font-mono font-medium text-zinc-900">
                            {item.quantity} cases @ ₱{item.unit_price}/cs
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="flex justify-between items-center text-zinc-600">
                        <span>Cases Delivered:</span>
                        <span className="font-mono font-medium text-zinc-900">
                          {deliveredCases} cases
                        </span>
                      </div>
                    )}

                    {/* Empties Returned & Deposit Breakdown */}
                    <div className="pt-1.5 mt-1 border-t border-zinc-200 space-y-1">
                      <div className="flex justify-between items-center text-zinc-600">
                        <span>Cases Returned:</span>
                        <span className="font-mono font-medium text-zinc-900">
                          {returnedEntries.length > 0
                            ? `${returnedCases} cases`
                            : hasLackingDeposit
                            ? '0 cases (Shortage)'
                            : `${deliveredCases} cases (1:1 Returned)`}
                        </span>
                      </div>

                      {hasLackingDeposit && (
                        <div className="flex justify-between items-center text-amber-700 font-medium text-[11px]">
                          <span>Lacking Container Deposit:</span>
                          <span className="font-mono">+₱{lackingDeposit.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer Total & View Receipt */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase font-semibold block">Total Paid</span>
                      <span className="text-base font-bold text-zinc-900 font-mono">
                        ₱{Number(s.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedSale(s)}
                      className="gap-1.5 text-xs h-8"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Receipt</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Printable Delivery Receipt Statement Modal */}
      <Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
        {selectedSale && (() => {
          const sEntries = pundoMap[selectedSale.id] || [];
          const sReturns = sEntries.filter((p: any) => p.transaction_type === 'RETURNED_EMPTY');
          const sLackingDeposit = Number(selectedSale.bottle_pundo_amount || 0) + Number(selectedSale.case_pundo_amount || 0);

          return (
            <DialogContent className="max-w-md">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <DialogTitle>Delivery Receipt Statement</DialogTitle>
                </div>
                <DialogDescription className="font-mono text-xs">
                  {selectedSale.sale_number} • {new Date(selectedSale.created_at).toLocaleString()}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2 text-xs">
                <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Store:</span>
                    <span className="font-semibold text-zinc-900">{selectedSale.micro_stores?.store_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Owner:</span>
                    <span className="text-zinc-900">{selectedSale.micro_stores?.owner_name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Status:</span>
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      {selectedSale.payment_status || 'PAID'}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-semibold text-zinc-900 uppercase tracking-wider text-[11px]">1. Delivered Products</h4>
                  <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 space-y-2">
                    {(selectedSale.sale_items || []).map((item: any) => (
                      <div key={item.id} className="flex justify-between items-center border-b border-zinc-200 pb-1.5 last:border-0 last:pb-0">
                        <div>
                          <div className="font-medium text-zinc-900">{item.products?.name || 'Beverage'}</div>
                          <div className="text-[10px] text-zinc-500">{item.quantity} cases @ ₱{item.unit_price}/cs</div>
                        </div>
                        <div className="font-mono font-semibold text-zinc-900">
                          ₱{(item.subtotal || item.quantity * item.unit_price).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Container Returns & Deposit Status */}
                <div className="space-y-1.5">
                  <h4 className="font-semibold text-zinc-900 uppercase tracking-wider text-[11px]">2. Container Exchange</h4>
                  <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 space-y-1.5">
                    {sReturns.length > 0 ? (
                      sReturns.map((r: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-zinc-700">
                          <span>{r.returnable_items?.name || 'Returned Empty'}:</span>
                          <span className="font-mono font-medium">{Math.abs(Number(r.quantity_change))} {r.returnable_items?.unit || 'units'}</span>
                        </div>
                      ))
                    ) : sLackingDeposit === 0 ? (
                      <div className="text-emerald-700 font-medium">
                        ✓ 1:1 Complete Container Exchange (No deposit charged)
                      </div>
                    ) : (
                      <div className="text-amber-700">
                        0 empty containers returned (Full deposit charged)
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200 space-y-1">
                  <div className="flex justify-between text-zinc-600">
                    <span>Product Subtotal:</span>
                    <span className="font-mono">₱{Number(selectedSale.subtotal || 0).toFixed(2)}</span>
                  </div>
                  {sLackingDeposit > 0 && (
                    <div className="flex justify-between text-amber-700 font-medium">
                      <span>Lacking Container Deposit:</span>
                      <span className="font-mono">+₱{sLackingDeposit.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-sm font-bold text-zinc-900 pt-1 border-t border-zinc-200">
                    <span>Total Paid:</span>
                    <span className="font-mono text-base">₱{Number(selectedSale.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setSelectedSale(null)}>
                  Close
                </Button>
                <Button onClick={() => window.print()} className="gap-1.5">
                  <Printer className="w-4 h-4" />
                  <span>Print Receipt</span>
                </Button>
              </DialogFooter>
            </DialogContent>
          );
        })()}
      </Dialog>
    </div>
  );
};
