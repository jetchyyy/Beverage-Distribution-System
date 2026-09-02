import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import type { Supplier, Product, Warehouse } from '../../types/database.types';
import { EmptyState } from '../../components/EmptyState';
import { Plus, CheckCircle, PackageCheck } from 'lucide-react';

export const PurchasingPage: React.FC = () => {
  const { tenant } = useTenant();
  const { profile } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  const [isSupModalOpen, setIsSupModalOpen] = useState(false);
  const [isRcptModalOpen, setIsRcptModalOpen] = useState(false);

  const [supName, setSupName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');

  const [selectedSupId, setSelectedSupId] = useState('');
  const [refNumber, setRefNumber] = useState('');
  const [selectedProdId, setSelectedProdId] = useState('');
  const [qty, setQty] = useState(10);
  const [unitCost, setUnitCost] = useState(0);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const { data: sups } = await supabase.from('suppliers').select('*').eq('tenant_id', tenant.id);
      setSuppliers(sups || []);

      const { data: whs } = await supabase.from('warehouses').select('*').eq('tenant_id', tenant.id);
      setWarehouses(whs || []);

      const { data: prods } = await supabase.from('products').select('*').eq('tenant_id', tenant.id);
      setProducts(prods || []);

      const { data: rcpts } = await supabase
        .from('purchase_receipts')
        .select(`
          *,
          suppliers(name),
          warehouses(name),
          purchase_receipt_items(*, products(name, sku))
        `)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      setReceipts(rcpts || []);
    } catch (err) {
      console.error('Error fetching purchasing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenant]);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !supName) return;
    setSaving(true);
    try {
      await supabase.from('suppliers').insert([
        {
          tenant_id: tenant.id,
          name: supName.trim(),
          contact_person: contactPerson,
          phone,
          is_active: true,
        },
      ]);
      setIsSupModalOpen(false);
      setSupName('');
      setContactPerson('');
      setPhone('');
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAndConfirmReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !selectedSupId || !selectedProdId || qty <= 0) return;
    setSaving(true);
    setError(null);

    try {
      const mainWh = warehouses[0];
      if (!mainWh || !mainWh.location_id) throw new Error('Main warehouse location not found.');

      const ref = refNumber || `PO-${Date.now().toString().slice(-6)}`;

      const { data: newRcpt, error: rcptErr } = await supabase
        .from('purchase_receipts')
        .insert([
          {
            tenant_id: tenant.id,
            supplier_id: selectedSupId,
            warehouse_id: mainWh.id,
            reference_number: ref,
            status: 'DRAFT',
            created_by: profile?.id || null,
          },
        ])
        .select()
        .single();

      if (rcptErr) throw rcptErr;

      await supabase.from('purchase_receipt_items').insert([
        {
          purchase_receipt_id: newRcpt.id,
          product_id: selectedProdId,
          quantity: qty,
          unit: 'case',
          unit_cost: unitCost,
          total_cost: qty * unitCost,
        },
      ]);

      const { error: rpcErr } = await supabase.rpc('confirm_purchase_receipt', {
        p_receipt_id: newRcpt.id,
        p_user_id: profile?.id || null,
      });

      if (rpcErr) {
        console.warn('RPC stored procedure fallback:', rpcErr);
        const { data: curBal } = await supabase
          .from('inventory_balances')
          .select('quantity')
          .eq('location_id', mainWh.location_id)
          .eq('product_id', selectedProdId)
          .eq('unit', 'case')
          .single();

        const currentQty = Number(curBal?.quantity || 0);

        await supabase.from('inventory_balances').upsert([
          {
            tenant_id: tenant.id,
            location_id: mainWh.location_id,
            product_id: selectedProdId,
            quantity: currentQty + qty,
            unit: 'case',
            updated_at: new Date().toISOString(),
          },
        ]);

        await supabase.from('inventory_movements').insert([
          {
            tenant_id: tenant.id,
            item_type: 'PRODUCT',
            product_id: selectedProdId,
            to_location_id: mainWh.location_id,
            quantity: qty,
            unit: 'case',
            transaction_type: 'PURCHASE_RECEIPT',
            reference_type: 'purchase_receipt',
            reference_id: newRcpt.id,
            created_by: profile?.id || null,
          },
        ]);

        await supabase.from('purchase_receipts').update({ status: 'CONFIRMED' }).eq('id', newRcpt.id);
      }

      setIsRcptModalOpen(false);
      setSelectedSupId('');
      setSelectedProdId('');
      setRefNumber('');
      setQty(10);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm purchase receipt.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Purchasing & Warehouse Receipts</h1>
          <p className="text-slate-400 text-sm">Supplier order placement and warehouse stock receiving</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsSupModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold border border-slate-700 flex items-center space-x-2 transition-all"
          >
            <Plus className="w-4 h-4 text-indigo-400" />
            <span>Add Supplier</span>
          </button>
          <button
            onClick={() => setIsRcptModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center space-x-2 transition-all shadow-lg shadow-indigo-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>Receive Supplier Purchase</span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center space-x-2">
          <PackageCheck className="w-5 h-5 text-indigo-400" />
          <span>Warehouse Purchase Receipts ({receipts.length})</span>
        </h2>

        {loading ? (
          <div className="py-12 text-center text-slate-500 animate-pulse">Loading purchase receipts...</div>
        ) : receipts.length === 0 ? (
          <EmptyState
            title="No Purchase Receipts Created"
            description="No supplier purchase receipts found. Receive purchases from suppliers to increase main warehouse product inventory."
            actionText="Receive Purchase"
            onAction={() => setIsRcptModalOpen(true)}
          />
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-semibold tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Receipt Ref</th>
                    <th className="px-6 py-4">Supplier</th>
                    <th className="px-6 py-4">Receiving Warehouse</th>
                    <th className="px-6 py-4">Items Received</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {receipts.map((r) => {
                    const item = r.purchase_receipt_items?.[0];
                    return (
                      <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-indigo-400 text-xs">{r.reference_number}</td>
                        <td className="px-6 py-4 font-semibold text-white">{r.suppliers?.name || 'Supplier'}</td>
                        <td className="px-6 py-4 text-slate-400 text-xs">{r.warehouses?.name || 'Main Warehouse'}</td>
                        <td className="px-6 py-4 font-semibold text-white">
                          {item?.products?.name ? `${item.products.name} (${item.quantity} cases)` : `${r.purchase_receipt_items?.length || 0} items`}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {r.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">{new Date(r.created_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {isSupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <h3 className="text-lg font-bold">Add Beverage Supplier</h3>
              <button onClick={() => setIsSupModalOpen(false)} className="text-slate-400">✕</button>
            </div>
            <form onSubmit={handleCreateSupplier} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Supplier Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="San Miguel Brewery Inc."
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Contact Person</label>
                <input
                  type="text"
                  placeholder="Account Representative"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsSupModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl">Save Supplier</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isRcptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <h3 className="text-lg font-bold">Receive Supplier Purchase</h3>
              <button onClick={() => setIsRcptModalOpen(false)} className="text-slate-400">✕</button>
            </div>
            {error && <div className="p-3 mb-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">{error}</div>}
            <form onSubmit={handleCreateAndConfirmReceipt} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Supplier *</label>
                <select
                  required
                  value={selectedSupId}
                  onChange={(e) => setSelectedSupId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="">Select supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">PO / Reference #</label>
                <input
                  type="text"
                  placeholder="PO-88219"
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Product *</label>
                <select
                  required
                  value={selectedProdId}
                  onChange={(e) => setSelectedProdId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="">Select product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-indigo-300 mb-1">Cases Received *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={qty}
                    onChange={(e) => setQty(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-indigo-700/60 rounded-xl px-3 py-2 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Unit Cost (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={unitCost}
                    onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsRcptModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl">Confirm & Add Stock</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
