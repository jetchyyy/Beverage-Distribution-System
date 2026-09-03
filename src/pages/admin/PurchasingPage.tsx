import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import type { Supplier, Product, Warehouse } from '../../types/database.types';
import { EmptyState } from '../../components/EmptyState';
import { Plus, CheckCircle, PackageCheck, FileText, Eye, ShieldCheck, Printer, Calendar } from 'lucide-react';

export const PurchasingPage: React.FC = () => {
  const { tenant } = useTenant();
  const { profile } = useAuth();
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
    if (!tenant) return;
    setLoading(true);
    try {
      const { data: sups } = await supabase.from('suppliers').select('*').eq('tenant_id', tenant.id);
      setSuppliers(sups || []);

      const { data: whs } = await supabase.from('warehouses').select('*').eq('tenant_id', tenant.id);
      setWarehouses(whs || []);

      const { data: prods } = await supabase.from('products').select('*').eq('tenant_id', tenant.id);
      setProducts(prods || []);

      // Fetch Stock In Receipts with fallback to purchase_receipts
      const { data: stInRes, error: stInErr } = await supabase
        .from('stock_in_receipts')
        .select(`
          *,
          suppliers(name),
          stock_in_items(*, products(name, sku))
        `)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (!stInErr && stInRes && stInRes.length > 0) {
        setStockInReceipts(stInRes);
      } else {
        // Fallback fetch purchase_receipts
        const { data: oldRcpts } = await supabase
          .from('purchase_receipts')
          .select(`
            *,
            suppliers(name),
            warehouses(name),
            purchase_receipt_items(*, products(name, sku))
          `)
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false });

        const mapped = (oldRcpts || []).map((r) => ({
          ...r,
          control_number: r.reference_number || `STK-IN-${r.id.slice(0, 8)}`,
          stock_in_items: r.purchase_receipt_items?.map((item: any) => ({
            ...item,
            quantity_cases: item.quantity,
            subtotal: item.total_cost || item.quantity * (item.unit_cost || 0),
          })),
        }));

        setStockInReceipts(mapped);
      }
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

  const handleConfirmStockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !selectedProdId || qtyCases <= 0 || !expDate) return;

    setSaving(true);
    setError(null);

    try {
      // 1. Generate Unique Stock In Control Number
      const controlNum = `STK-IN-${Date.now().toString().slice(-6)}`;
      const selectedSup = suppliers.find((s) => s.id === selectedSupId);
      const totalAmount = qtyCases * unitCost;

      // 2. Create Stock In Receipt Record
      let stockInId: string | null = null;

      const { data: newStIn, error: stInErr } = await supabase
        .from('stock_in_receipts')
        .insert([
          {
            tenant_id: tenant.id,
            control_number: controlNum,
            supplier_id: selectedSupId || null,
            supplier_name: selectedSup?.name || 'Direct Supplier',
            reference_number: refNumber || `REF-${Date.now().toString().slice(-6)}`,
            total_cases: qtyCases,
            total_amount: totalAmount,
            notes,
            received_by: profile?.id || null,
          },
        ])
        .select()
        .maybeSingle();

      if (!stInErr && newStIn) {
        stockInId = newStIn.id;
        // Insert item line
        await supabase.from('stock_in_items').insert([
          {
            stock_in_receipt_id: newStIn.id,
            product_id: selectedProdId,
            batch_number: batchNum.toUpperCase().trim(),
            manufacture_date: mfgDate || null,
            expiry_date: expDate,
            quantity_cases: qtyCases,
            unit_price: unitCost,
            subtotal: totalAmount,
          },
        ]);
      } else {
        // Fallback insert to purchase_receipts if stock_in_receipts table pending
        const mainWh = warehouses[0];
        const { data: oldRcpt } = await supabase
          .from('purchase_receipts')
          .insert([
            {
              tenant_id: tenant.id,
              supplier_id: selectedSupId || null,
              warehouse_id: mainWh?.id || null,
              reference_number: controlNum,
              status: 'CONFIRMED',
              created_by: profile?.id || null,
            },
          ])
          .select()
          .single();

        if (oldRcpt) {
          stockInId = oldRcpt.id;
          await supabase.from('purchase_receipt_items').insert([
            {
              purchase_receipt_id: oldRcpt.id,
              product_id: selectedProdId,
              quantity: qtyCases,
              unit: 'case',
              unit_cost: unitCost,
              total_cost: totalAmount,
            },
          ]);
        }
      }

      // 3. Create FIFO Batch Lot for Warehouse
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

      // 4. Update Main Warehouse Inventory Balance
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
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center space-x-2">
            <PackageCheck className="w-6 h-6 text-indigo-400" />
            <span>Stock In & Warehouse Receiving Management</span>
          </h1>
          <p className="text-slate-400 text-sm">
            Record batch stock-in transactions, generate Control Numbers & receive supplier deliveries
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsSupModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center space-x-2 transition-all"
          >
            <Plus className="w-4 h-4 text-indigo-400" />
            <span>Add Supplier</span>
          </button>
          <button
            onClick={openStockInModal}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-2 transition-all shadow-lg shadow-emerald-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Stock In Receiving</span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-extrabold text-white flex items-center space-x-2">
          <FileText className="w-5 h-5 text-indigo-400" />
          <span>Stock In Control Receipts Ledger ({stockInReceipts.length})</span>
        </h2>

        {loading ? (
          <div className="py-12 text-center text-slate-500 animate-pulse">Loading Stock In control receipts...</div>
        ) : stockInReceipts.length === 0 ? (
          <EmptyState
            title="No Stock In Receipts Logged"
            description="No stock receiving records found. Click '+ New Stock In Receiving' to log supplier deliveries with unique Control Numbers."
            actionText="New Stock In Receiving"
            onAction={openStockInModal}
          />
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-semibold tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Control Number</th>
                    <th className="px-6 py-4">Supplier</th>
                    <th className="px-6 py-4">Invoice / Ref #</th>
                    <th className="px-6 py-4">Received Items & Quantity</th>
                    <th className="px-6 py-4 text-right">Valuation Amount</th>
                    <th className="px-6 py-4">Date Logged</th>
                    <th className="px-6 py-4 text-right">Receipt Voucher</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {stockInReceipts.map((r) => {
                    const item = r.stock_in_items?.[0] || r.purchase_receipt_items?.[0];
                    const prodName = item?.products?.name || 'Beverage Cases';
                    const casesCount = item?.quantity_cases || item?.quantity || r.total_cases || 0;
                    const valAmount = r.total_amount || (casesCount * (item?.unit_cost || 0));

                    return (
                      <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-emerald-400 text-xs">
                          {r.control_number || r.reference_number}
                        </td>
                        <td className="px-6 py-4 font-semibold text-white">
                          {r.supplier_name || r.suppliers?.name || 'Direct Supplier'}
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-400 text-xs">
                          {r.reference_number || 'N/A'}
                        </td>
                        <td className="px-6 py-4 font-semibold text-white">
                          {prodName} <span className="font-mono text-emerald-400 font-bold">({casesCount} cases)</span>
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-white text-right">
                          ₱{Number(valAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {new Date(r.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setSelectedReceipt(r)}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-xs flex items-center space-x-1 ml-auto border border-slate-700"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Control Voucher</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add Supplier Modal */}
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Contact Person</label>
                <input
                  type="text"
                  placeholder="Account Representative"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
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

      {/* New Stock In Receiving Modal */}
      {isStockInModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl text-slate-100 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold flex items-center space-x-2">
                <PackageCheck className="w-5 h-5 text-emerald-400" />
                <span>New Stock In Batch Receiving</span>
              </h3>
              <button onClick={() => setIsStockInModalOpen(false)} className="text-slate-400">✕</button>
            </div>

            {error && <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl">{error}</div>}

            <form onSubmit={handleConfirmStockIn} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Supplier</label>
                <select
                  value={selectedSupId}
                  onChange={(e) => setSelectedSupId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select supplier account...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Product SKU *</label>
                <select
                  required
                  value={selectedProdId}
                  onChange={(e) => setSelectedProdId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select beverage product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-emerald-400 mb-1">Cases Received *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={qtyCases}
                    onChange={(e) => setQtyCases(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl px-3.5 py-2 text-white font-bold text-base focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Unit Case Cost (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={unitCost}
                    onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-amber-400 mb-1">Batch Lot Number *</label>
                  <input
                    type="text"
                    required
                    value={batchNum}
                    onChange={(e) => setBatchNum(e.target.value)}
                    className="w-full bg-slate-950 border border-amber-500/50 rounded-xl px-3.5 py-2 font-mono font-bold text-white uppercase focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Supplier Ref / Invoice #</label>
                  <input
                    type="text"
                    placeholder="INV-88219"
                    value={refNumber}
                    onChange={(e) => setRefNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Manufacture Date</label>
                  <input
                    type="date"
                    value={mfgDate}
                    onChange={(e) => setMfgDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-amber-400 mb-1">Expiration Date *</label>
                  <input
                    type="date"
                    required
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full bg-slate-950 border border-amber-500/50 rounded-xl px-3.5 py-2 text-white text-xs font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsStockInModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl font-semibold">Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30">
                  {saving ? 'Receiving Stock...' : 'Confirm Stock In & Generate Control #'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Control Voucher Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-lg text-white flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span>Stock In Control Voucher</span>
                </h3>
                <p className="text-xs text-emerald-400 font-mono font-bold mt-0.5">{selectedReceipt.control_number}</p>
              </div>
              <button onClick={() => setSelectedReceipt(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs space-y-2 font-mono">
              <div className="flex justify-between border-b border-slate-800 pb-1 text-slate-300">
                <span>Distributor Tenant:</span>
                <span className="font-bold text-white">{tenant?.name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1 text-slate-300">
                <span>Supplier Name:</span>
                <span className="font-bold text-white">{selectedReceipt.supplier_name || selectedReceipt.suppliers?.name || 'Direct Supplier'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1 text-slate-300">
                <span>Invoice / PO Ref:</span>
                <span className="font-bold text-white">{selectedReceipt.reference_number || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-slate-300 pt-1">
                <span>Date & Time Logged:</span>
                <span className="text-slate-400">{new Date(selectedReceipt.created_at).toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">Received Itemized Line Details</h4>
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs font-mono">
                {selectedReceipt.stock_in_items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-center border-b border-slate-800/80 pb-2">
                    <div>
                      <div className="font-bold text-white">{item.products?.name || 'Beverage Product'}</div>
                      <div className="text-[10px] text-amber-400 font-bold">Batch Lot: {item.batch_number} (Exp: {item.expiry_date})</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-emerald-400 text-sm">{item.quantity_cases} cases</div>
                      <div className="text-[10px] text-slate-400">₱{item.unit_price} / case</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1.5 border border-slate-700"
              >
                <Printer className="w-4 h-4 text-indigo-400" />
                <span>Print Control Receipt</span>
              </button>

              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30"
              >
                Close Control Voucher
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
