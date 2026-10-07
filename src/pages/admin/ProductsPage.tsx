import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useModal } from '../../context/ModalContext';
import type { Product, ProductPackaging, ProductPrice, ReturnableItem, InventoryBalance, ProductBatch } from '../../types/database.types';
import { EmptyState } from '../../components/EmptyState';
import { Package, Plus, RotateCcw, Edit2, Sparkles, Warehouse, Trash2, Edit3, Printer, Calendar, Tag, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';

const DEFAULT_CATEGORIES = ['Beer', 'Soft Drinks', 'Energy Drinks', 'Juices', 'Water', 'Spirits & Liquors'];

export const ProductsPage: React.FC = () => {
  const { tenant } = useTenant();
  const { confirm, showError } = useModal();

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
  const [initialCases, setInitialCases] = useState<number>(0);
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
    if (!tenant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [prodsRes, packsRes, prcsRes, retsRes, invsRes, btchsRes] = await Promise.all([
        supabase.from('products').select('*').eq('tenant_id', tenant.id).order('name'),
        supabase.from('product_packaging').select('*').eq('tenant_id', tenant.id),
        supabase.from('product_prices').select('*').eq('tenant_id', tenant.id),
        supabase.from('returnable_items').select('*').eq('tenant_id', tenant.id),
        supabase.from('inventory_balances').select('*').eq('tenant_id', tenant.id),
        supabase
          .from('product_batches')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('expiry_date', { ascending: true }),
      ]);

      if (prodsRes.error) console.error('Error fetching products:', prodsRes.error);
      if (packsRes.error) console.error('Error fetching packagings:', packsRes.error);
      if (prcsRes.error) console.error('Error fetching prices:', prcsRes.error);
      if (retsRes.error) console.error('Error fetching returnables:', retsRes.error);
      if (invsRes.error) console.error('Error fetching inventory:', invsRes.error);
      if (btchsRes.error) console.error('Error fetching batches:', btchsRes.error);

      setProducts(prodsRes.data || []);
      setPackagings(packsRes.data || []);
      setPrices(prcsRes.data || []);
      setReturnables(retsRes.data || []);
      setInventoryBalances(invsRes.data || []);
      setBatches(btchsRes.data || []);
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
    setInitialCases(0);
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

    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');

    setBatchNumber(`LOT-${y}${m}-${Math.floor(1000 + Math.random() * 9000)}`);
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

      const prod = products.find((p) => p.id === batchProductId);
      if (newBatch && prod) {
        setPrintingBatch({ batch: newBatch, product: prod });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create FIFO batch lot.');
    } finally {
      setSaving(false);
    }
  };

  const handleSeedReturnablesInline = async () => {
    if (!tenant) return;
    try {
      const defaults = [
        {
          tenant_id: tenant.id,
          code: 'RET-SMB-L-BTL',
          name: '1L Glass Beer Bottle Empty',
          type: 'BOTTLE',
          deposit_rate: 10,
          pundo_value: 10,
          unit: 'pcs',
        },
        {
          tenant_id: tenant.id,
          code: 'RET-SMB-L-CASE',
          name: '1L Red Shell Crate Case Empty',
          type: 'CASE',
          deposit_rate: 60,
          pundo_value: 60,
          unit: 'cases',
        },
      ];

      for (const item of defaults) {
        await supabase.from('returnable_items').upsert([item], { onConflict: 'tenant_id,code' });
      }
      await fetchCatalogData();
    } catch (err) {
      console.error('Error seeding returnables:', err);
    }
  };

  const handleCreateOrUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;

    setSaving(true);
    setError(null);

    const finalCategory = isCustomCategory ? customCategory.trim() : categorySelection;

    try {
      let targetProductId = editingProduct?.id;

      if (editingProduct) {
        const { error: prodErr } = await supabase
          .from('products')
          .update({
            sku: sku.toUpperCase().trim(),
            name: name.trim(),
            brand: brand.trim(),
            category: finalCategory,
            base_unit: baseUnit,
            description: description.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingProduct.id);

        if (prodErr) throw prodErr;
      } else {
        const { data: newProd, error: prodErr } = await supabase
          .from('products')
          .insert([
            {
              tenant_id: tenant.id,
              sku: sku.toUpperCase().trim(),
              name: name.trim(),
              brand: brand.trim(),
              category: finalCategory,
              base_unit: baseUnit,
              description: description.trim(),
              is_active: true,
            },
          ])
          .select()
          .single();

        if (prodErr) throw prodErr;
        targetProductId = newProd.id;

        if (newProd) {
          const matchingRet = returnables.find((r) => {
            const rName = (r.name || '').toLowerCase();
            const pName = (name || '').toLowerCase();
            return (r.item_type === 'BOTTLE' || r.type === 'BOTTLE') && (rName.includes(pName) || pName.includes(rName));
          });

          const { data: newPack } = await supabase
            .from('product_packaging')
            .insert([
              {
                tenant_id: tenant.id,
                product_id: newProd.id,
                package_name: 'CASE',
                units_per_package: 24,
                is_returnable: true,
                returnable_item_id: matchingRet?.id || null,
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

          const casesCount = Math.max(0, Number(initialCases) || 0);

          // Only create an initial batch if initial stock quantity is strictly greater than 0
          if (casesCount > 0) {
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
                initial_quantity: casesCount,
                remaining_quantity: casesCount,
                unit: 'case',
                status: 'ACTIVE',
              },
            ]);
          }
        }
      }

      if (targetProductId) {
        const casesCount = Math.max(0, Number(initialCases) || 0);
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
                quantity: casesCount,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingInv.id);
          } else {
            await supabase.from('inventory_balances').insert([
              {
                tenant_id: tenant.id,
                location_id: whLoc.id,
                product_id: targetProductId,
                quantity: casesCount,
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
      setInitialCases(0);
      setIsCustomCategory(false);
      await fetchCatalogData();
    } catch (err: any) {
      setError(err.message || 'Failed to save product SKU.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    const confirmed = await confirm({
      title: 'Delete Product',
      description: `Are you sure you want to delete "${productName}"? This will remove its prices, packaging, batches, and inventory records.`,
      confirmText: 'Delete Product',
      variant: 'destructive',
    });
    if (!confirmed) return;

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
      const msg = err.message || 'Failed to delete product.';
      setError(msg);
      showError({ title: 'Delete Failed', description: msg });
    } finally {
      setSaving(false);
    }
  };

  const openPackagingModalForProduct = (productId: string) => {
    setSelectedProductId(productId);
    const existingPack = packagings.find((pk) => pk.product_id === productId);
    const existingPrice = prices.find((pr) => pr.product_id === productId);

    if (existingPack) {
      setPackageName(existingPack.package_name);
      setUnitsPerPackage(existingPack.units_per_package);
      setSelectedReturnableId(existingPack.returnable_item_id || '');
    } else {
      setPackageName('CASE');
      setUnitsPerPackage(24);
      setSelectedReturnableId(returnables.length > 0 ? returnables[0].id : '');
    }

    if (existingPrice) {
      setUnitPrice(Number(existingPrice.unit_price || 35));
      setCasePrice(Number(existingPrice.case_price || existingPrice.price || 780));
    } else {
      setUnitPrice(35);
      setCasePrice(780);
    }

    setIsPackagingModalOpen(true);
  };

  const handleCreatePackaging = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !selectedProductId) return;

    setSaving(true);
    setError(null);
    try {
      const existingPack = packagings.find((pk) => pk.product_id === selectedProductId);

      let packagingId = existingPack?.id;

      if (existingPack) {
        const { error: pkErr } = await supabase
          .from('product_packaging')
          .update({
            package_name: packageName.toUpperCase().trim(),
            units_per_package: Number(unitsPerPackage),
            is_returnable: isReturnable,
            returnable_item_id: selectedReturnableId || null,
          })
          .eq('id', existingPack.id);

        if (pkErr) throw pkErr;
      } else {
        const { data: newPack, error: pkErr } = await supabase
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

        if (pkErr) throw pkErr;
        packagingId = newPack?.id;
      }

      const existingPrice = prices.find((pr) => pr.product_id === selectedProductId);

      if (existingPrice) {
        const { error: prErr } = await supabase
          .from('product_prices')
          .update({
            packaging_id: packagingId || null,
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
            packaging_id: packagingId || null,
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900">Product Catalog & FIFO Batches</h1>
          <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">Configure SKU prices, FIFO lot expiration dates & thermal batch stickers</p>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/pundo" className="flex items-center space-x-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Container Rates</span>
            </Link>
          </Button>

          <Button size="sm" onClick={openNewProductModal} className="flex items-center space-x-1.5">
            <Plus className="w-3.5 h-3.5" />
            <span>Add Product SKU</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md font-medium">
          {error}
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="bg-zinc-50 p-3.5 rounded-lg border border-zinc-200 space-y-1">
          <div className="flex items-center space-x-1.5 text-zinc-900 font-semibold">
            <Tag className="w-3.5 h-3.5" />
            <span>FIFO Batch Lots & Expiry Tracking</span>
          </div>
          <p className="text-zinc-500">
            Products track Lot Numbers and Expiry Dates. Inventory dispatches First-In, First-Out (FIFO).
          </p>
        </div>

        <div className="bg-zinc-50 p-3.5 rounded-lg border border-zinc-200 space-y-1">
          <div className="flex items-center space-x-1.5 text-zinc-900 font-semibold">
            <Printer className="w-3.5 h-3.5" />
            <span>Thermal Printable Stickers</span>
          </div>
          <p className="text-zinc-500">
            Generate thermal-ready 4"x2" labels with product details, barcode, and expiry date for pallets.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-zinc-400 animate-pulse text-xs">Loading beverage catalog...</div>
      ) : products.length === 0 ? (
        <EmptyState
          title="No Products in Catalog"
          description="Your beverage catalog is empty. Add products to start managing warehouse and agent truck stock."
          icon={<Package className="w-8 h-8 text-zinc-400" />}
          actionText="Add Product SKU"
          onAction={openNewProductModal}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <Card key={p.id} className="flex flex-col justify-between hover:border-zinc-300 transition-colors">
                <CardContent className="p-4 space-y-3.5">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {p.sku}
                      </Badge>
                      <div className="flex items-center space-x-1">
                        <Badge variant="secondary" className="text-[10px]">
                          {p.category}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditProductModal(p)}
                          className="h-7 w-7 text-zinc-500 hover:text-zinc-900"
                          title="Edit Product"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteProduct(p.id, p.name)}
                          className="h-7 w-7 text-zinc-500 hover:text-red-600"
                          title="Delete Product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-semibold text-zinc-900 leading-tight">{p.name}</h3>
                      <p className="text-xs text-zinc-500 mt-0.5">Brand: <strong className="text-zinc-700 font-medium">{p.brand}</strong> • Unit: {p.base_unit}</p>
                    </div>

                    {/* Warehouse Stock Banner */}
                    <div className="flex items-center justify-between bg-zinc-50 p-2 rounded-md border border-zinc-200 text-xs">
                      <div className="flex items-center space-x-2">
                        <Warehouse className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <div>
                          <span className="text-zinc-500">Warehouse: </span>
                          <strong className="text-zinc-900 font-semibold">{warehouseCases.toLocaleString()} cs</strong>
                        </div>
                      </div>
                      <button
                        onClick={() => openEditProductModal(p)}
                        className="text-[11px] text-zinc-700 hover:underline font-medium cursor-pointer"
                      >
                        Edit Qty
                      </button>
                    </div>

                    {/* FIFO Batch Lots Section */}
                    <div className="space-y-1.5 pt-2 border-t border-zinc-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[11px] font-medium text-zinc-600 flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                          <span>FIFO Batches ({prodBatches.length})</span>
                        </span>
                        <button
                          onClick={() => openAddBatchModal(p.id)}
                          className="text-[11px] text-zinc-900 font-medium hover:underline flex items-center space-x-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Batch</span>
                        </button>
                      </div>

                      {prodBatches.length === 0 ? (
                        <div className="p-2 bg-zinc-50 rounded-md border border-zinc-200 text-[11px] text-zinc-400 text-center">
                          No active batches. <button onClick={() => openAddBatchModal(p.id)} className="text-zinc-900 underline font-medium cursor-pointer">Receive</button>
                        </div>
                      ) : (
                        <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
                          {prodBatches.map((b, idx) => {
                            const expDateObj = new Date(b.expiry_date);
                            const todayObj = new Date();
                            const diffDays = Math.ceil((expDateObj.getTime() - todayObj.getTime()) / (1000 * 3600 * 24));
                            const isExpiringSoon = diffDays <= 30;

                            return (
                              <div key={b.id} className="p-1.5 bg-zinc-50 rounded-md border border-zinc-200 text-[11px] flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <div className="flex items-center space-x-1">
                                    <span className="font-mono font-medium text-zinc-900">{b.batch_number}</span>
                                    {idx === 0 && (
                                      <Badge variant="default" className="text-[8px] px-1 py-0 h-4">
                                        FIFO #1
                                      </Badge>
                                    )}
                                    {isExpiringSoon && (
                                      <Badge variant="destructive" className="text-[8px] px-1 py-0 h-4">
                                        {diffDays}d
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-zinc-500">
                                    Exp: {b.expiry_date} • {b.remaining_quantity} cs
                                  </div>
                                </div>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setPrintingBatch({ batch: b, product: p })}
                                  className="h-6 px-1.5 text-[10px]"
                                >
                                  <Printer className="w-3 h-3 mr-0.5 text-zinc-500" />
                                  <span>Label</span>
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-zinc-100 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase font-semibold text-zinc-400">Packaging & Prices</span>
                      <button
                        onClick={() => openPackagingModalForProduct(p.id)}
                        className="text-[11px] text-zinc-700 hover:text-zinc-900 font-medium flex items-center space-x-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Prices</span>
                      </button>
                    </div>

                    {prodPacks.length === 0 ? (
                      <div className="p-2.5 bg-zinc-50 rounded-md border border-zinc-200 text-zinc-500 text-center text-xs">
                        No packaging set. <button onClick={() => openPackagingModalForProduct(p.id)} className="text-zinc-900 underline font-medium cursor-pointer">Configure</button>
                      </div>
                    ) : (
                      prodPacks.map((pack) => {
                        const price = prodPrices.find((pr) => pr.packaging_id === pack.id) || prodPrices.find((pr) => pr.product_id === p.id);
                        const linkedReturnable = returnables.find((r) => r.id === pack.returnable_item_id);

                        const displayCasePrice = price?.case_price ?? price?.price ?? 0;
                        const displayUnitPrice = price?.unit_price ?? 0;

                        return (
                          <div key={pack.id} className="bg-zinc-50 p-2.5 rounded-md border border-zinc-200 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-semibold text-zinc-900">{pack.package_name}</span>
                                <span className="text-zinc-500 text-[11px] ml-1">({pack.units_per_package} {p.base_unit.toLowerCase()}s)</span>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-zinc-900 text-xs">₱{Number(displayCasePrice).toFixed(2)} / cs</span>
                                <span className="text-[10px] text-zinc-500 block">₱{Number(displayUnitPrice).toFixed(2)} / {p.base_unit.toLowerCase()}</span>
                              </div>
                            </div>

                            <div className="pt-1.5 border-t border-zinc-200 flex items-center justify-between text-[10px]">
                              <span className="text-zinc-500">Container:</span>
                              {linkedReturnable ? (
                                <span className="font-medium text-zinc-800">
                                  {linkedReturnable.name} (₱{linkedReturnable.deposit_rate || linkedReturnable.pundo_value || 0})
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openPackagingModalForProduct(p.id)}
                                  className="text-zinc-700 hover:underline font-medium cursor-pointer"
                                >
                                  Link Container →
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Receive New Batch Modal */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-zinc-200 rounded-lg max-w-md w-full p-6 shadow-xl text-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3 mb-3">
              <h3 className="text-base font-semibold flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-zinc-700" />
                <span>Receive Product Batch (FIFO)</span>
              </h3>
              <button onClick={() => setIsBatchModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && <div className="p-2.5 mb-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">{error}</div>}

            <form onSubmit={handleCreateBatch} className="space-y-3.5 text-sm">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">Batch / Lot Number *</label>
                <Input
                  type="text"
                  required
                  placeholder="LOT-202609-001"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  className="font-mono uppercase text-xs font-semibold"
                />
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
                    className="text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">Received Quantity (Cases) *</label>
                <Input
                  type="number"
                  required
                  min={1}
                  value={batchQty}
                  onChange={(e) => setBatchQty(Number(e.target.value))}
                  className="text-xs font-mono font-semibold"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-zinc-200">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsBatchModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? 'Receiving...' : 'Save Batch'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Product SKU Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-zinc-200 rounded-lg max-w-md w-full p-6 shadow-xl text-zinc-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3 mb-3">
              <h3 className="text-base font-semibold">
                {editingProduct ? `Edit SKU: ${editingProduct.name}` : 'Add Beverage Product SKU'}
              </h3>
              <button onClick={() => setIsProductModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            {error && <div className="p-2.5 mb-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">{error}</div>}
            <form onSubmit={handleCreateOrUpdateProduct} className="space-y-3.5 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-zinc-700">SKU Code *</label>
                  <Input
                    type="text"
                    required
                    placeholder="SMB-PALE-330"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="font-mono uppercase text-xs"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="block text-xs font-medium text-zinc-700">Product Name *</label>
                  <Input
                    type="text"
                    required
                    placeholder="San Miguel Pale Pilsen 330ml"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between mb-0.5">
                  <label className="block text-xs font-medium text-zinc-700">Category *</label>
                  {isCustomCategory && (
                    <button
                      type="button"
                      onClick={() => setIsCustomCategory(false)}
                      className="text-[10px] text-zinc-600 hover:underline cursor-pointer"
                    >
                      ← Standard Categories
                    </button>
                  )}
                </div>

                {!isCustomCategory ? (
                  <select
                    value={categorySelection}
                    onChange={handleCategoryChange}
                    className="w-full bg-white border border-zinc-300 rounded-md px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 cursor-pointer"
                  >
                    <optgroup label="Select Category">
                      {availableCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Custom Option">
                      <option value="__CUSTOM__">➕ Add Custom Category...</option>
                    </optgroup>
                  </select>
                ) : (
                  <Input
                    type="text"
                    required
                    placeholder="e.g. Craft Beer or Flavored Water"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="text-xs"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-zinc-700">Brand</label>
                  <Input
                    type="text"
                    placeholder="San Miguel / RC"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-zinc-700">Base Unit</label>
                  <select
                    value={baseUnit}
                    onChange={(e) => setBaseUnit(e.target.value)}
                    className="w-full bg-white border border-zinc-300 rounded-md px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 cursor-pointer"
                  >
                    <option value="BOTTLE">BOTTLE</option>
                    <option value="CAN">CAN</option>
                  </select>
                </div>
              </div>

              {/* Warehouse Stock Field */}
              <div className="p-3 bg-zinc-50 rounded-md border border-zinc-200 space-y-1">
                <label className="block text-xs font-semibold text-zinc-900 flex items-center justify-between">
                  <span>Initial Depot Stock Quantity (Cases)</span>
                  <span className="text-[10px] text-zinc-500 font-normal">Main Depot (0 = no batch)</span>
                </label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={initialCases}
                  onChange={(e) => setInitialCases(Math.max(0, Number(e.target.value) || 0))}
                  className="font-mono text-xs font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">Description</label>
                <Input
                  type="text"
                  placeholder="330ml returnable glass bottle"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-zinc-200">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsProductModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? 'Saving...' : editingProduct ? 'Save Changes' : 'Save SKU & Stock'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Packaging Ratio & Prices Modal */}
      {isPackagingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-zinc-200 rounded-lg max-w-md w-full p-6 shadow-xl text-zinc-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3 mb-3">
              <h3 className="text-base font-semibold">Packaging & Selling Prices</h3>
              <button onClick={() => setIsPackagingModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && <div className="p-2.5 mb-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">{error}</div>}

            <form onSubmit={handleCreatePackaging} className="space-y-3.5 text-sm">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">Product SKU *</label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    openPackagingModalForProduct(e.target.value);
                  }}
                  className="w-full bg-white border border-zinc-300 rounded-md px-3 py-2 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-1 focus:ring-zinc-950 cursor-pointer"
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
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-zinc-700">Package Name *</label>
                  <Input
                    type="text"
                    required
                    placeholder="CASE"
                    value={packageName}
                    onChange={(e) => setPackageName(e.target.value)}
                    className="font-mono uppercase text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-zinc-700">Units per Case *</label>
                  <Input
                    type="number"
                    required
                    min={1}
                    value={unitsPerPackage}
                    onChange={(e) => setUnitsPerPackage(Number(e.target.value))}
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-zinc-700">Selling Case Price (₱) *</label>
                  <Input
                    type="number"
                    required
                    min={0}
                    step="0.01"
                    value={casePrice}
                    onChange={(e) => setCasePrice(Number(e.target.value))}
                    className="font-mono text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-zinc-700">Single Bottle Price (₱) *</label>
                  <Input
                    type="number"
                    required
                    min={0}
                    step="0.01"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                    className="font-mono text-xs font-semibold"
                  />
                </div>
              </div>

              {/* Linked Empty Container Section */}
              <div className="pt-2 border-t border-zinc-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-zinc-800">Linked Returnable Container (PUNDO)</label>
                  {returnables.length === 0 && (
                    <button
                      type="button"
                      onClick={handleSeedReturnablesInline}
                      className="text-[10px] text-zinc-700 hover:underline flex items-center space-x-1 font-medium cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-zinc-500" />
                      <span>Seed Defaults</span>
                    </button>
                  )}
                </div>

                {returnables.length === 0 ? (
                  <div className="p-2.5 bg-zinc-50 rounded-md border border-zinc-200 text-xs text-zinc-600 flex items-center justify-between">
                    <span>No returnables configured yet.</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleSeedReturnablesInline}
                    >
                      Create Default
                    </Button>
                  </div>
                ) : (
                  <select
                    value={selectedReturnableId}
                    onChange={(e) => setSelectedReturnableId(e.target.value)}
                    className="w-full bg-white border border-zinc-300 rounded-md px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 cursor-pointer"
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

              <div className="flex justify-end space-x-2 pt-3 border-t border-zinc-200">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsPackagingModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Prices'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Thermal Printable Batch Sticker Modal */}
      {printingBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-zinc-200 rounded-lg max-w-sm w-full p-6 shadow-xl text-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3 mb-4">
              <h3 className="text-sm font-semibold flex items-center space-x-2 text-zinc-900">
                <Printer className="w-4 h-4" />
                <span>Thermal Batch Label</span>
              </h3>
              <button onClick={() => setPrintingBatch(null)} className="text-zinc-400 hover:text-zinc-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-white text-black rounded-lg space-y-2 border-2 border-dashed border-zinc-400 font-sans">
              <div className="flex justify-between items-start border-b border-black pb-1.5">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-tight">{tenant?.name || 'BEVERAGE DISTRIBUTOR'}</div>
                  <div className="text-[9px] font-bold text-zinc-800 uppercase">{printingBatch.product.brand} • {printingBatch.product.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-mono font-bold bg-black text-white px-1.5 py-0.5 rounded">
                    {printingBatch.product.sku}
                  </div>
                </div>
              </div>

              <div className="py-1 grid grid-cols-2 gap-2 text-center bg-zinc-100 rounded border border-zinc-300">
                <div>
                  <span className="text-[8px] font-bold text-zinc-600 uppercase block">BATCH NUMBER</span>
                  <span className="text-xs font-mono font-black tracking-wider text-zinc-900">{printingBatch.batch.batch_number}</span>
                </div>
                <div>
                  <span className="text-[8px] font-bold text-zinc-600 uppercase block">CASES IN BATCH</span>
                  <span className="text-xs font-mono font-black text-zinc-900">{printingBatch.batch.remaining_quantity} CS</span>
                </div>
              </div>

              <div className="pt-1 flex justify-between items-center text-[10px]">
                <div>
                  <span className="text-[8px] font-bold text-zinc-500 block uppercase">MANUFACTURED</span>
                  <span className="font-mono font-bold">{printingBatch.batch.manufacture_date || 'N/A'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[8px] font-bold text-red-700 block uppercase">EXPIRATION (FIFO)</span>
                  <span className="font-mono font-black text-red-800 text-xs">{printingBatch.batch.expiry_date}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-300 text-center">
                <div className="h-8 bg-zinc-900 w-full flex items-center justify-center space-x-1 px-2 rounded-xs">
                  {[1, 2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 1, 4, 1].map((w, i) => (
                    <span key={i} className="bg-white h-full inline-block" style={{ width: `${w * 2}px` }} />
                  ))}
                </div>
                <span className="text-[8px] font-mono tracking-widest text-zinc-700 uppercase block mt-1">
                  *{printingBatch.batch.batch_number}*
                </span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t border-zinc-200 mt-4">
              <Button variant="outline" size="sm" onClick={() => setPrintingBatch(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => window.print()}
                className="flex items-center space-x-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Sticker</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
