import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import type { ReturnableItem, MicroStore } from '../../types/database.types';
import { EmptyState } from '../../components/EmptyState';
import { RotateCcw, Coins, Plus, Edit2, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';

export const ReturnablesPundoPage: React.FC = () => {
  const { tenant } = useTenant();

  const [returnables, setReturnables] = useState<ReturnableItem[]>([]);
  const [stores, setStores] = useState<MicroStore[]>([]);
  const [pundoLedger, setPundoLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal & Edit State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ReturnableItem | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [itemType, setItemType] = useState<'BOTTLE' | 'CASE'>('BOTTLE');
  const [depositRate, setDepositRate] = useState<number>(3.00);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!tenant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [retsRes, stRes, ledgRes] = await Promise.all([
        supabase
          .from('returnable_items')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('name'),
        supabase
          .from('micro_stores')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('store_name'),
        supabase
          .from('pundo_ledger')
          .select('*, micro_stores(store_name), returnable_items(name, item_type)')
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false })
          .limit(500),
      ]);

      if (retsRes.error) console.error('Error fetching returnables:', retsRes.error);
      if (stRes.error) console.error('Error fetching stores:', stRes.error);
      if (ledgRes.error) console.error('Error fetching pundo ledger:', ledgRes.error);

      setReturnables(retsRes.data || []);
      setStores(stRes.data || []);
      setPundoLedger(ledgRes.data || []);
    } catch (err) {
      console.error('Error fetching PUNDO data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenant]);

  const handleCreateOrUpdateReturnable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !code || !name) return;

    setSaving(true);
    setError(null);

    try {
      if (editingItem) {
        // Update
        const { error: err } = await supabase
          .from('returnable_items')
          .update({
            code: code.toUpperCase().trim(),
            name: name.trim(),
            item_type: itemType,
            type: itemType,
            deposit_rate: Number(depositRate),
            pundo_value: Number(depositRate),
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingItem.id);

        if (err) throw err;
      } else {
        // Insert
        const { error: err } = await supabase.from('returnable_items').insert([
          {
            tenant_id: tenant.id,
            code: code.toUpperCase().trim(),
            name: name.trim(),
            item_type: itemType,
            type: itemType,
            deposit_rate: Number(depositRate),
            pundo_value: Number(depositRate),
            unit: itemType === 'BOTTLE' ? 'bottle' : 'case',
            is_active: true,
          },
        ]);

        if (err) throw err;
      }

      setIsModalOpen(false);
      setEditingItem(null);
      setCode('');
      setName('');
      setDepositRate(3.00);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to save returnable item.');
    } finally {
      setSaving(false);
    }
  };

  const handleSeedDefaults = async () => {
    if (!tenant) return;
    setSaving(true);
    setError(null);

    const defaultContainers = [
      {
        tenant_id: tenant.id,
        code: 'SMB-BTL-330',
        name: 'SMB 330ml Returnable Glass Bottle',
        item_type: 'BOTTLE',
        type: 'BOTTLE',
        deposit_rate: 3.00,
        pundo_value: 3.00,
        unit: 'bottle',
        is_active: true,
      },
      {
        tenant_id: tenant.id,
        code: 'SMB-BTL-1L',
        name: 'SMB 1-Liter Heavy Returnable Bottle',
        item_type: 'BOTTLE',
        type: 'BOTTLE',
        deposit_rate: 8.00,
        pundo_value: 8.00,
        unit: 'bottle',
        is_active: true,
      },
      {
        tenant_id: tenant.id,
        code: 'RC-BTL-1.5L',
        name: 'RC Cola 1.5L Returnable Bottle',
        item_type: 'BOTTLE',
        type: 'BOTTLE',
        deposit_rate: 5.00,
        pundo_value: 5.00,
        unit: 'bottle',
        is_active: true,
      },
      {
        tenant_id: tenant.id,
        code: 'CASE-PLASTIC-24',
        name: '24-Bottle Plastic Shell Case / Crate',
        item_type: 'CASE',
        type: 'CASE',
        deposit_rate: 50.00,
        pundo_value: 50.00,
        unit: 'case',
        is_active: true,
      },
      {
        tenant_id: tenant.id,
        code: 'CASE-PLASTIC-12',
        name: '12-Bottle Heavy Duty Case / Crate',
        item_type: 'CASE',
        type: 'CASE',
        deposit_rate: 40.00,
        pundo_value: 40.00,
        unit: 'case',
        is_active: true,
      },
    ];

    try {
      const { error: seedErr } = await supabase.from('returnable_items').upsert(defaultContainers, {
        onConflict: 'tenant_id,code',
      });
      if (seedErr) throw seedErr;
      fetchData();
    } catch (err: any) {
      console.error('Error seeding default returnables:', err);
      setError(err.message || 'Failed to seed default returnable items.');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (item: ReturnableItem) => {
    setEditingItem(item);
    setCode(item.code || '');
    setName(item.name || '');
    setItemType((item.item_type || item.type || 'BOTTLE') as 'BOTTLE' | 'CASE');
    setDepositRate(item.deposit_rate || item.pundo_value || 3.00);
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setEditingItem(null);
    setCode('');
    setName('');
    setItemType('BOTTLE');
    setDepositRate(3.00);
    setIsModalOpen(true);
  };

  // Group PUNDO outstanding balances per micro store
  const storePundoBalances = stores.map((s) => {
    const storeLedger = pundoLedger.filter((l) => l.micro_store_id === s.id);
    let bottleOutstanding = 0;
    let bottleValue = 0;
    let caseOutstanding = 0;
    let caseValue = 0;

    const itemBalances = new Map<string, { qty: number; val: number; type: string }>();
    storeLedger.forEach((entry) => {
      const key = entry.returnable_item_id;
      if (!itemBalances.has(key)) {
        itemBalances.set(key, {
          qty: Number(entry.balance_quantity || 0),
          val: Number(entry.balance_value || 0),
          type: entry.returnable_items?.item_type || 'BOTTLE',
        });
      }
    });

    itemBalances.forEach((b) => {
      if (b.type === 'BOTTLE') {
        bottleOutstanding += b.qty;
        bottleValue += b.val;
      } else {
        caseOutstanding += b.qty;
        caseValue += b.val;
      }
    });

    return {
      store: s,
      bottleOutstanding,
      bottleValue,
      caseOutstanding,
      caseValue,
      totalValue: bottleValue + caseValue,
    };
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Returnables & PUNDO Ledger</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Bottle & case container deposit pricing and micro store accountability
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSeedDefaults}
            disabled={saving}
            className="gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-zinc-600" />
            <span>Seed Standard Containers</span>
          </Button>

          <Button
            onClick={openNewModal}
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Container</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
          {error}
        </div>
      )}

      {/* Section 1: Returnable Container Deposit Rates */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-zinc-700" />
            <span>Configured PUNDO Deposit Rates ({returnables.length})</span>
          </h2>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-zinc-400">Loading container rates...</div>
        ) : returnables.length === 0 ? (
          <EmptyState
            title="No Returnable Items Configured"
            description="Add returnable glass bottles and plastic cases to set up container deposit rates (PUNDO)."
            icon={<RotateCcw className="w-8 h-8 text-zinc-400" />}
            actionText="Seed Standard Containers"
            onAction={handleSeedDefaults}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {returnables.map((item) => {
              const type = item.item_type || item.type || 'BOTTLE';
              const rate = item.deposit_rate || item.pundo_value || 0;

              return (
                <Card key={item.id} className="flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="font-mono text-xs">
                        {item.code}
                      </Badge>
                      <Badge variant={type === 'BOTTLE' ? 'secondary' : 'default'} className="text-xs uppercase">
                        {type}
                      </Badge>
                    </div>
                    <CardTitle className="text-base mt-2">{item.name}</CardTitle>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-zinc-400 block uppercase font-mono">Deposit (PUNDO)</span>
                        <span className="text-lg font-bold text-zinc-900">₱{Number(rate).toFixed(2)} <span className="text-xs font-normal text-zinc-500">/ unit</span></span>
                      </div>

                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => openEditModal(item)}
                        className="h-8 w-8"
                        title="Edit Rate"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Store Outstanding PUNDO Balances */}
      <div className="space-y-4 pt-6 border-t border-zinc-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <Coins className="w-4 h-4 text-zinc-700" />
              <span>Micro Store Outstanding PUNDO Balances</span>
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">Separate bottle & case accounting ledger</p>
          </div>
        </div>

        {stores.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-400 border border-dashed border-zinc-200 rounded-lg">
            No micro store accounts registered.
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Micro Store</TableHead>
                    <TableHead>Bottle Outstanding</TableHead>
                    <TableHead>Bottle Deposit Value</TableHead>
                    <TableHead>Case Outstanding</TableHead>
                    <TableHead>Case Deposit Value</TableHead>
                    <TableHead className="text-right">Total PUNDO Owed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {storePundoBalances.map(({ store, bottleOutstanding, bottleValue, caseOutstanding, caseValue, totalValue }) => (
                    <TableRow key={store.id}>
                      <TableCell className="font-medium text-zinc-900">
                        <div>{store.store_name}</div>
                        <div className="text-xs text-zinc-400 font-mono">{store.store_code}</div>
                      </TableCell>
                      <TableCell className="font-mono text-zinc-700">
                        {bottleOutstanding} <span className="text-xs text-zinc-400">btls</span>
                      </TableCell>
                      <TableCell className="font-mono font-medium text-zinc-900">
                        ₱{bottleValue.toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono text-zinc-700">
                        {caseOutstanding} <span className="text-xs text-zinc-400">cases</span>
                      </TableCell>
                      <TableCell className="font-mono font-medium text-zinc-900">
                        ₱{caseValue.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-zinc-900 text-sm">
                        ₱{totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal for Add / Edit Returnable Item */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Returnable Container Rate' : 'Add Returnable Container Rate'}
            </DialogTitle>
            <DialogDescription>
              Configure deposit rate for glass bottles or plastic cases.
            </DialogDescription>
          </DialogHeader>

          {error && <div className="p-2 bg-red-50 text-red-600 text-xs rounded">{error}</div>}

          <form onSubmit={handleCreateOrUpdateReturnable} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Code *</label>
                <Input
                  type="text"
                  required
                  placeholder="SMB-BTL-330"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="font-mono uppercase text-xs"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Container Name *</label>
                <Input
                  type="text"
                  required
                  placeholder="SMB 330ml Returnable Bottle"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Container Type *</label>
                <select
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value as 'BOTTLE' | 'CASE')}
                  className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                >
                  <option value="BOTTLE">BOTTLE (Glass Bottle)</option>
                  <option value="CASE">CASE (Plastic Shell Crate)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Deposit Rate (₱) *</label>
                <Input
                  type="number"
                  required
                  min={0}
                  step="0.50"
                  value={depositRate}
                  onChange={(e) => setDepositRate(Number(e.target.value))}
                  className="font-mono font-medium"
                />
              </div>
            </div>

            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 text-xs text-zinc-600 space-y-1">
              <p className="font-semibold text-zinc-900">PUNDO Accounting Rule:</p>
              <p>
                Bottle deposits and plastic case deposits are tracked in separate balance ledgers so bottle returns do not cancel out case deposits.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Rate'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
