import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { useModal } from '../../context/ModalContext';
import type { Supplier, Product, Warehouse } from '../../types/database.types';
import { EmptyState } from '../../components/EmptyState';
import { Plus, PackageCheck, FileText, Eye, Printer, ShieldCheck, X } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

export const PurchasingPage: React.FC = () => {
  const { tenant } = useTenant();
  const { profile } = useAuth();
  const { showError, showSuccess } = useModal();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stockInReceipts, setStockInReceipts] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Stock In Receipt for Printable Modal
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);

  // Modals
  const [isSupModalOpen, setIsSupModalOpen] = useState(false);
  const [isStockInModalOpen, setIsStockInModalOpen] = useState(false);

  // Form State
  const [supName, setSupName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');

  const [selectedSupId, setSelectedSupId] = useState('');
  const [refNumber, setRefNumber] = useState('');
  const [selectedProdId, setSelectedProdId] = useState('');
  const [qtyCases, setQtyCases] = useState<number>(50);
  const [unitCost, setUnitCost] = useState<number>(780);
  const [batchNum, setBatchNum] = useState('');
  const [mfgDate, setMfgDate] = useState('');
  const [expDate, setExpDate] = useState('');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!tenant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [supsRes, whsRes, prodsRes, stInRes] = await Promise.all([
        supabase.from('suppliers').select('*').eq('tenant_id', tenant.id).order('name'),
        supabase.from('warehouses').select('*').eq('tenant_id', tenant.id),
        supabase.from('products').select('*').eq('tenant_id', tenant.id).order('name'),
        supabase
          .from('stock_in_receipts')
          .select(`
            *,
            suppliers(name),
            stock_in_items(*, products(name, sku))
          `)
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false }),
      ]);

      if (supsRes.error) console.error('Error fetching suppliers:', supsRes.error);
      if (whsRes.error) console.error('Error fetching warehouses:', whsRes.error);
      if (prodsRes.error) console.error('Error fetching products:', prodsRes.error);
      if (stInRes.error) console.error('Error fetching stock in receipts:', stInRes.error);

      setSuppliers(supsRes.data || []);
      setWarehouses(whsRes.data || []);
      setProducts(prodsRes.data || []);
      setStockInReceipts(stInRes.data || []);
    } catch (err) {
      console.error('Error fetching stock in data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenant]);

  const openStockInModal = () => {
    const today = new Date();
    const nextYear = new Date(today);
    nextYear.setFullYear(today.getFullYear() + 1);

    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');

    setBatchNum(`LOT-${y}${m}-${Math.floor(1000 + Math.random() * 9000)}`);
    setMfgDate(today.toISOString().split('T')[0]);
    setExpDate(nextYear.toISOString().split('T')[0]);
    setRefNumber(`INV-${Math.floor(100000 + Math.random() * 900000)}`);
    setQtyCases(50);
    setUnitCost(780);
    setError(null);
    setIsStockInModalOpen(true);
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !supName) return;

    setSaving(true);
    try {
      const { error: sErr } = await supabase.from('suppliers').insert([
        {
          tenant_id: tenant.id,
          name: supName.trim(),
          contact_person: contactPerson.trim() || null,
          phone: phone.trim() || null,
          is_active: true,
        },
      ]);

      if (sErr) throw sErr;

      setIsSupModalOpen(false);
      setSupName('');
      setContactPerson('');
      setPhone('');
      fetchData();
      showSuccess({
        title: 'Supplier Added',
        description: `Supplier "${supName.trim()}" has been created successfully.`,
      });
    } catch (err: any) {
      showError({
        title: 'Supplier Creation Failed',
        description: err.message || 'Failed to create supplier.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmStockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !selectedProdId || !batchNum || !expDate || qtyCases <= 0) return;

    setSaving(true);
    setError(null);

    try {
      const controlNumber = `CTRL-${Date.now().toString().slice(-6)}`;
      const totalAmount = qtyCases * unitCost;

      const targetWh = warehouses[0]?.id || null;
      const supplierObj = suppliers.find((s) => s.id === selectedSupId);

      const { data: newReceipt, error: rErr } = await supabase
        .from('stock_in_receipts')
        .insert([
          {
            tenant_id: tenant.id,
            control_number: controlNumber,
            reference_number: refNumber.trim() || null,
            supplier_id: selectedSupId || null,
            supplier_name: supplierObj?.name || 'Direct Supplier',
            warehouse_id: targetWh,
            total_cases: Number(qtyCases),
            total_amount: totalAmount,
            received_by: profile?.id || null,
            notes: notes.trim() || null,
            status: 'RECEIVED',
          },
        ])
        .select()
        .single();

      if (rErr) {
        const { data: legacyReceipt, error: legErr } = await supabase
          .from('purchase_receipts')
          .insert([
            {
              tenant_id: tenant.id,
              receipt_number: controlNumber,
              reference_number: refNumber.trim() || null,
              supplier_id: selectedSupId || null,
              warehouse_id: targetWh,
              total_amount: totalAmount,
              status: 'RECEIVED',
              received_date: new Date().toISOString().split('T')[0],
            },
          ])
          .select()
          .single();

        if (legErr) throw legErr;

        if (legacyReceipt) {
          await supabase.from('purchase_receipt_items').insert([
            {
              receipt_id: legacyReceipt.id,
              product_id: selectedProdId,
              quantity_cases: qtyCases,
              unit_cost: unitCost,
              total_cost: totalAmount,
            },
          ]);
        }
      } else if (newReceipt) {
        await supabase.from('stock_in_items').insert([
          {
            stock_in_id: newReceipt.id,
            product_id: selectedProdId,
            batch_number: batchNum.toUpperCase().trim(),
            expiry_date: expDate,
            quantity_cases: qtyCases,
            unit_price: unitCost,
            total_price: totalAmount,
          },
        ]);
      }

      await supabase.from('product_batches').insert([
        {
          tenant_id: tenant.id,
          product_id: selectedProdId,
          batch_number: batchNum.toUpperCase().trim(),
          manufacture_date: mfgDate || null,
          expiry_date: expDate,
          initial_quantity: Number(qtyCases),
          remaining_quantity: Number(qtyCases),
          unit: 'case',
          status: 'ACTIVE',
        },
      ]);

      let whLocId = warehouses[0]?.location_id;
      if (!whLocId) {
        const { data: whLoc } = await supabase
          .from('locations')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('type', 'WAREHOUSE')
          .limit(1)
          .maybeSingle();
        whLocId = whLoc?.id;
      }

      if (whLocId) {
        const { data: existingBal } = await supabase
          .from('inventory_balances')
          .select('id, quantity')
          .eq('tenant_id', tenant.id)
          .eq('location_id', whLocId)
          .eq('product_id', selectedProdId)
          .limit(1)
          .maybeSingle();

        if (existingBal) {
          await supabase
            .from('inventory_balances')
            .update({
              quantity: Number(existingBal.quantity || 0) + Number(qtyCases),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingBal.id);
        } else {
          await supabase.from('inventory_balances').insert([
            {
              tenant_id: tenant.id,
              location_id: whLocId,
              product_id: selectedProdId,
              quantity: Number(qtyCases),
              unit: 'case',
            },
          ]);
        }
      }

      setIsStockInModalOpen(false);
      setSelectedSupId('');
      setSelectedProdId('');
      setRefNumber('');
      setNotes('');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to complete Stock In receiving.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 flex items-center space-x-2">
            <PackageCheck className="w-5 h-5 text-zinc-800" />
            <span>Stock In & Warehouse Receiving</span>
          </h1>
          <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">
            Record batch stock-in transactions, generate Control Numbers & receive supplier deliveries
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSupModalOpen(true)}
            className="flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Supplier</span>
          </Button>
          <Button
            size="sm"
            onClick={openStockInModal}
            className="flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Stock In</span>
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 flex items-center space-x-2">
          <FileText className="w-4 h-4 text-zinc-600" />
          <span>Control Receipts Ledger ({stockInReceipts.length})</span>
        </h2>

        {loading ? (
          <div className="py-12 text-center text-zinc-400 animate-pulse text-xs">Loading Stock In control receipts...</div>
        ) : stockInReceipts.length === 0 ? (
          <EmptyState
            title="No Stock In Receipts Logged"
            description="No stock receiving records found. Click 'New Stock In' to log supplier deliveries with unique Control Numbers."
            actionText="New Stock In Receiving"
            onAction={openStockInModal}
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm text-zinc-700">
                <thead className="bg-zinc-50 text-zinc-500 uppercase text-[11px] font-medium tracking-wider border-b border-zinc-200">
                  <tr>
                    <th className="px-4 py-3">Control #</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Invoice / Ref #</th>
                    <th className="px-4 py-3">Received Items & Quantity</th>
                    <th className="px-4 py-3 text-right">Valuation Amount</th>
                    <th className="px-4 py-3">Date Logged</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {stockInReceipts.map((r) => {
                    const item = r.stock_in_items?.[0] || r.purchase_receipt_items?.[0];
                    const prodName = item?.products?.name || 'Beverage Cases';
                    const casesCount = item?.quantity_cases || item?.quantity || r.total_cases || 0;
                    const valAmount = r.total_amount || (casesCount * (item?.unit_cost || 0));

                    return (
                      <tr key={r.id} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-zinc-900 text-xs">
                          {r.control_number || r.reference_number}
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-900">
                          {r.supplier_name || r.suppliers?.name || 'Direct Supplier'}
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-500 text-xs">
                          {r.reference_number || 'N/A'}
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-900">
                          {prodName} <span className="font-mono text-zinc-700 font-semibold">({casesCount} cs)</span>
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-zinc-900 text-right">
                          ₱{Number(valAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500">
                          {new Date(r.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedReceipt(r)}
                            className="h-7 text-xs ml-auto"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            <span>Voucher</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Add Supplier Modal */}
      {isSupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-zinc-200 rounded-lg max-w-md w-full p-6 shadow-xl text-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3 mb-3">
              <h3 className="text-base font-semibold">Add Beverage Supplier</h3>
              <button onClick={() => setIsSupModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSupplier} className="space-y-3.5 text-sm">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">Supplier Company Name *</label>
                <Input
                  type="text"
                  required
                  placeholder="San Miguel Brewery Inc."
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">Contact Person</label>
                <Input
                  type="text"
                  placeholder="Account Representative"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t border-zinc-200">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsSupModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={saving}>
                  Save Supplier
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Stock In Receiving Modal */}
      {isStockInModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-zinc-200 rounded-lg max-w-md w-full p-6 shadow-xl text-zinc-900 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <h3 className="text-base font-semibold flex items-center space-x-2">
                <PackageCheck className="w-4 h-4 text-zinc-700" />
                <span>New Stock In Batch Receiving</span>
              </h3>
              <button onClick={() => setIsStockInModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">{error}</div>}

            <form onSubmit={handleConfirmStockIn} className="space-y-3.5 text-sm">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">Select Supplier</label>
                <select
                  value={selectedSupId}
                  onChange={(e) => setSelectedSupId(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-md px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 cursor-pointer"
                >
                  <option value="">Select supplier account...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">Select Product SKU *</label>
                <select
                  required
                  value={selectedProdId}
                  onChange={(e) => setSelectedProdId(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-md px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 cursor-pointer"
                >
                  <option value="">Select beverage product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-zinc-700">Cases Received *</label>
                  <Input
                    type="number"
                    min="1"
                    required
                    value={qtyCases}
                    onChange={(e) => setQtyCases(parseInt(e.target.value) || 1)}
                    className="font-mono text-xs font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-zinc-700">Unit Case Cost (₱)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={unitCost}
                    onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-zinc-700">Batch Lot Number *</label>
                  <Input
                    type="text"
                    required
                    value={batchNum}
                    onChange={(e) => setBatchNum(e.target.value)}
                    className="font-mono uppercase text-xs font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-zinc-700">Supplier Invoice / Ref #</label>
                  <Input
                    type="text"
                    placeholder="INV-88219"
                    value={refNumber}
                    onChange={(e) => setRefNumber(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-zinc-700">Manufacture Date</label>
                  <Input
                    type="date"
                    value={mfgDate}
                    onChange={(e) => setMfgDate(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-zinc-700">Expiration Date *</label>
                  <Input
                    type="date"
                    required
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="text-xs font-mono font-semibold"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-zinc-200">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsStockInModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? 'Receiving...' : 'Confirm Stock In'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Control Voucher Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-zinc-200 rounded-lg max-w-lg w-full p-6 shadow-xl text-zinc-900 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div>
                <h3 className="font-semibold text-base flex items-center space-x-2 text-zinc-900">
                  <ShieldCheck className="w-4 h-4 text-zinc-700" />
                  <span>Stock In Control Voucher</span>
                </h3>
                <p className="text-xs text-zinc-500 font-mono mt-0.5">{selectedReceipt.control_number}</p>
              </div>
              <button onClick={() => setSelectedReceipt(null)} className="text-zinc-400 hover:text-zinc-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-zinc-50 p-3 rounded-md border border-zinc-200 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between border-b border-zinc-200 pb-1 text-zinc-600">
                <span>Distributor Tenant:</span>
                <span className="font-semibold text-zinc-900">{tenant?.name}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-200 pb-1 text-zinc-600">
                <span>Supplier:</span>
                <span className="font-semibold text-zinc-900">{selectedReceipt.supplier_name || selectedReceipt.suppliers?.name || 'Direct Supplier'}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-200 pb-1 text-zinc-600">
                <span>Ref / PO:</span>
                <span className="font-semibold text-zinc-900">{selectedReceipt.reference_number || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-zinc-600 pt-0.5">
                <span>Date Logged:</span>
                <span className="text-zinc-900">{new Date(selectedReceipt.created_at).toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Line Items</h4>
              <div className="bg-zinc-50 border border-zinc-200 rounded-md p-3 space-y-1.5 text-xs font-mono">
                {selectedReceipt.stock_in_items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-center border-b border-zinc-200 pb-1.5 last:border-0 last:pb-0">
                    <div>
                      <div className="font-semibold text-zinc-900">{item.products?.name || 'Beverage Product'}</div>
                      <div className="text-[10px] text-zinc-500">Lot: {item.batch_number} (Exp: {item.expiry_date})</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-zinc-900 text-xs">{item.quantity_cases} cases</div>
                      <div className="text-[10px] text-zinc-500">₱{item.unit_price} / cs</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="flex items-center space-x-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Receipt</span>
              </Button>

              <Button
                size="sm"
                onClick={() => setSelectedReceipt(null)}
              >
                Close Voucher
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
