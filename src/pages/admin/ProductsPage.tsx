import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import type { Product, ProductPackaging, ProductPrice, ReturnableItem, InventoryBalance, ProductBatch } from '../../types/database.types';
import { EmptyState } from '../../components/EmptyState';
import { Package, Plus, RotateCcw, Edit2, Sparkles, Warehouse, Trash2, Edit3, Printer, Calendar, ShieldAlert, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';

const DEFAULT_CATEGORIES = ['Beer', 'Soft Drinks', 'Energy Drinks', 'Juices', 'Water', 'Spirits & Liquors'];

export const ProductsPage: React.FC = () => {
  const { tenant } = useTenant();

  const [products, setProducts] = useState<Product[]>([]);
  const [packagings, setPackagings] = useState<ProductPackaging[]>([]);
  const [prices, setPrices] = useState<ProductPrice[]>([]);
  const [returnables, setReturnables] = useState<ReturnableItem[]>([]);
  const [inventoryBalances, setInventoryBalances] = useState<InventoryBalance[]>([]);
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Edit State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isPackagingModalOpen, setIsPackagingModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [printingBatch, setPrintingBatch] = useState<{ batch: ProductBatch; product: Product } | null>(null);

  // Product Form State
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('San Miguel');
  const [categorySelection, setCategorySelection] = useState('Beer');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [baseUnit, setBaseUnit] = useState('BOTTLE');
  const [initialCases, setInitialCases] = useState<number>(100);
  const [description, setDescription] = useState('');

  // Batch Form State
  const [batchProductId, setBatchProductId] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [mfgDate, setMfgDate] = useState('');
  const [expDate, setExpDate] = useState('');
  const [batchQty, setBatchQty] = useState<number>(50);

  // Packaging & Pricing Form State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [packageName, setPackageName] = useState('CASE');
  const [unitsPerPackage, setUnitsPerPackage] = useState(24);
  const [unitPrice, setUnitPrice] = useState<number>(35);
  const [casePrice, setCasePrice] = useState<number>(780);
  const [isReturnable] = useState(true);
  const [selectedReturnableId, setSelectedReturnableId] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCatalogData = async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const { data: prods } = await supabase.from('products').select('*').eq('tenant_id', tenant.id).order('name');
      setProducts(prods || []);

      const { data: packs } = await supabase.from('product_packaging').select('*').eq('tenant_id', tenant.id);
      setPackagings(packs || []);

      const { data: prcs } = await supabase.from('product_prices').select('*').eq('tenant_id', tenant.id);
      setPrices(prcs || []);

      const { data: rets } = await supabase.from('returnable_items').select('*').eq('tenant_id', tenant.id);
      setReturnables(rets || []);

      const { data: invs } = await supabase.from('inventory_balances').select('*').eq('tenant_id', tenant.id);
      setInventoryBalances(invs || []);

      const { data: btchs } = await supabase
        .from('product_batches')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('expiry_date', { ascending: true });

      setBatches(btchs || []);
    } catch (err) {
      console.error('Error fetching catalog data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogData();
  }, [tenant]);

  const availableCategories = Array.from(
    new Set([...DEFAULT_CATEGORIES, ...products.map((p) => p.category).filter(Boolean)])
  );

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__CUSTOM__') {
      setIsCustomCategory(true);
      setCustomCategory('');
    } else {
      setIsCustomCategory(false);
      setCategorySelection(val);
    }
  };

  const openNewProductModal = () => {
    setEditingProduct(null);
    setSku('');
    setName('');
    setBrand('San Miguel');
    setCategorySelection('Beer');
    setIsCustomCategory(false);
    setCustomCategory('');
    setBaseUnit('BOTTLE');
    setInitialCases(100);
    setDescription('');
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (product: Product) => {
    setEditingProduct(product);
    setSku(product.sku || '');
    setName(product.name || '');
    setBrand(product.brand || 'General');
    setCategorySelection(product.category || 'Beer');
    setIsCustomCategory(false);
    setCustomCategory('');
    setBaseUnit(product.base_unit || 'BOTTLE');
    setDescription(product.description || '');

    const inv = inventoryBalances.find((b) => b.product_id === product.id);
    setInitialCases(Number(inv?.quantity || 0));

    setIsProductModalOpen(true);
  };

  const openAddBatchModal = (productId: string) => {
    setBatchProductId(productId);
    const today = new Date();
    const nextYear = new Date(today);
    nextYear.setFullYear(today.getFullYear() + 1);

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');

    setBatchNumber(`LOT-${year}${month}-${Math.floor(1000 + Math.random() * 9000)}`);
    setMfgDate(today.toISOString().split('T')[0]);
    setExpDate(nextYear.toISOString().split('T')[0]);
    setBatchQty(50);
    setIsBatchModalOpen(true);
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !batchProductId || !batchNumber || !expDate) return;

    setSaving(true);
    setError(null);

    try {
      const { data: newBatch, error: bErr } = await supabase
        .from('product_batches')
        .insert([
          {
            tenant_id: tenant.id,
            product_id: batchProductId,
            batch_number: batchNumber.toUpperCase().trim(),
            manufacture_date: mfgDate || null,
            expiry_date: expDate,
            initial_quantity: Number(batchQty),
            remaining_quantity: Number(batchQty),
            unit: 'case',
            status: 'ACTIVE',
          },
        ])
        .select()
        .single();

      if (bErr) throw bErr;

      let { data: whLoc } = await supabase
        .from('locations')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('type', 'WAREHOUSE')
        .limit(1)
        .single();

      if (!whLoc) {
        const { data: newLoc } = await supabase
          .from('locations')
          .insert([
            {
              tenant_id: tenant.id,
              name: `${tenant.name} Main Depot`,
              type: 'WAREHOUSE',
              is_active: true,
            },
          ])
          .select()
          .single();
        whLoc = newLoc;
      }

      if (whLoc) {
        const existingInv = inventoryBalances.find(
          (b) => b.product_id === batchProductId && b.location_id === whLoc.id
        );

        if (existingInv) {
          await supabase
            .from('inventory_balances')
            .update({
              quantity: Number(existingInv.quantity) + Number(batchQty),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingInv.id);
        } else {
          await supabase.from('inventory_balances').insert([
            {
              tenant_id: tenant.id,
              location_id: whLoc.id,
              product_id: batchProductId,
              quantity: Number(batchQty),
              unit: 'case',
            },
          ]);
        }
      }

      setIsBatchModalOpen(false);
      await fetchCatalogData();

      const targetProd = products.find((p) => p.id === batchProductId);
      if (newBatch && targetProd) {
        setPrintingBatch({ batch: newBatch, product: targetProd });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create product batch.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateOrUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !sku || !name) return;

    const finalCategory = isCustomCategory ? customCategory.trim() : categorySelection;
    if (!finalCategory) {
      setError('Please select or enter a valid category.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let targetProductId = editingProduct?.id;

      if (editingProduct) {
        const { error: updateErr } = await supabase
          .from('products')
          .update({
            sku: sku.toUpperCase().trim(),
            name: name.trim(),
            brand: brand.trim() || 'General',
            category: finalCategory,
            base_unit: baseUnit,
            description,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingProduct.id);

        if (updateErr) throw updateErr;
      } else {
        const { data: newProd, error: prodErr } = await supabase
          .from('products')
          .insert([
            {
              tenant_id: tenant.id,
              sku: sku.toUpperCase().trim(),
              name: name.trim(),
              brand: brand.trim() || 'General',
              category: finalCategory,
              base_unit: baseUnit,
              description,
              is_active: true,
            },
          ])
          .select()
          .single();

        if (prodErr) throw prodErr;
        targetProductId = newProd.id;

        if (newProd) {
          const { data: newPack } = await supabase
            .from('product_packaging')
            .insert([
              {
                tenant_id: tenant.id,
                product_id: newProd.id,
                package_name: 'CASE',
                units_per_package: 24,
                is_returnable: true,
                returnable_item_id: returnables.length > 0 ? returnables[0].id : null,
              },
            ])
            .select()
            .single();

          if (newPack) {
            await supabase.from('product_prices').insert([
              {
                tenant_id: tenant.id,
                product_id: newProd.id,
                packaging_id: newPack.id,
                unit_price: 35,
                case_price: 780,
                price: 780,
                effective_date: new Date().toISOString().split('T')[0],
              },
            ]);
          }

          const today = new Date();
          const nextYear = new Date(today);
          nextYear.setFullYear(today.getFullYear() + 1);

          await supabase.from('product_batches').insert([
            {
              tenant_id: tenant.id,
              product_id: newProd.id,
              batch_number: `LOT-${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}-001`,
              manufacture_date: today.toISOString().split('T')[0],
              expiry_date: nextYear.toISOString().split('T')[0],
              initial_quantity: Number(initialCases),
              remaining_quantity: Number(initialCases),
              unit: 'case',
              status: 'ACTIVE',
            },
          ]);
        }
      }

      if (targetProductId) {
        let { data: whLoc } = await supabase
          .from('locations')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('type', 'WAREHOUSE')
          .limit(1)
          .single();

        if (!whLoc) {
          const { data: newLoc } = await supabase
            .from('locations')
            .insert([
              {
                tenant_id: tenant.id,
                name: `${tenant.name} Main Depot`,
                type: 'WAREHOUSE',
                is_active: true,
              },
            ])
            .select()
            .single();
          whLoc = newLoc;
        }

        if (whLoc) {
          const existingInv = inventoryBalances.find(
            (b) => b.product_id === targetProductId && b.location_id === whLoc.id
          );

          if (existingInv) {
            await supabase
              .from('inventory_balances')
              .update({
                quantity: Number(initialCases),
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingInv.id);
          } else {
            await supabase.from('inventory_balances').insert([
              {
                tenant_id: tenant.id,
                location_id: whLoc.id,
                product_id: targetProductId,
                quantity: Number(initialCases),
                unit: 'case',
              },
            ]);
          }
        }
      }

      setIsProductModalOpen(false);
      setEditingProduct(null);
      setSku('');
      setName('');
      setDescription('');
      setInitialCases(100);
      setIsCustomCategory(false);
      await fetchCatalogData();
    } catch (err: any) {
      setError(err.message || 'Failed to save product SKU.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${productName}"? This will remove its prices, packaging, batches, and warehouse inventory.`)) return;

    setSaving(true);
    setError(null);

    try {
      const { error: delErr } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (delErr) throw delErr;
      await fetchCatalogData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete product.');
    } finally {
      setSaving(false);
    }
  };

  const openPackagingModalForProduct = (productId: string) => {
    setSelectedProductId(productId);
    const existingPack = packagings.find((pk) => pk.product_id === productId);
    const existingPrice = prices.find((pr) => pr.product_id === productId);

    if (existingPack) {
      setPackageName(existingPack.package_name || 'CASE');
      setUnitsPerPackage(existingPack.units_per_package || 24);
      setSelectedReturnableId(existingPack.returnable_item_id || '');
    } else {
      setPackageName('CASE');
      setUnitsPerPackage(24);
      setSelectedReturnableId('');
    }

    if (existingPrice) {
      setCasePrice(Number(existingPrice.case_price || existingPrice.price || 780));
      setUnitPrice(Number(existingPrice.unit_price || 35));
    } else {
      setCasePrice(780);
      setUnitPrice(35);
    }

    setIsPackagingModalOpen(true);
  };

  const handleSeedReturnablesInline = async () => {
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
        code: 'CASE-PLASTIC-24',
        name: '24-Bottle Plastic Shell Case / Crate',
        item_type: 'CASE',
        type: 'CASE',
        deposit_rate: 50.00,
        pundo_value: 50.00,
        unit: 'case',
        is_active: true,
      },
    ];

    try {
      const { data: seeded, error: seedErr } = await supabase
        .from('returnable_items')
        .upsert(defaultContainers, { onConflict: 'tenant_id,code' })
        .select();

      if (seedErr) throw seedErr;

      setReturnables(seeded || []);
      if (seeded && seeded.length > 0) {
        setSelectedReturnableId(seeded[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to seed returnable items.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePackaging = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !selectedProductId) return;

    setSaving(true);
    setError(null);

    try {
      const existingPack = packagings.find((pk) => pk.product_id === selectedProductId);
      let packId = existingPack?.id;

      if (existingPack) {
        const { data: updatedPack, error: updateErr } = await supabase
          .from('product_packaging')
          .update({
            package_name: packageName.toUpperCase().trim(),
            units_per_package: Number(unitsPerPackage),
            is_returnable: isReturnable,
            returnable_item_id: selectedReturnableId || null,
          })
          .eq('id', existingPack.id)
          .select()
          .single();

        if (updateErr) throw updateErr;
        packId = updatedPack.id;
      } else {
        const { data: newPack, error: insertErr } = await supabase
          .from('product_packaging')
          .insert([
            {
              tenant_id: tenant.id,
              product_id: selectedProductId,
              package_name: packageName.toUpperCase().trim(),
              units_per_package: Number(unitsPerPackage),
              is_returnable: isReturnable,
              returnable_item_id: selectedReturnableId || null,
            },
          ])
          .select()
          .single();

        if (insertErr) throw insertErr;
        packId = newPack.id;
      }

      const existingPrice = prices.find((pr) => pr.product_id === selectedProductId);

      if (existingPrice) {
        const { error: prErr } = await supabase
          .from('product_prices')
          .update({
            packaging_id: packId,
            unit_price: Number(unitPrice),
            case_price: Number(casePrice),
            price: Number(casePrice),
            effective_date: new Date().toISOString().split('T')[0],
          })
          .eq('id', existingPrice.id);

        if (prErr) throw prErr;
      } else {
        const { error: prErr } = await supabase.from('product_prices').insert([
          {
            tenant_id: tenant.id,
            product_id: selectedProductId,
            packaging_id: packId,
            unit_price: Number(unitPrice),
            case_price: Number(casePrice),
            price: Number(casePrice),
            effective_date: new Date().toISOString().split('T')[0],
          },
        ]);

        if (prErr) throw prErr;
      }

      setIsPackagingModalOpen(false);
      await fetchCatalogData();
    } catch (err: any) {
      console.error('Packaging save error:', err);
      setError(err.message || 'Failed to save packaging and price configuration.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Product Catalog & FIFO Batch Management</h1>
          <p className="text-slate-400 text-sm">Configure prices, FIFO lot expiration dates & printable batch stickers</p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to="/admin/pundo"
            className="px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30 flex items-center space-x-2 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Configure PUNDO Container Rates</span>
          </Link>

          <button
            onClick={openNewProductModal}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center space-x-2 transition-all shadow-lg shadow-indigo-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product SKU</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl font-medium">
          {error}
        </div>
      )}

      {/* Instructional Callout Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1.5">
          <div className="flex items-center space-x-2 text-indigo-400 font-bold">
            <Tag className="w-4 h-4" />
            <span>1. FIFO Batch Lots & Expiry Tracking (Active)</span>
          </div>
          <p className="text-slate-400">
            Products automatically track **Batch Lot Numbers** and **Expiry Dates**. Inventory is dispatched strictly **First-In, First-Out (FIFO)** to prevent stock expiration.
          </p>
        </div>

        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1.5">
          <div className="flex items-center space-x-2 text-emerald-400 font-bold">
            <Printer className="w-4 h-4" />
            <span>2. Thermal Printable Batch Stickers</span>
          </div>
          <p className="text-slate-400">
            Click **Print Batch Sticker** on any batch lot to generate thermal-ready 4"x2" labels with product details, barcode, and expiry date for physical pallets.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-500 animate-pulse">Loading beverage catalog...</div>
      ) : products.length === 0 ? (
        <EmptyState
          title="No Products in Catalog"
          description="Your beverage catalog is empty. Add San Miguel, RC, or other beverage products to start managing warehouse and agent truck stock."
          icon={<Package className="w-10 h-10 text-indigo-400" />}
          actionText="Add Product SKU"
          onAction={openNewProductModal}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.map((p) => {
            const prodPacks = packagings.filter((pk) => pk.product_id === p.id);
            const prodPrices = prices.filter((pr) => pr.product_id === p.id);
            const prodBatches = batches.filter((b) => b.product_id === p.id);

            let warehouseCases = 0;
            inventoryBalances.forEach((inv) => {
              if (inv.product_id === p.id) {
                warehouseCases += Number(inv.quantity || 0);
              }
            });

            return (
              <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 hover:border-slate-700 transition-all flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-indigo-400 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                      {p.sku}
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-bold text-amber-300 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 uppercase">
                        {p.category}
                      </span>
                      <button
                        onClick={() => openEditProductModal(p)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-indigo-400 transition-colors"
                        title="Edit Product Details & Stock"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(p.id, p.name)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-400 transition-colors"
                        title="Delete Product SKU"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-extrabold text-white">{p.name}</h3>
                    <p className="text-xs text-slate-400">Brand: <strong className="text-slate-200">{p.brand}</strong> • Base Unit: <strong className="text-slate-200">{p.base_unit}</strong></p>
                  </div>

                  {/* Warehouse Stock Banner */}
                  <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs">
                    <div className="flex items-center space-x-2">
                      <Warehouse className="w-4 h-4 text-indigo-400 shrink-0" />
                      <div>
                        <span className="text-slate-400">Warehouse Stock: </span>
                        <strong className="text-emerald-400 font-bold">{warehouseCases.toLocaleString()} cases</strong>
                      </div>
                    </div>
                    <button
                      onClick={() => openEditProductModal(p)}
                      className="text-[10px] text-indigo-400 hover:underline font-semibold"
                    >
                      Edit Qty
                    </button>
                  </div>

                  {/* FIFO Batch Lots Section */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase text-amber-400 font-bold flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>FIFO Batch Lots ({prodBatches.length})</span>
                      </span>
                      <button
                        onClick={() => openAddBatchModal(p.id)}
                        className="text-[10px] text-emerald-400 hover:underline font-bold flex items-center space-x-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>+ Receive Batch</span>
                      </button>
                    </div>

                    {prodBatches.length === 0 ? (
                      <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-500 text-center">
                        No active FIFO batches.{' '}
                        <button onClick={() => openAddBatchModal(p.id)} className="text-emerald-400 underline font-semibold">Receive Batch</button>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {prodBatches.map((b, idx) => {
                          const expDateObj = new Date(b.expiry_date);
                          const todayObj = new Date();
                          const diffDays = Math.ceil((expDateObj.getTime() - todayObj.getTime()) / (1000 * 3600 * 24));
                          const isExpiringSoon = diffDays <= 30;

                          return (
                            <div key={b.id} className="p-2 bg-slate-950 rounded-xl border border-slate-800 text-[11px] flex items-center justify-between">
                              <div className="space-y-0.5">
                                <div className="flex items-center space-x-1.5">
                                  <span className="font-mono font-bold text-slate-200">{b.batch_number}</span>
                                  {idx === 0 && (
                                    <span className="text-[9px] font-bold bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-500/30">
                                      FIFO #1
                                    </span>
                                  )}
                                  {isExpiringSoon && (
                                    <span className="text-[9px] font-bold bg-rose-500/20 text-rose-300 px-1.5 py-0.2 rounded border border-rose-500/30 flex items-center space-x-0.5">
                                      <ShieldAlert className="w-2.5 h-2.5" />
                                      <span>FEFO Alert</span>
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  Exp: <strong className={isExpiringSoon ? 'text-rose-400 font-bold' : 'text-slate-200'}>{b.expiry_date}</strong> • Rem: <strong className="text-emerald-400">{b.remaining_quantity} cases</strong>
                                </div>
                              </div>

                              <button
                                onClick={() => setPrintingBatch({ batch: b, product: p })}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center space-x-1 font-bold text-[10px] border border-slate-700 transition-colors"
                                title="Print Batch Thermal Sticker Label"
                              >
                                <Printer className="w-3 h-3 text-indigo-400" />
                                <span>Print Sticker</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-800 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold">Packaging & Selling Prices</span>
                    <button
                      onClick={() => openPackagingModalForProduct(p.id)}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center space-x-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Configure Prices</span>
                    </button>
                  </div>

                  {prodPacks.length === 0 ? (
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-500 text-center">
                      No packaging ratio set.{' '}
                      <button onClick={() => openPackagingModalForProduct(p.id)} className="text-indigo-400 underline font-semibold">Set Prices & Link Container</button>
                    </div>
                  ) : (
                    prodPacks.map((pack) => {
                      const price = prodPrices.find((pr) => pr.packaging_id === pack.id) || prodPrices.find((pr) => pr.product_id === p.id);
                      const linkedReturnable = returnables.find((r) => r.id === pack.returnable_item_id);

                      const displayCasePrice = price?.case_price ?? price?.price ?? 0;
                      const displayUnitPrice = price?.unit_price ?? 0;

                      return (
                        <div key={pack.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-bold text-slate-200">{pack.package_name}</span>
                              <span className="text-slate-500 ml-1">({pack.units_per_package} {p.base_unit.toLowerCase()}s)</span>
                            </div>
                            <div className="text-right">
                              <span className="font-black text-emerald-400 text-sm">₱{Number(displayCasePrice).toFixed(2)} / case</span>
                              <span className="text-[10px] text-slate-400 block">₱{Number(displayUnitPrice).toFixed(2)} / single {p.base_unit.toLowerCase()}</span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">Linked Empty Container:</span>
                            {linkedReturnable ? (
                              <span className="font-bold text-amber-300">
                                {linkedReturnable.name} (₱{linkedReturnable.deposit_rate || linkedReturnable.pundo_value || 0} deposit)
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openPackagingModalForProduct(p.id)}
                                className="text-amber-400 hover:text-amber-300 underline font-semibold text-left"
                              >
                                Link Empty Container PUNDO →
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Receive New Batch Modal */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <h3 className="text-lg font-bold flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                <span>Receive New Product Batch Lot (FIFO)</span>
              </h3>
              <button onClick={() => setIsBatchModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {error && <div className="p-3 mb-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">{error}</div>}

            <form onSubmit={handleCreateBatch} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Batch / Lot Number *</label>
                <input
                  type="text"
                  required
                  placeholder="LOT-202609-001"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono uppercase text-xs text-amber-300 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Manufacture Date</label>
                  <input
                    type="date"
                    value={mfgDate}
                    onChange={(e) => setMfgDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Expiration Date *</label>
                  <input
                    type="date"
                    required
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-rose-400 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Received Cases / Quantity *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={batchQty}
                  onChange={(e) => setBatchQty(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 font-bold"
                />
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-amber-300">💡 FIFO Dispatch Rule:</p>
                <p>
                  Batches with the earliest expiry dates are automatically assigned first to field delivery routes to minimize product expiry waste.
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsBatchModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-600/30">
                  {saving ? 'Receiving...' : 'Save Batch & Print Label'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Product SKU Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <h3 className="text-lg font-bold">
                {editingProduct ? `Edit Product SKU: ${editingProduct.name}` : 'Add Beverage Product SKU'}
              </h3>
              <button onClick={() => setIsProductModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            {error && <div className="p-3 mb-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">{error}</div>}
            <form onSubmit={handleCreateOrUpdateProduct} className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">SKU Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="SMB-PALE-330"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono uppercase text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="San Miguel Pale Pilsen 330ml"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">Category *</label>
                  {isCustomCategory && (
                    <button
                      type="button"
                      onClick={() => setIsCustomCategory(false)}
                      className="text-[10px] text-indigo-400 hover:underline"
                    >
                      ← Back to Category List
                    </button>
                  )}
                </div>

                {!isCustomCategory ? (
                  <select
                    value={categorySelection}
                    onChange={handleCategoryChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <optgroup label="Select Category">
                      {availableCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Custom Category Option">
                      <option value="__CUSTOM__">➕ Add Custom Category...</option>
                    </optgroup>
                  </select>
                ) : (
                  <div className="space-y-1">
                    <input
                      type="text"
                      required
                      placeholder="e.g. Craft Beer or Flavored Water"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="w-full bg-slate-950 border border-indigo-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Brand</label>
                  <input
                    type="text"
                    placeholder="San Miguel / RC"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Base Unit</label>
                  <select
                    value={baseUnit}
                    onChange={(e) => setBaseUnit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="BOTTLE">BOTTLE</option>
                    <option value="CAN">CAN</option>
                  </select>
                </div>
              </div>

              {/* Warehouse Stock Field */}
              <div className="p-3 bg-slate-950 rounded-xl border border-indigo-500/30 space-y-1.5">
                <label className="block text-xs font-bold text-emerald-400 flex items-center justify-between">
                  <span>Warehouse Depot Stock Quantity (Cases) *</span>
                  <span className="text-[10px] text-slate-400 font-normal">Main Depot</span>
                </label>
                <input
                  type="number"
                  min={0}
                  placeholder="e.g. 100"
                  value={initialCases}
                  onChange={(e) => setInitialCases(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 font-extrabold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="330ml returnable glass bottle"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsProductModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30">
                  {saving ? 'Saving...' : editingProduct ? 'Save Changes' : 'Save Product SKU & Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Packaging Ratio & Prices Modal */}
      {isPackagingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <h3 className="text-lg font-bold">Configure Product Packaging & Selling Prices</h3>
              <button onClick={() => setIsPackagingModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {error && <div className="p-3 mb-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">{error}</div>}

            <form onSubmit={handleCreatePackaging} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Product SKU *</label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    openPackagingModalForProduct(e.target.value);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-semibold"
                >
                  <option value="">Select Product SKU...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Package Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="CASE"
                    value={packageName}
                    onChange={(e) => setPackageName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Units per Case *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={unitsPerPackage}
                    onChange={(e) => setUnitsPerPackage(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Selling Case Price (₱) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="0.01"
                    value={casePrice}
                    onChange={(e) => setCasePrice(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Selling Single Bottle Price (₱) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="0.01"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 font-bold"
                  />
                </div>
              </div>

              {/* Linked Empty Container Section */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-amber-300">Linked Empty Container (PUNDO)</label>
                  {returnables.length === 0 && (
                    <button
                      type="button"
                      onClick={handleSeedReturnablesInline}
                      className="text-[10px] text-amber-400 hover:underline flex items-center space-x-1 font-bold"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>Seed Containers</span>
                    </button>
                  )}
                </div>

                {returnables.length === 0 ? (
                  <div className="p-3 bg-slate-950 rounded-xl border border-amber-500/30 text-xs text-amber-200 flex items-center justify-between">
                    <span>No returnable containers set up yet.</span>
                    <button
                      type="button"
                      onClick={handleSeedReturnablesInline}
                      className="px-3 py-1 bg-amber-500/20 text-amber-300 font-bold rounded-lg hover:bg-amber-500/30"
                    >
                      Create Default Containers
                    </button>
                  </div>
                ) : (
                  <select
                    value={selectedReturnableId}
                    onChange={(e) => setSelectedReturnableId(e.target.value)}
                    className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-white font-medium"
                  >
                    <option value="">Select Returnable Empty Container...</option>
                    {returnables.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code}) — ₱{r.deposit_rate || r.pundo_value || 0}/unit deposit
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsPackagingModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30">
                  {saving ? 'Saving...' : 'Save Packaging & Selling Prices'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Thermal Printable Batch Sticker Modal */}
      {printingBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-bold flex items-center space-x-2 text-indigo-400">
                <Printer className="w-4 h-4" />
                <span>Print Thermal Batch Label</span>
              </h3>
              <button onClick={() => setPrintingBatch(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {/* Thermal Label Physical Layout (4" x 2" Sticker format) */}
            <div className="p-4 bg-white text-black rounded-xl space-y-2 border-2 border-dashed border-slate-400 font-sans shadow-inner">
              <div className="flex justify-between items-start border-b border-black pb-1.5">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-tight">{tenant?.name || 'BEVERAGE DISTRIBUTOR'}</div>
                  <div className="text-[9px] font-bold text-slate-800 uppercase">{printingBatch.product.brand} • {printingBatch.product.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-mono font-bold bg-black text-white px-1.5 py-0.5 rounded">
                    {printingBatch.product.sku}
                  </div>
                </div>
              </div>

              <div className="py-1 grid grid-cols-2 gap-2 text-center bg-slate-100 rounded border border-slate-300">
                <div>
                  <span className="text-[8px] font-bold text-slate-600 uppercase block">BATCH NUMBER</span>
                  <span className="text-xs font-mono font-black tracking-wider text-indigo-900">{printingBatch.batch.batch_number}</span>
                </div>
                <div>
                  <span className="text-[8px] font-bold text-slate-600 uppercase block">CASES IN BATCH</span>
                  <span className="text-xs font-mono font-black text-emerald-800">{printingBatch.batch.remaining_quantity} CS</span>
                </div>
              </div>

              <div className="pt-1 flex justify-between items-center text-[10px]">
                <div>
                  <span className="text-[8px] font-bold text-slate-500 block uppercase">MANUFACTURED</span>
                  <span className="font-mono font-bold">{printingBatch.batch.manufacture_date || 'N/A'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[8px] font-bold text-rose-700 block uppercase">EXPIRATION (FIFO)</span>
                  <span className="font-mono font-black text-rose-800 text-xs">{printingBatch.batch.expiry_date}</span>
                </div>
              </div>

              {/* Barcode visual representation */}
              <div className="pt-2 border-t border-slate-300 text-center">
                <div className="h-8 bg-slate-900 w-full flex items-center justify-center space-x-1 px-2 rounded-sm">
                  {[1, 2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 1, 4, 1].map((w, i) => (
                    <span key={i} className="bg-white h-full inline-block" style={{ width: `${w * 2}px` }} />
                  ))}
                </div>
                <span className="text-[8px] font-mono tracking-widest text-slate-700 uppercase block mt-1">
                  *{printingBatch.batch.batch_number}*
                </span>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800 mt-4">
              <button onClick={() => setPrintingBatch(null)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl">Cancel</button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center space-x-2"
              >
                <Printer className="w-4 h-4" />
                <span>Print Sticker Label</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
