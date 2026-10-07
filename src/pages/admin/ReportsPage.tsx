import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { History, FileSpreadsheet } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';

export const ReportsPage: React.FC = () => {
  const { tenant } = useTenant();
  const [activeTab, setActiveTab] = useState<'movements' | 'pundo'>('movements');
  const [movements, setMovements] = useState<any[]>([]);
  const [pundoRows, setPundoRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReportData = async () => {
    if (!tenant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (activeTab === 'movements') {
        const { data: trfs, error: trfErr } = await supabase
          .from('stock_transfers')
          .select(`
            id,
            transfer_number,
            transfer_type,
            created_at,
            from_location:locations!from_location_id(name),
            to_location:locations!to_location_id(name),
            stock_transfer_items(
              id,
              quantity,
              unit,
              item_type,
              products(name, sku),
              returnable_items(name, type)
            )
          `)
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (trfErr) console.error('Error fetching movement transfers:', trfErr);

        const flattened = (trfs || []).flatMap((t: any) =>
          (t.stock_transfer_items || []).map((item: any) => ({
            id: item.id,
            transaction_type: t.transfer_type || 'TRANSFER',
            item_type: item.item_type || (item.products ? 'PRODUCT' : 'RETURNABLE'),
            products: item.products,
            returnable_items: item.returnable_items,
            from_location: t.from_location,
            to_location: t.to_location,
            quantity: item.quantity,
            unit: item.unit || 'case',
            created_at: t.created_at,
          }))
        );

        setMovements(flattened);
      } else if (activeTab === 'pundo') {
        const { data, error: pundoErr } = await supabase
          .from('pundo_ledger')
          .select(`
            *,
            micro_stores(store_name, store_code),
            returnable_items(name, type)
          `)
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false })
          .limit(200);

        if (pundoErr) console.error('Error fetching pundo audit:', pundoErr);

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
      <div className="border-b border-zinc-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">System Reports & Audit Trails</h1>
        <p className="text-sm text-zinc-500 mt-1">Full movement ledger, accountability tracking, and deposit history</p>
      </div>

      <div className="flex gap-1 bg-zinc-100 p-1 rounded-lg w-fit">
        <Button
          variant={activeTab === 'movements' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('movements')}
          className="h-8 gap-1.5 text-xs"
        >
          <History className="w-3.5 h-3.5" />
          <span>Movement Ledger</span>
        </Button>

        <Button
          variant={activeTab === 'pundo' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('pundo')}
          className="h-8 gap-1.5 text-xs"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>PUNDO Ledger Audit</span>
        </Button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-zinc-400">Generating audit report...</div>
      ) : activeTab === 'movements' ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-zinc-400 text-xs">
                      No inventory movements recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  movements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs font-semibold">
                          {m.transaction_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-zinc-900 text-sm">
                        {m.item_type === 'PRODUCT'
                          ? m.products?.name || 'Product'
                          : m.returnable_items?.name || 'Returnable'}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500">{m.from_location?.name || 'External / Supplier'}</TableCell>
                      <TableCell className="text-xs text-zinc-500">{m.to_location?.name || 'External / Delivered'}</TableCell>
                      <TableCell className="text-right font-mono font-semibold text-zinc-900">
                        {m.quantity} {m.unit}
                      </TableCell>
                      <TableCell className="text-right text-xs text-zinc-500">{new Date(m.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Micro Store</TableHead>
                  <TableHead>Container Item</TableHead>
                  <TableHead className="text-center">Delivered (+)</TableHead>
                  <TableHead className="text-center">Returned (-)</TableHead>
                  <TableHead className="text-center">Balance</TableHead>
                  <TableHead className="text-right">Deposit Value</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pundoRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-zinc-400 text-xs">
                      No PUNDO ledger entries recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  pundoRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium text-zinc-900">{r.micro_stores?.store_name}</TableCell>
                      <TableCell className="text-xs text-zinc-600">{r.returnable_items?.name}</TableCell>
                      <TableCell className="text-center font-mono font-medium text-xs">+{r.quantity_in}</TableCell>
                      <TableCell className="text-center font-mono font-medium text-xs">-{r.quantity_out}</TableCell>
                      <TableCell className="text-center font-mono font-bold text-zinc-900">{r.balance_quantity}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-zinc-900">₱{Number(r.balance_value).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-xs text-zinc-500">{new Date(r.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
